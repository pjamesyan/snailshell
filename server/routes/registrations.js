const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { encryptField, decryptField } = require('../crypto');
const { authMiddleware } = require('../middleware');
const { decryptRegistration } = require('../utils/helpers');

function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

// GET /api/registrations/by-profile/:profileId
router.get('/by-profile/:profileId', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const registrations = db.prepare(`
      SELECT pp.*, p.name as project_name, p.logo as project_logo, p.phase as project_phase,
             p.website as project_website, p.type_tags as project_type_tags
      FROM profile_projects pp
      JOIN projects p ON pp.project_id = p.id
      WHERE pp.profile_id = ? AND pp.user_id = ?
      ORDER BY pp.updated_at DESC
    `).all(req.params.profileId, req.user.id);
    
    const decrypted = registrations.map(r => ({
      ...decryptRegistration(r, key),
      project_name: r.project_name,
      project_logo: r.project_logo,
      project_phase: r.project_phase,
      project_website: r.project_website,
      project_type_tags: r.project_type_tags
    }));
    
    res.json({ registrations: decrypted, total: decrypted.length });
  } catch (err) {
    console.error('Get registrations by profile error:', err);
    res.status(500).json({ error: '获取注册记录失败' });
  }
});

// GET /api/registrations/by-project/:projectId
router.get('/by-project/:projectId', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const registrations = db.prepare(`
      SELECT pp.*, pr.nickname, pr.avatar, pr.tags as profile_tags
      FROM profile_projects pp
      JOIN profiles pr ON pp.profile_id = pr.id
      WHERE pp.project_id = ? AND pp.user_id = ?
      ORDER BY pp.updated_at DESC
    `).all(req.params.projectId, req.user.id);
    
    const decrypted = registrations.map(r => ({
      ...decryptRegistration(r, key),
      nickname: r.nickname,
      avatar: r.avatar,
      profile_tags: r.profile_tags
    }));
    
    res.json({ registrations: decrypted, total: decrypted.length });
  } catch (err) {
    console.error('Get registrations by project error:', err);
    res.status(500).json({ error: '获取注册记录失败' });
  }
});

// GET /api/registrations/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const reg = db.prepare(`
      SELECT pp.*, p.name as project_name, p.logo as project_logo, p.phase as project_phase,
             p.website as project_website, pr.nickname, pr.avatar
      FROM profile_projects pp
      JOIN projects p ON pp.project_id = p.id
      JOIN profiles pr ON pp.profile_id = pr.id
      WHERE pp.id = ? AND pp.user_id = ?
    `).get(req.params.id, req.user.id);
    
    if (!reg) {
      return res.status(404).json({ error: '注册记录不存在' });
    }
    
    res.json({
      registration: {
        ...decryptRegistration(reg, key),
        project_name: reg.project_name,
        project_logo: reg.project_logo,
        project_phase: reg.project_phase,
        project_website: reg.project_website,
        nickname: reg.nickname,
        avatar: reg.avatar
      }
    });
  } catch (err) {
    console.error('Get registration detail error:', err);
    res.status(500).json({ error: '获取注册记录详情失败' });
  }
});

// POST /api/registrations/
router.post('/', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const { profile_id, project_id, username, password_hint, screenshots,
            status, investment, earnings, timeline, referrer_profile_id, notes, registered_at } = req.body;
    
    if (!profile_id || !project_id) {
      return res.status(400).json({ error: '身份ID和项目ID不能为空' });
    }
    
    // Verify profile and project belong to user
    const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?').get(profile_id, req.user.id);
    const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(project_id, req.user.id);
    
    if (!profile) return res.status(404).json({ error: '身份不存在' });
    if (!project) return res.status(404).json({ error: '项目不存在' });
    
    // Check for duplicate
    const existing = db.prepare('SELECT id FROM profile_projects WHERE profile_id = ? AND project_id = ?').get(profile_id, project_id);
    if (existing) {
      return res.status(409).json({ error: '该身份已注册此项目' });
    }
    
    const result = db.prepare(`
      INSERT INTO profile_projects (user_id, profile_id, project_id, username, password_hint,
        screenshots, status, investment, earnings, timeline, referrer_profile_id, notes, registered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      profile_id,
      project_id,
      encryptField(username, key),
      encryptField(password_hint, key),
      screenshots ? JSON.stringify(screenshots) : null,
      status || 'registered',
      investment ? encryptField(JSON.stringify(investment), key) : null,
      earnings ? encryptField(JSON.stringify(earnings), key) : null,
      timeline ? JSON.stringify(timeline) : JSON.stringify([]),
      referrer_profile_id || null,
      encryptField(notes, key),
      registered_at || new Date().toISOString()
    );
    
    const reg = db.prepare('SELECT * FROM profile_projects WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      message: '注册记录创建成功',
      registration: decryptRegistration(reg, key)
    });
  } catch (err) {
    console.error('Create registration error:', err);
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '该身份已注册此项目' });
    }
    res.status(500).json({ error: '创建注册记录失败' });
  }
});

// PUT /api/registrations/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const existing = db.prepare('SELECT * FROM profile_projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '注册记录不存在' });
    }
    
    const { username, password_hint, screenshots, status, investment, earnings,
            timeline, referrer_profile_id, notes, registered_at } = req.body;
    
    db.prepare(`
      UPDATE profile_projects SET
        username = ?,
        password_hint = ?,
        screenshots = ?,
        status = COALESCE(?, status),
        investment = ?,
        earnings = ?,
        timeline = ?,
        referrer_profile_id = ?,
        notes = ?,
        registered_at = COALESCE(?, registered_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      username !== undefined ? encryptField(username, key) : existing.username,
      password_hint !== undefined ? encryptField(password_hint, key) : existing.password_hint,
      screenshots !== undefined ? (screenshots ? JSON.stringify(screenshots) : null) : existing.screenshots,
      status || null,
      investment !== undefined ? (investment ? encryptField(JSON.stringify(investment), key) : null) : existing.investment,
      earnings !== undefined ? (earnings ? encryptField(JSON.stringify(earnings), key) : null) : existing.earnings,
      timeline !== undefined ? (timeline ? JSON.stringify(timeline) : null) : existing.timeline,
      referrer_profile_id !== undefined ? referrer_profile_id : existing.referrer_profile_id,
      notes !== undefined ? encryptField(notes, key) : existing.notes,
      registered_at || null,
      req.params.id,
      req.user.id
    );
    
    const updated = db.prepare('SELECT * FROM profile_projects WHERE id = ?').get(req.params.id);
    
    res.json({
      message: '注册记录更新成功',
      registration: decryptRegistration(updated, key)
    });
  } catch (err) {
    console.error('Update registration error:', err);
    res.status(500).json({ error: '更新注册记录失败' });
  }
});

// DELETE /api/registrations/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM profile_projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '注册记录不存在' });
    }
    
    db.prepare('DELETE FROM profile_projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    
    res.json({ message: '注册记录已删除' });
  } catch (err) {
    console.error('Delete registration error:', err);
    res.status(500).json({ error: '删除注册记录失败' });
  }
});

// POST /api/registrations/:id/timeline
router.post('/:id/timeline', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM profile_projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '注册记录不存在' });
    }
    
    const { date, action, note } = req.body;
    if (!date || !action) {
      return res.status(400).json({ error: '日期和操作不能为空' });
    }
    
    let timeline = existing.timeline ? JSON.parse(existing.timeline) : [];
    timeline.push({ date, action, note: note || '' });
    
    // Sort by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    db.prepare('UPDATE profile_projects SET timeline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(timeline), req.params.id);
    
    res.json({ message: '时间线条目已添加', timeline });
  } catch (err) {
    console.error('Add timeline error:', err);
    res.status(500).json({ error: '添加时间线条目失败' });
  }
});

// DELETE /api/registrations/:id/timeline/:index
router.delete('/:id/timeline/:index', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM profile_projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '注册记录不存在' });
    }
    
    let timeline = existing.timeline ? JSON.parse(existing.timeline) : [];
    const index = parseInt(req.params.index);
    
    if (index < 0 || index >= timeline.length) {
      return res.status(400).json({ error: '无效的索引' });
    }
    
    timeline.splice(index, 1);
    
    db.prepare('UPDATE profile_projects SET timeline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(timeline), req.params.id);
    
    res.json({ message: '时间线条目已删除', timeline });
  } catch (err) {
    console.error('Delete timeline error:', err);
    res.status(500).json({ error: '删除时间线条目失败' });
  }
});

// POST /api/registrations/batch
router.post('/batch', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const { profile_ids, project_id, action: batchAction, data } = req.body;
    
    if (!profile_ids || !Array.isArray(profile_ids) || profile_ids.length === 0) {
      return res.status(400).json({ error: '请提供身份ID列表' });
    }
    
    if (!batchAction) {
      return res.status(400).json({ error: '请提供操作类型' });
    }
    
    const results = [];
    
    const batchOp = db.transaction(() => {
      for (const profileId of profile_ids) {
        try {
          switch (batchAction) {
            case 'register': {
              // Create registration for each profile
              if (!project_id) throw new Error('缺少项目ID');
              
              const existing = db.prepare('SELECT id FROM profile_projects WHERE profile_id = ? AND project_id = ?').get(profileId, project_id);
              if (existing) {
                results.push({ profile_id: profileId, status: 'skipped', message: '已注册' });
                continue;
              }
              
              db.prepare(`
                INSERT INTO profile_projects (user_id, profile_id, project_id, status, timeline, registered_at)
                VALUES (?, ?, ?, 'registered', '[]', ?)
              `).run(req.user.id, profileId, project_id, new Date().toISOString());
              
              results.push({ profile_id: profileId, status: 'success' });
              break;
            }
            
            case 'update_status': {
              // Update status for existing registrations
              if (!project_id || !data?.status) throw new Error('缺少项目ID或状态');
              
              const reg = db.prepare('SELECT id FROM profile_projects WHERE profile_id = ? AND project_id = ? AND user_id = ?')
                .get(profileId, project_id, req.user.id);
              
              if (!reg) {
                results.push({ profile_id: profileId, status: 'skipped', message: '未注册' });
                continue;
              }
              
              db.prepare('UPDATE profile_projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(data.status, reg.id);
              
              results.push({ profile_id: profileId, status: 'success' });
              break;
            }
            
            case 'add_timeline': {
              // Add timeline entry to existing registrations
              if (!project_id || !data?.date || !data?.action) throw new Error('缺少必要参数');
              
              const reg = db.prepare('SELECT * FROM profile_projects WHERE profile_id = ? AND project_id = ? AND user_id = ?')
                .get(profileId, project_id, req.user.id);
              
              if (!reg) {
                results.push({ profile_id: profileId, status: 'skipped', message: '未注册' });
                continue;
              }
              
              let timeline = reg.timeline ? JSON.parse(reg.timeline) : [];
              timeline.push({ date: data.date, action: data.action, note: data.note || '' });
              timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
              
              db.prepare('UPDATE profile_projects SET timeline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(JSON.stringify(timeline), reg.id);
              
              results.push({ profile_id: profileId, status: 'success' });
              break;
            }
            
            default:
              results.push({ profile_id: profileId, status: 'error', message: '未知操作' });
          }
        } catch (e) {
          results.push({ profile_id: profileId, status: 'error', message: e.message });
        }
      }
    });
    
    batchOp();
    
    const successCount = results.filter(r => r.status === 'success').length;
    
    res.json({
      message: `批量操作完成: ${successCount}/${profile_ids.length} 成功`,
      results
    });
  } catch (err) {
    console.error('Batch operation error:', err);
    res.status(500).json({ error: '批量操作失败' });
  }
});

module.exports = router;
