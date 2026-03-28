const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

// GET /api/todos/categories
router.get('/categories', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(
      "SELECT DISTINCT category FROM todos WHERE user_id = ? AND category != '' ORDER BY category"
    ).all(req.user.id);
    res.json(rows.map(r => r.category));
  } catch (err) {
    console.error('Get todo categories error:', err);
    res.status(500).json({ error: '获取类别失败' });
  }
});

// GET /api/todos
router.get('/', authMiddleware, (req, res) => {
  try {
    const { category, year, done, priority } = req.query;
    let sql = 'SELECT t.*, p.nickname as profile_name, pj.name as project_name FROM todos t LEFT JOIN profiles p ON t.profile_id = p.id LEFT JOIN projects pj ON t.project_id = pj.id WHERE t.user_id = ?';
    const params = [req.user.id];

    if (category) { sql += ' AND t.category = ?'; params.push(category); }
    if (year) { sql += " AND strftime('%Y', t.created_at) = ?"; params.push(year); }
    if (done !== undefined && done !== '') { sql += ' AND t.done = ?'; params.push(Number(done)); }
    if (priority) { sql += ' AND t.priority = ?'; params.push(Number(priority)); }

    sql += ' ORDER BY t.done ASC, t.priority DESC, t.due_date ASC, t.created_at DESC';
    const todos = db.prepare(sql).all(...params);
    const parsed = todos.map(t => {
      if (t.images) try { t.images = JSON.parse(t.images); } catch { t.images = []; }
      return t;
    });
    res.json(parsed);
  } catch (err) {
    console.error('List todos error:', err);
    res.status(500).json({ error: '获取待办列表失败' });
  }
});

// POST /api/todos
router.post('/', authMiddleware, (req, res) => {
  try {
    const { title, priority, category, due_date, profile_id, project_id, notes, images } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: '任务内容不能为空' });

    const imagesStr = images ? JSON.stringify(images) : null;
    const result = db.prepare(
      'INSERT INTO todos (user_id, title, priority, category, due_date, profile_id, project_id, notes, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, title.trim(), priority || 1, category || '', due_date || null, profile_id || null, project_id || null, notes || '', imagesStr);

    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
    if (todo.images) try { todo.images = JSON.parse(todo.images); } catch { todo.images = []; }
    res.status(201).json(todo);
  } catch (err) {
    console.error('Create todo error:', err);
    res.status(500).json({ error: '创建待办失败' });
  }
});

// PUT /api/todos/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '待办不存在' });

    const { title, priority, category, due_date, profile_id, project_id, notes, done, images } = req.body;
    const imagesStr = images !== undefined ? JSON.stringify(images) : existing.images;
    db.prepare(
      'UPDATE todos SET title=?, priority=?, category=?, due_date=?, profile_id=?, project_id=?, notes=?, done=?, images=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?'
    ).run(
      title !== undefined ? title : existing.title,
      priority !== undefined ? priority : existing.priority,
      category !== undefined ? category : existing.category,
      due_date !== undefined ? due_date : existing.due_date,
      profile_id !== undefined ? profile_id : existing.profile_id,
      project_id !== undefined ? project_id : existing.project_id,
      notes !== undefined ? notes : existing.notes,
      done !== undefined ? done : existing.done,
      imagesStr,
      req.params.id, req.user.id
    );

    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    if (updated.images) try { updated.images = JSON.parse(updated.images); } catch { updated.images = []; }
    res.json(updated);
  } catch (err) {
    console.error('Update todo error:', err);
    res.status(500).json({ error: '更新待办失败' });
  }
});

// PATCH /api/todos/:id/toggle
router.patch('/:id/toggle', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '待办不存在' });

    const newDone = existing.done ? 0 : 1;
    db.prepare('UPDATE todos SET done = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDone, req.params.id);
    res.json({ ...existing, done: newDone });
  } catch (err) {
    console.error('Toggle todo error:', err);
    res.status(500).json({ error: '切换状态失败' });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: '待办不存在' });

    db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete todo error:', err);
    res.status(500).json({ error: '删除待办失败' });
  }
});

module.exports = router;
