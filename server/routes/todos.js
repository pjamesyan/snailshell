const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware');
const { encryptField, decryptField } = require('../crypto');

function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

// GET /api/todos
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority } = req.query;

    let sql = 'SELECT * FROM todos WHERE user_id = ?';
    const params = [userId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(parseInt(priority));
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const todos = db.prepare(sql).all(...params);

    // Build tree: nest subtasks under their parent
    const topLevel = [];
    const map = {};
    todos.forEach(t => { map[t.id] = { ...t, subtasks: [] }; });
    todos.forEach(t => {
      if (t.parent_id && map[t.parent_id]) {
        map[t.parent_id].subtasks.push(map[t.id]);
      } else {
        topLevel.push(map[t.id]);
      }
    });

    res.json({ todos: topLevel, total: topLevel.length });
  } catch (err) {
    console.error('List todos error:', err);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

// GET /api/todos/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!todo) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const subtasks = db.prepare('SELECT * FROM todos WHERE parent_id = ? AND user_id = ? ORDER BY sort_order ASC, created_at DESC').all(todo.id, req.user.id);
    todo.subtasks = subtasks;

    res.json({ todo });
  } catch (err) {
    console.error('Get todo error:', err);
    res.status(500).json({ error: '获取任务详情失败' });
  }
});

// POST /api/todos
router.post('/', authMiddleware, (req, res) => {
  try {
    const { title, description, priority, due_date, tags, parent_id } = req.body;

    if (!title) {
      return res.status(400).json({ error: '任务标题不能为空' });
    }

    if (priority !== undefined && (priority < 1 || priority > 4)) {
      return res.status(400).json({ error: '优先级必须在1-4之间' });
    }

    if (parent_id) {
      const parent = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(parent_id, req.user.id);
      if (!parent) {
        return res.status(404).json({ error: '父任务不存在' });
      }
    }

    const result = db.prepare(`
      INSERT INTO todos (user_id, parent_id, title, description, priority, due_date, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      parent_id || null,
      title,
      description || null,
      priority || 2,
      due_date || null,
      tags || null
    );

    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ message: '任务创建成功', todo });
  } catch (err) {
    console.error('Create todo error:', err);
    res.status(500).json({ error: '创建任务失败' });
  }
});

// PUT /api/todos/sort-order
router.put('/sort-order', authMiddleware, (req, res) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: '无效的排序数据' });
    const stmt = db.prepare('UPDATE todos SET sort_order = ? WHERE id = ? AND user_id = ?');
    const update = db.transaction(() => {
      orders.forEach(o => stmt.run(o.sort_order, o.id, req.user.id));
    });
    update();
    res.json({ message: '排序已更新' });
  } catch (err) {
    console.error('Update sort order error:', err);
    res.status(500).json({ error: '更新排序失败' });
  }
});

// PUT /api/todos/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const { title, description, priority, status, due_date, tags, parent_id } = req.body;

    if (priority !== undefined && (priority < 1 || priority > 4)) {
      return res.status(400).json({ error: '优先级必须在1-4之间' });
    }

    if (status !== undefined && !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: '无效的任务状态' });
    }

    db.prepare(`
      UPDATE todos SET
        title = COALESCE(?, title),
        description = ?,
        priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        due_date = ?,
        tags = ?,
        parent_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      title || null,
      description !== undefined ? description : existing.description,
      priority || null,
      status || null,
      due_date !== undefined ? due_date : existing.due_date,
      tags !== undefined ? tags : existing.tags,
      parent_id !== undefined ? parent_id : existing.parent_id,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);

    res.json({ message: '任务更新成功', todo: updated });
  } catch (err) {
    console.error('Update todo error:', err);
    res.status(500).json({ error: '更新任务失败' });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // Cascade delete subtasks
    db.prepare('DELETE FROM todos WHERE parent_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);

    res.json({ message: '任务已删除' });
  } catch (err) {
    console.error('Delete todo error:', err);
    res.status(500).json({ error: '删除任务失败' });
  }
});

// POST /api/todos/:id/decompose
router.post('/:id/decompose', authMiddleware, async (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!todo) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const config = db.prepare('SELECT * FROM llm_config WHERE user_id = ?').get(req.user.id);
    if (!config || !config.api_key) {
      return res.status(400).json({ error: '请先配置LLM' });
    }

    const apiKey = decryptField(config.api_key, key);
    if (!apiKey) {
      return res.status(400).json({ error: 'LLM密钥解密失败' });
    }

    const apiUrl = config.api_url || 'https://api.openai.com/v1/chat/completions';
    const model = config.model || 'gpt-3.5-turbo';

    const systemPrompt = '你是一个任务规划助手。请将以下任务分解为具体的子任务步骤。每个子任务应该是可执行的、具体的。请以JSON数组格式返回，每个元素包含 title 和 description 字段。只返回JSON数组，不要其他内容。';
    const userPrompt = `任务标题：${todo.title}${todo.description ? `\n任务描述：${todo.description}` : ''}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('LLM API error:', errBody);
      return res.status(502).json({ error: 'LLM接口调用失败' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'LLM返回内容为空' });
    }

    let subtaskList;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      subtaskList = JSON.parse(cleaned);
    } catch (e) {
      console.error('Parse LLM response error:', e.message, content);
      return res.status(502).json({ error: 'LLM返回格式解析失败' });
    }

    if (!Array.isArray(subtaskList)) {
      return res.status(502).json({ error: 'LLM返回格式不正确' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO todos (user_id, parent_id, title, description, priority, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const createdSubtasks = [];
    const insertAll = db.transaction(() => {
      subtaskList.forEach((item, index) => {
        if (!item.title) return;
        const result = insertStmt.run(
          req.user.id,
          todo.id,
          item.title,
          item.description || null,
          todo.priority,
          index
        );
        const subtask = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
        createdSubtasks.push(subtask);
      });
    });
    insertAll();

    res.status(201).json({ message: '任务分解成功', subtasks: createdSubtasks });
  } catch (err) {
    console.error('Decompose todo error:', err);
    res.status(500).json({ error: '任务分解失败' });
  }
});

module.exports = router;
