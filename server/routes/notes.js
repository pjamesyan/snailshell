const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

// GET /api/notes
router.get('/', authMiddleware, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(req.user.id).count;
    const notes = db.prepare(
      'SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(req.user.id, limit, offset);

    const parsed = notes.map(n => {
      if (n.images) try { n.images = JSON.parse(n.images); } catch { n.images = []; }
      return n;
    });

    res.json({ notes: parsed, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('List notes error:', err);
    res.status(500).json({ error: '获取笔记列表失败' });
  }
});

// POST /api/notes
router.post('/', authMiddleware, (req, res) => {
  try {
    const { content, images } = req.body;
    if ((!content || !content.trim()) && (!images || !images.length)) return res.status(400).json({ error: '笔记内容不能为空' });

    const imagesStr = images ? JSON.stringify(images) : null;
    const result = db.prepare(
      'INSERT INTO notes (user_id, content, images) VALUES (?, ?, ?)'
    ).run(req.user.id, (content || '').trim(), imagesStr);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    if (note.images) try { note.images = JSON.parse(note.images); } catch { note.images = []; }
    res.status(201).json(note);
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ error: '创建笔记失败' });
  }
});

// PUT /api/notes/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '笔记不存在' });

    const { content, images } = req.body;
    if ((!content || !content.trim()) && (!images || !images.length)) return res.status(400).json({ error: '笔记内容不能为空' });

    const imagesStr = images !== undefined ? JSON.stringify(images) : existing.images;
    db.prepare('UPDATE notes SET content = ?, images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
      .run((content || '').trim(), imagesStr, req.params.id, req.user.id);

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (updated.images) try { updated.images = JSON.parse(updated.images); } catch { updated.images = []; }
    res.json(updated);
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ error: '更新笔记失败' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '笔记不存在' });

    db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: '删除笔记失败' });
  }
});

module.exports = router;
