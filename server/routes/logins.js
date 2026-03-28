const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware');
const { encryptField, decryptField } = require('../crypto');

const router = express.Router();

const ENCRYPTED_FIELDS = ['password', 'email', 'phone'];

function getEncKey(req) {
  const key = req.headers['x-encryption-key'];
  if (!key) return null;
  return Buffer.from(key, 'hex');
}

function encryptLogin(data, key) {
  const result = { ...data };
  if (key) {
    for (const f of ENCRYPTED_FIELDS) {
      if (result[f] !== undefined) result[f] = encryptField(result[f], key);
    }
  }
  return result;
}

function decryptLogin(row, key) {
  if (!row) return row;
  const result = { ...row };
  if (key) {
    for (const f of ENCRYPTED_FIELDS) {
      if (result[f]) result[f] = decryptField(result[f], key);
    }
  }
  if (result.login_devices) {
    try { result.login_devices = JSON.parse(result.login_devices); } catch { result.login_devices = []; }
  }
  return result;
}

// GET /api/logins/categories
router.get('/categories', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(
      "SELECT DISTINCT category FROM logins WHERE user_id = ? AND category != '' ORDER BY category"
    ).all(req.user.id);
    res.json(rows.map(r => r.category));
  } catch (err) {
    console.error('Get login categories error:', err);
    res.status(500).json({ error: '获取类别失败' });
  }
});

// GET /api/logins
router.get('/', authMiddleware, (req, res) => {
  try {
    const { category, search } = req.query;
    const key = getEncKey(req);
    let sql = 'SELECT * FROM logins WHERE user_id = ?';
    const params = [req.user.id];

    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (search) { sql += ' AND (name LIKE ? OR username LIKE ? OR password_hint LIKE ? OR notes LIKE ?)'; const s = `%${search}%`; params.push(s, s, s, s); }

    sql += ' ORDER BY category ASC, name ASC, created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => decryptLogin(r, key)));
  } catch (err) {
    console.error('List logins error:', err);
    res.status(500).json({ error: '获取登录信息失败' });
  }
});

// GET /api/logins/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncKey(req);
    const row = db.prepare('SELECT * FROM logins WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: '记录不存在' });
    res.json(decryptLogin(row, key));
  } catch (err) {
    console.error('Get login error:', err);
    res.status(500).json({ error: '获取登录信息失败' });
  }
});

// POST /api/logins
router.post('/', authMiddleware, (req, res) => {
  try {
    const key = getEncKey(req);
    const { name, url, username, password_hint, password, email, phone, category, login_devices, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '名称不能为空' });

    const enc = encryptLogin({ password, email, phone }, key);
    const devicesStr = login_devices ? JSON.stringify(login_devices) : null;

    const result = db.prepare(
      'INSERT INTO logins (user_id, name, url, username, password_hint, password, email, phone, category, login_devices, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, name.trim(), url || null, username || null, password_hint || null, enc.password, enc.email, enc.phone, category || '', devicesStr, notes || '');

    const row = db.prepare('SELECT * FROM logins WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(decryptLogin(row, key));
  } catch (err) {
    console.error('Create login error:', err);
    res.status(500).json({ error: '创建登录信息失败' });
  }
});

// PUT /api/logins/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncKey(req);
    const existing = db.prepare('SELECT * FROM logins WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '记录不存在' });

    const { name, url, username, password_hint, password, email, phone, category, login_devices, notes } = req.body;
    const enc = encryptLogin({ password, email, phone }, key);
    const devicesStr = login_devices !== undefined ? JSON.stringify(login_devices) : existing.login_devices;

    db.prepare(
      'UPDATE logins SET name=?, url=?, username=?, password_hint=?, password=?, email=?, phone=?, category=?, login_devices=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?'
    ).run(
      name !== undefined ? name : existing.name,
      url !== undefined ? url : existing.url,
      username !== undefined ? username : existing.username,
      password_hint !== undefined ? password_hint : existing.password_hint,
      password !== undefined ? enc.password : existing.password,
      email !== undefined ? enc.email : existing.email,
      phone !== undefined ? enc.phone : existing.phone,
      category !== undefined ? category : existing.category,
      devicesStr,
      notes !== undefined ? notes : existing.notes,
      req.params.id, req.user.id
    );

    const updated = db.prepare('SELECT * FROM logins WHERE id = ?').get(req.params.id);
    res.json(decryptLogin(updated, key));
  } catch (err) {
    console.error('Update login error:', err);
    res.status(500).json({ error: '更新登录信息失败' });
  }
});

// DELETE /api/logins/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM logins WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '记录不存在' });

    db.prepare('DELETE FROM logins WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete login error:', err);
    res.status(500).json({ error: '删除登录信息失败' });
  }
});

module.exports = router;
