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

const SYSTEM_PROMPT = '你是 SnailShell 私人助手，一个智能的个人经纪人。你可以帮助用户规划任务、解答问题、编写代码、提供建议。请用中文回复，除非用户使用其他语言。回复要简洁有用。';
const DEFAULT_LLM_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_PREVIEW_LENGTH = 100;
const MAX_CONTEXT_MESSAGES = 20;
const DEFAULT_MAX_TOKENS = 2000;
const AUTO_TITLE_MAX_LENGTH = 20;

// GET /conversations - 获取用户所有对话
router.get('/conversations', authMiddleware, (req, res) => {
  try {
    const conversations = db.prepare(
      `SELECT c.*, 
        (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM chat_conversations c 
       WHERE c.user_id = ? 
       ORDER BY c.updated_at DESC`
    ).all(req.user.id);

    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const decrypted = conversations.map(c => ({
      ...c,
      last_message: c.last_message
        ? decryptField(c.last_message, key)?.substring(0, MAX_PREVIEW_LENGTH) || null
        : null
    }));

    res.json(decrypted);
  } catch (err) {
    console.error('获取对话列表失败:', err);
    res.status(500).json({ error: '获取对话列表失败' });
  }
});

// POST /conversations - 创建新对话
router.post('/conversations', authMiddleware, (req, res) => {
  try {
    const { title } = req.body;
    const now = new Date().toISOString();

    const result = db.prepare(
      'INSERT INTO chat_conversations (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, title || '新对话', now, now);

    const conversation = db.prepare(
      'SELECT * FROM chat_conversations WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json(conversation);
  } catch (err) {
    console.error('创建对话失败:', err);
    res.status(500).json({ error: '创建对话失败' });
  }
});

// DELETE /conversations/:id - 删除对话及其所有消息
router.delete('/conversations/:id', authMiddleware, (req, res) => {
  try {
    const conversation = db.prepare(
      'SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM chat_messages WHERE conversation_id = ? AND user_id = ?').run(req.params.id, req.user.id);
      db.prepare('DELETE FROM chat_conversations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    });
    deleteAll();

    res.json({ message: '对话已删除' });
  } catch (err) {
    console.error('删除对话失败:', err);
    res.status(500).json({ error: '删除对话失败' });
  }
});

// PUT /conversations/:id - 更新对话标题
router.put('/conversations/:id', authMiddleware, (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: '标题不能为空' });
    }

    const conversation = db.prepare(
      'SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    db.prepare(
      'UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(title, new Date().toISOString(), req.params.id, req.user.id);

    const updated = db.prepare(
      'SELECT * FROM chat_conversations WHERE id = ?'
    ).get(req.params.id);

    res.json(updated);
  } catch (err) {
    console.error('更新对话失败:', err);
    res.status(500).json({ error: '更新对话失败' });
  }
});

// GET /conversations/:id/messages - 获取对话的所有消息
router.get('/conversations/:id/messages', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const conversation = db.prepare(
      'SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const messages = db.prepare(
      'SELECT * FROM chat_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?'
    ).all(req.params.id, req.user.id, limit, offset);

    const decrypted = messages.map(m => ({
      ...m,
      content: decryptField(m.content, key)
    }));

    res.json(decrypted);
  } catch (err) {
    console.error('获取消息失败:', err);
    res.status(500).json({ error: '获取消息失败' });
  }
});

// POST /conversations/:id/messages - 发送消息并获取AI回复
router.post('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const conversation = db.prepare(
      'SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    // 保存用户消息
    const now = new Date().toISOString();
    const encryptedContent = encryptField(content, key);

    const userMsgResult = db.prepare(
      'INSERT INTO chat_messages (user_id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, req.params.id, 'user', encryptedContent, now);

    const userMessage = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(userMsgResult.lastInsertRowid);

    // 获取用户的LLM配置
    const config = db.prepare(
      'SELECT * FROM llm_config WHERE user_id = ?'
    ).get(req.user.id);

    if (!config || !config.api_key) {
      return res.status(400).json({ error: '请先在设置中配置AI助手的API信息' });
    }

    const apiKey = decryptField(config.api_key, key);
    const apiUrl = config.api_url || DEFAULT_LLM_API_URL;

    // 获取最近20条消息作为上下文
    const contextRows = db.prepare(
      `SELECT role, content FROM chat_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ${MAX_CONTEXT_MESSAGES}`
    ).all(req.params.id, req.user.id);

    const contextMessages = contextRows.reverse().map(m => ({
      role: m.role,
      content: decryptField(m.content, key)
    }));

    // 调用LLM API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...contextMessages
        ],
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('LLM API调用失败:', errorData);
      return res.status(502).json({ error: 'AI服务调用失败，请检查API配置' });
    }

    const data = await response.json();
    const assistantContent = data.choices?.[0]?.message?.content || '抱歉，我无法生成回复。';

    // 保存AI回复
    const assistantTime = new Date().toISOString();
    const encryptedAssistant = encryptField(assistantContent, key);

    const assistantMsgResult = db.prepare(
      'INSERT INTO chat_messages (user_id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, req.params.id, 'assistant', encryptedAssistant, assistantTime);

    const assistantMessage = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(assistantMsgResult.lastInsertRowid);

    // 更新对话的updated_at
    db.prepare(
      'UPDATE chat_conversations SET updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(assistantTime, req.params.id, req.user.id);

    // 如果是第一条消息且标题仍为默认，自动生成标题
    if (conversation.title === '新对话') {
      const messageCount = db.prepare(
        'SELECT COUNT(*) as count FROM chat_messages WHERE conversation_id = ? AND user_id = ? AND role = ?'
      ).get(req.params.id, req.user.id, 'user');

      if (messageCount.count === 1) {
        const autoTitle = content.substring(0, AUTO_TITLE_MAX_LENGTH);
        db.prepare(
          'UPDATE chat_conversations SET title = ? WHERE id = ? AND user_id = ?'
        ).run(autoTitle, req.params.id, req.user.id);
      }
    }

    res.status(201).json({
      userMessage: { ...userMessage, content: content },
      assistantMessage: { ...assistantMessage, content: assistantContent }
    });
  } catch (err) {
    console.error('发送消息失败:', err);
    res.status(500).json({ error: '发送消息失败' });
  }
});

// GET /config - 获取用户的LLM配置
router.get('/config', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const config = db.prepare(
      'SELECT * FROM llm_config WHERE user_id = ?'
    ).get(req.user.id);

    if (!config) {
      return res.json(null);
    }

    // 解密并脱敏api_key
    const decryptedKey = decryptField(config.api_key, key);
    let maskedKey = null;
    if (decryptedKey && decryptedKey.length > 7) {
      maskedKey = decryptedKey.substring(0, 3) + '****' + decryptedKey.substring(decryptedKey.length - 4);
    } else if (decryptedKey) {
      maskedKey = '****';
    }

    res.json({
      ...config,
      api_key: maskedKey
    });
  } catch (err) {
    console.error('获取LLM配置失败:', err);
    res.status(500).json({ error: '获取LLM配置失败' });
  }
});

// PUT /config - 更新或创建LLM配置
router.put('/config', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });

    const { provider, api_key, api_url, model } = req.body;

    const existing = db.prepare(
      'SELECT * FROM llm_config WHERE user_id = ?'
    ).get(req.user.id);

    const encryptedApiKey = api_key ? encryptField(api_key, key) : null;

    if (existing) {
      db.prepare(
        `UPDATE llm_config SET 
          provider = COALESCE(?, provider),
          api_key = COALESCE(?, api_key),
          api_url = COALESCE(?, api_url),
          model = COALESCE(?, model)
         WHERE user_id = ?`
      ).run(provider, encryptedApiKey, api_url, model, req.user.id);
    } else {
      db.prepare(
        'INSERT INTO llm_config (user_id, provider, api_key, api_url, model) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, provider || 'openai', encryptedApiKey, api_url || DEFAULT_LLM_API_URL, model || 'gpt-3.5-turbo');
    }

    const config = db.prepare(
      'SELECT * FROM llm_config WHERE user_id = ?'
    ).get(req.user.id);

    res.json({ message: '配置已更新', data: { ...config, api_key: '****' } });
  } catch (err) {
    console.error('更新LLM配置失败:', err);
    res.status(500).json({ error: '更新LLM配置失败' });
  }
});

module.exports = router;
