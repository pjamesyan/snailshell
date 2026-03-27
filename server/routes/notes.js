const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware');
const { encryptField, decryptField } = require('../crypto');

const VALID_CATEGORIES = ['general', 'idea', 'account', 'diary', 'reference'];

function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

// GET /api/notes
router.get('/', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const { category, search, pinned } = req.query;

    let sql = 'SELECT * FROM notes WHERE user_id = ?';
    const params = [req.user.id];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (pinned !== undefined) {
      sql += ' AND pinned = ?';
      params.push(parseInt(pinned));
    }

    sql += ' ORDER BY pinned DESC, updated_at DESC';

    let notes = db.prepare(sql).all(...params);

    // Decrypt content
    notes = notes.map(note => ({
      ...note,
      content: decryptField(note.content, key)
    }));

    // Filter by search after decryption
    if (search) {
      const s = search.toLowerCase();
      notes = notes.filter(note =>
        (note.title && note.title.toLowerCase().includes(s)) ||
        (note.content && note.content.toLowerCase().includes(s)) ||
        (note.tags && note.tags.toLowerCase().includes(s))
      );
    }

    res.json({ notes, total: notes.length });
  } catch (err) {
    console.error('List notes error:', err);
    res.status(500).json({ error: '获取笔记列表失败' });
  }
});

// GET /api/notes/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    note.content = decryptField(note.content, key);

    res.json({ note });
  } catch (err) {
    console.error('Get note error:', err);
    res.status(500).json({ error: '获取笔记详情失败' });
  }
});

// POST /api/notes
router.post('/', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const { title, content, category, tags } = req.body;

    if (!title) {
      return res.status(400).json({ error: '笔记标题不能为空' });
    }

    const cat = category || 'general';
    if (!VALID_CATEGORIES.includes(cat)) {
      return res.status(400).json({ error: '无效的笔记分类' });
    }

    const result = db.prepare(`
      INSERT INTO notes (user_id, title, content, category, tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      title,
      encryptField(content, key),
      cat,
      tags || null
    );

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    note.content = decryptField(note.content, key);

    res.status(201).json({ message: '笔记创建成功', note });
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ error: '创建笔记失败' });
  }
});

// PUT /api/notes/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    const { title, content, category, tags } = req.body;

    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: '无效的笔记分类' });
    }

    db.prepare(`
      UPDATE notes SET
        title = COALESCE(?, title),
        content = ?,
        category = COALESCE(?, category),
        tags = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      title || null,
      content !== undefined ? encryptField(content, key) : existing.content,
      category || null,
      tags !== undefined ? tags : existing.tags,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    updated.content = decryptField(updated.content, key);

    res.json({ message: '笔记更新成功', note: updated });
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ error: '更新笔记失败' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);

    res.json({ message: '笔记已删除' });
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: '删除笔记失败' });
  }
});

// PUT /api/notes/:id/pin
router.put('/:id/pin', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    const newPinned = existing.pinned ? 0 : 1;
    db.prepare('UPDATE notes SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(newPinned, req.params.id, req.user.id);

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);

    res.json({ message: newPinned ? '笔记已置顶' : '笔记已取消置顶', note: updated });
  } catch (err) {
    console.error('Toggle pin error:', err);
    res.status(500).json({ error: '更新置顶状态失败' });
  }
});

module.exports = router;
