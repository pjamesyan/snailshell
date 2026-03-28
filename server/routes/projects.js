const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware');
const { decryptRegistration, parseProjectDates } = require('../utils/helpers');

function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

// GET /api/projects/stats
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(req.user.id);
    
    const total = projects.length;
    const phaseDistribution = { testnet: 0, mainnet: 0, tge: 0, ended: 0 };
    const typeCounts = {};
    const ecosystemCounts = {};
    
    projects.forEach(p => {
      phaseDistribution[p.phase] = (phaseDistribution[p.phase] || 0) + 1;
      
      if (p.type_tags) {
        p.type_tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
          typeCounts[tag] = (typeCounts[tag] || 0) + 1;
        });
      }
      
      if (p.ecosystem_tags) {
        p.ecosystem_tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
          ecosystemCounts[tag] = (ecosystemCounts[tag] || 0) + 1;
        });
      }
    });
    
    // Count registrations per project
    const regCounts = db.prepare(`
      SELECT project_id, COUNT(*) as count FROM profile_projects WHERE user_id = ? GROUP BY project_id
    `).all(req.user.id);
    
    const avgProfiles = total > 0 
      ? Math.round(regCounts.reduce((sum, r) => sum + r.count, 0) / total) 
      : 0;
    
    res.json({
      total,
      phaseDistribution,
      typeCounts,
      ecosystemCounts,
      avgProfilesPerProject: avgProfiles
    });
  } catch (err) {
    console.error('Project stats error:', err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

// GET /api/projects/
router.get('/', authMiddleware, (req, res) => {
  try {
    const { search, phase, type_tag, ecosystem_tag } = req.query;
    
    let projects = db.prepare(`SELECT * FROM projects WHERE user_id = ? 
      ORDER BY 
        CASE status WHEN 'active' THEN 0 WHEN 'waiting' THEN 1 WHEN 'ended' THEN 2 ELSE 0 END,
        priority DESC, sort_order ASC, updated_at DESC`).all(req.user.id);
    
    // Parse dates
    projects = projects.map(p => parseProjectDates(p));
    
    // Filter by search
    if (search) {
      const s = search.toLowerCase();
      projects = projects.filter(p => {
        return (
          (p.name && p.name.toLowerCase().includes(s)) ||
          (p.website && p.website.toLowerCase().includes(s)) ||
          (p.notes && p.notes.toLowerCase().includes(s)) ||
          (p.type_tags && p.type_tags.toLowerCase().includes(s)) ||
          (p.ecosystem_tags && p.ecosystem_tags.toLowerCase().includes(s))
        );
      });
    }
    
    // Filter by phase
    if (phase) {
      projects = projects.filter(p => p.phase === phase);
    }
    
    // Filter by type tag
    if (type_tag) {
      projects = projects.filter(p => {
        if (!p.type_tags) return false;
        return p.type_tags.split(',').map(t => t.trim()).includes(type_tag);
      });
    }
    
    // Filter by ecosystem tag
    if (ecosystem_tag) {
      projects = projects.filter(p => {
        if (!p.ecosystem_tags) return false;
        return p.ecosystem_tags.split(',').map(t => t.trim()).includes(ecosystem_tag);
      });
    }
    
    // Add registration count for each project
    const regCountStmt = db.prepare('SELECT COUNT(*) as count FROM profile_projects WHERE project_id = ? AND user_id = ?');
    projects = projects.map(p => ({
      ...p,
      profile_count: regCountStmt.get(p.id, req.user.id).count
    }));
    
    res.json({ projects, total: projects.length });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: '获取项目列表失败' });
  }
});

// PUT /api/projects/sort-order
router.put('/sort-order', authMiddleware, (req, res) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: '无效的排序数据' });
    const stmt = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ? AND user_id = ?');
    const update = db.transaction(() => {
      orders.forEach(o => stmt.run(o.sort_order, o.id, req.user.id));
    });
    update();
    res.json({ message: '排序已更新' });
  } catch (err) {
    res.status(500).json({ error: '更新排序失败' });
  }
});

// GET /api/projects/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    const parsed = parseProjectDates(project);
    
    // Get associated profiles with registration details
    const registrations = db.prepare(`
      SELECT pp.*, pr.nickname, pr.avatar, pr.tags as profile_tags
      FROM profile_projects pp
      JOIN profiles pr ON pp.profile_id = pr.id
      WHERE pp.project_id = ? AND pp.user_id = ?
      ORDER BY pp.updated_at DESC
    `).all(req.params.id, req.user.id);
    
    parsed.registrations = registrations.map(r => ({
      ...decryptRegistration(r, key),
      nickname: r.nickname,
      avatar: r.avatar,
      profile_tags: r.profile_tags
    }));
    
    res.json({ project: parsed });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: '获取项目详情失败' });
  }
});

// POST /api/projects/
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, website, logo, type_tags, ecosystem_tags, phase, important_dates, notes, priority, status, chain, login_devices, images } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }
    
    const imagesStr = images ? JSON.stringify(images) : null;
    const result = db.prepare(`
      INSERT INTO projects (user_id, name, website, logo, type_tags, ecosystem_tags, phase, important_dates, notes, priority, status, chain, login_devices, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      name,
      website || null,
      logo || null,
      type_tags || null,
      ecosystem_tags || null,
      phase || 'testnet',
      important_dates ? JSON.stringify(important_dates) : null,
      notes || null,
      priority || 1,
      status || 'active',
      chain || null,
      login_devices ? JSON.stringify(login_devices) : null,
      imagesStr
    );
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      message: '项目创建成功',
      project: parseProjectDates(project)
    });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: '创建项目失败' });
  }
});

// PUT /api/projects/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    const { name, website, logo, type_tags, ecosystem_tags, phase, important_dates, notes, priority, status, chain, login_devices, images } = req.body;
    
    const imagesStr = images !== undefined ? JSON.stringify(images) : existing.images;
    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        website = ?,
        logo = COALESCE(?, logo),
        type_tags = ?,
        ecosystem_tags = ?,
        phase = COALESCE(?, phase),
        important_dates = ?,
        notes = ?,
        priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        chain = ?,
        login_devices = ?,
        images = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      name || null,
      website !== undefined ? website : existing.website,
      logo !== undefined ? logo : null,
      type_tags !== undefined ? type_tags : existing.type_tags,
      ecosystem_tags !== undefined ? ecosystem_tags : existing.ecosystem_tags,
      phase || null,
      important_dates !== undefined ? (important_dates ? JSON.stringify(important_dates) : null) : existing.important_dates,
      notes !== undefined ? notes : existing.notes,
      priority !== undefined ? priority : null,
      status !== undefined ? status : null,
      chain !== undefined ? chain : existing.chain,
      login_devices !== undefined ? (login_devices ? JSON.stringify(login_devices) : null) : existing.login_devices,
      imagesStr,
      req.params.id,
      req.user.id
    );
    
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    res.json({
      message: '项目更新成功',
      project: parseProjectDates(updated)
    });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: '更新项目失败' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    // Delete associated registrations
    db.prepare('DELETE FROM profile_projects WHERE project_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    
    res.json({ message: '项目已删除' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: '删除项目失败' });
  }
});

module.exports = router;
