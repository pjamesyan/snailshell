const express = require('express');
const { db } = require('../db');
const { encryptField, decryptField } = require('../crypto');
const { authMiddleware } = require('../middleware');

const router = express.Router();

const ENCRYPTED_FIELDS = ['account_email', 'password_hint', 'api_key_note', 'assets', 'notes', 'exchange_uid', 'deposit_addresses'];

function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

function encryptExchange(data, key) {
  const enc = { ...data };
  for (const field of ENCRYPTED_FIELDS) {
    if (enc[field] !== undefined && enc[field] !== null) {
      const value = typeof enc[field] === 'object' ? JSON.stringify(enc[field]) : String(enc[field]);
      enc[field] = encryptField(value, key);
    }
  }
  return enc;
}

function decryptExchange(data, key) {
  const dec = { ...data };
  for (const field of ENCRYPTED_FIELDS) {
    if (dec[field]) {
      const value = decryptField(dec[field], key);
      if (value && (field === 'assets' || field === 'deposit_addresses')) {
        try { dec[field] = JSON.parse(value); } catch { dec[field] = value; }
      } else {
        dec[field] = value;
      }
    }
  }
  // Parse non-encrypted JSON fields
  if (dec.login_devices) {
    try { dec.login_devices = JSON.parse(dec.login_devices); } catch { dec.login_devices = []; }
  } else {
    dec.login_devices = [];
  }
  if (dec.screenshots) {
    try { dec.screenshots = typeof dec.screenshots === 'string' ? JSON.parse(dec.screenshots) : dec.screenshots; } catch { dec.screenshots = []; }
  }
  return dec;
}

// PUT /api/exchanges/sort-order
router.put('/sort-order', authMiddleware, (req, res) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: '无效的排序数据' });
    const stmt = db.prepare('UPDATE exchanges SET sort_order = ? WHERE id = ? AND user_id = ?');
    const update = db.transaction(() => {
      orders.forEach(o => stmt.run(o.sort_order, o.id, req.user.id));
    });
    update();
    res.json({ message: '排序已更新' });
  } catch (err) {
    res.status(500).json({ error: '更新排序失败' });
  }
});

// List all exchanges (optionally filter by profile_id or exchange_name)
router.get('/', authMiddleware, (req, res) => {
  try {
    const { profile_id, exchange_name } = req.query;
    let sql = 'SELECT e.*, p.nickname as profile_nickname, p.avatar as profile_avatar FROM exchanges e LEFT JOIN profiles p ON e.profile_id = p.id WHERE e.user_id = ?';
    const params = [req.user.id];

    if (profile_id) { sql += ' AND e.profile_id = ?'; params.push(profile_id); }
    if (exchange_name) { sql += ' AND e.exchange_name = ?'; params.push(exchange_name); }

    sql += ' ORDER BY e.updated_at DESC';
    const exchanges = db.prepare(sql).all(...params);
    const decrypted = exchanges.map(e => decryptExchange(e, getEncryptionKey(req)));
    res.json(decrypted);
  } catch (err) {
    console.error('List exchanges error:', err);
    res.status(500).json({ error: '获取交易所列表失败' });
  }
});

// Get single exchange
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const exchange = db.prepare('SELECT e.*, p.nickname as profile_nickname, p.avatar as profile_avatar FROM exchanges e LEFT JOIN profiles p ON e.profile_id = p.id WHERE e.id = ? AND e.user_id = ?')
      .get(req.params.id, req.user.id);
    if (!exchange) return res.status(404).json({ error: '交易所记录不存在' });
    res.json(decryptExchange(exchange, getEncryptionKey(req)));
  } catch (err) {
    console.error('Get exchange error:', err);
    res.status(500).json({ error: '获取交易所详情失败' });
  }
});

// Create exchange
router.post('/', authMiddleware, (req, res) => {
  try {
    const { profile_id, exchange_name, account_email, password_hint, kyc_status, api_key_note, assets, total_value_usd, screenshots, notes, exchange_uid, deposit_addresses, login_devices } = req.body;

    if (!profile_id || !exchange_name) {
      return res.status(400).json({ error: '身份和交易所名称不能为空' });
    }

    // Verify profile belongs to user
    const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?').get(profile_id, req.user.id);
    if (!profile) return res.status(400).json({ error: '身份不存在' });

    const encrypted = encryptExchange({ account_email, password_hint, api_key_note, assets, notes, exchange_uid, deposit_addresses }, getEncryptionKey(req));

    const result = db.prepare(`
      INSERT INTO exchanges (user_id, profile_id, exchange_name, account_email, password_hint, kyc_status, api_key_note, assets, total_value_usd, screenshots, notes, exchange_uid, deposit_addresses, login_devices)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, profile_id, exchange_name,
      encrypted.account_email, encrypted.password_hint,
      kyc_status || 'none', encrypted.api_key_note,
      encrypted.assets, total_value_usd || 0,
      screenshots ? JSON.stringify(screenshots) : null,
      encrypted.notes,
      encrypted.exchange_uid,
      encrypted.deposit_addresses,
      login_devices ? JSON.stringify(login_devices) : null
    );

    const newExchange = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: '交易所记录创建成功', exchange: decryptExchange(newExchange, getEncryptionKey(req)) });
  } catch (err) {
    console.error('Create exchange error:', err);
    res.status(500).json({ error: '创建交易所记录失败' });
  }
});

// Update exchange
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM exchanges WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '交易所记录不存在' });

    const { exchange_name, account_email, password_hint, kyc_status, api_key_note, assets, total_value_usd, screenshots, notes, profile_id, exchange_uid, deposit_addresses, login_devices } = req.body;

    const encrypted = encryptExchange({ account_email, password_hint, api_key_note, assets, notes, exchange_uid, deposit_addresses }, getEncryptionKey(req));

    db.prepare(`
      UPDATE exchanges SET exchange_name=?, account_email=?, password_hint=?, kyc_status=?, api_key_note=?, assets=?, total_value_usd=?, screenshots=?, notes=?, profile_id=?, exchange_uid=?, deposit_addresses=?, login_devices=?, last_updated=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND user_id=?
    `).run(
      exchange_name || existing.exchange_name,
      encrypted.account_email, encrypted.password_hint,
      kyc_status || existing.kyc_status, encrypted.api_key_note,
      encrypted.assets, total_value_usd !== undefined ? total_value_usd : existing.total_value_usd,
      screenshots ? JSON.stringify(screenshots) : existing.screenshots,
      encrypted.notes,
      profile_id || existing.profile_id,
      encrypted.exchange_uid,
      encrypted.deposit_addresses,
      login_devices ? JSON.stringify(login_devices) : existing.login_devices,
      req.params.id, req.user.id
    );

    const updated = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(req.params.id);
    res.json({ message: '交易所记录更新成功', exchange: decryptExchange(updated, getEncryptionKey(req)) });
  } catch (err) {
    console.error('Update exchange error:', err);
    res.status(500).json({ error: '更新交易所记录失败' });
  }
});

// Delete exchange
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM exchanges WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: '交易所记录不存在' });
    res.json({ message: '交易所记录已删除' });
  } catch (err) {
    console.error('Delete exchange error:', err);
    res.status(500).json({ error: '删除交易所记录失败' });
  }
});

// Stats / summary
router.get('/stats/summary', authMiddleware, (req, res) => {
  try {
    const exchanges = db.prepare('SELECT e.*, p.nickname as profile_nickname, p.avatar as profile_avatar FROM exchanges e LEFT JOIN profiles p ON e.profile_id = p.id WHERE e.user_id = ?').all(req.user.id);
    const decrypted = exchanges.map(e => decryptExchange(e, getEncryptionKey(req)));

    // Total value
    const totalValue = decrypted.reduce((sum, e) => sum + (e.total_value_usd || 0), 0);

    // By exchange
    const byExchange = {};
    decrypted.forEach(e => {
      if (!byExchange[e.exchange_name]) byExchange[e.exchange_name] = { count: 0, totalValue: 0 };
      byExchange[e.exchange_name].count++;
      byExchange[e.exchange_name].totalValue += e.total_value_usd || 0;
    });

    // By coin (aggregate across all exchanges)
    const byCoin = {};
    decrypted.forEach(e => {
      if (e.assets && Array.isArray(e.assets)) {
        e.assets.forEach(a => {
          if (!byCoin[a.coin]) byCoin[a.coin] = { amount: 0, valueUsd: 0 };
          byCoin[a.coin].amount += parseFloat(a.amount) || 0;
          byCoin[a.coin].valueUsd += parseFloat(a.value_usd) || 0;
        });
      }
    });

    // By profile
    const byProfile = {};
    decrypted.forEach(e => {
      const pid = e.profile_id;
      if (!byProfile[pid]) byProfile[pid] = { name: e.profile_nickname || `身份${pid}`, avatar: e.profile_avatar, totalValue: 0, count: 0, exchanges: [] };
      byProfile[pid].totalValue += e.total_value_usd || 0;
      byProfile[pid].count += 1;
      byProfile[pid].exchanges.push(e.exchange_name);
    });

    const kycVerified = decrypted.filter(e => e.kyc_status === 'verified').length;
    const uniqueExchanges = Object.keys(byExchange).length;
    const exchangeDistribution = {};
    Object.entries(byExchange).forEach(([name, data]) => { exchangeDistribution[name] = data.count; });

    res.json({
      total: exchanges.length,
      totalExchanges: exchanges.length,
      totalValue: Math.round(totalValue * 100) / 100,
      kycVerified,
      uniqueExchanges,
      exchangeDistribution,
      byExchange: Object.entries(byExchange).map(([name, data]) => ({ name, ...data })),
      byCoin,
      byProfile: Object.values(byProfile)
    });
  } catch (err) {
    console.error('Exchange stats error:', err);
    res.status(500).json({ error: '获取交易所统计失败' });
  }
});

module.exports = router;
