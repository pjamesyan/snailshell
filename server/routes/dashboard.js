const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware');
const { decryptJsonField, decryptField } = require('../crypto');
const { calculateCompleteness } = require('../utils/helpers');

function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

// GET /api/dashboard/overview
router.get('/overview', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const userId = req.user.id;
    
    // Basic counts
    const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE user_id = ?').get(userId).count;
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(userId).count;
    const registrationCount = db.prepare('SELECT COUNT(*) as count FROM profile_projects WHERE user_id = ?').get(userId).count;
    
    // Status distribution
    const statusDist = {};
    const statuses = db.prepare('SELECT status, COUNT(*) as count FROM profile_projects WHERE user_id = ? GROUP BY status').all(userId);
    statuses.forEach(s => { statusDist[s.status] = s.count; });
    
    // Calculate total investment and earnings
    const registrations = db.prepare('SELECT investment, earnings FROM profile_projects WHERE user_id = ?').all(userId);
    
    let totalInvestment = 0;
    let totalEarnings = 0;
    const currencyBreakdown = { investment: {}, earnings: {} };
    
    registrations.forEach(r => {
      if (r.investment) {
        const inv = decryptJsonField(r.investment, key);
        if (inv !== null && inv !== undefined) {
          let amount = 0;
          let currency = 'USDT';
          if (typeof inv === 'object' && inv.amount) {
            amount = parseFloat(inv.amount) || 0;
            currency = inv.currency || 'USDT';
          } else {
            amount = parseFloat(inv) || 0;
          }
          totalInvestment += amount;
          currencyBreakdown.investment[currency] = (currencyBreakdown.investment[currency] || 0) + amount;
        }
      }
      if (r.earnings) {
        const earn = decryptJsonField(r.earnings, key);
        if (earn !== null && earn !== undefined) {
          let amount = 0;
          let currency = 'USDT';
          if (typeof earn === 'object' && earn.amount) {
            amount = parseFloat(earn.amount) || 0;
            currency = earn.currency || 'USDT';
          } else {
            amount = parseFloat(earn) || 0;
          }
          totalEarnings += amount;
          currencyBreakdown.earnings[currency] = (currencyBreakdown.earnings[currency] || 0) + amount;
        }
      }
    });
    
    // Pending claim count (status = 'completed' projects that might have unclaimed rewards)
    const pendingCount = statusDist['pending'] || 0;
    
    // KYC distribution
    const kycDist = {};
    const kycStatuses = db.prepare('SELECT kyc_status, COUNT(*) as count FROM profiles WHERE user_id = ? GROUP BY kyc_status').all(userId);
    kycStatuses.forEach(s => { kycDist[s.kyc_status] = s.count; });
    
    // Average completeness
    const profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ?').all(userId);
    let totalCompleteness = 0;
    profiles.forEach(p => { totalCompleteness += calculateCompleteness(p, key); });
    const avgCompleteness = profileCount > 0 ? Math.round(totalCompleteness / profileCount) : 0;
    
    // Phase distribution
    const phaseDist = {};
    const phases = db.prepare('SELECT phase, COUNT(*) as count FROM projects WHERE user_id = ? GROUP BY phase').all(userId);
    phases.forEach(s => { phaseDist[s.phase] = s.count; });
    
    // Exchange totals
    const exchangeCount = db.prepare('SELECT COUNT(*) as count FROM exchanges WHERE user_id = ?').get(userId).count;
    const exchangeTotal = db.prepare('SELECT COALESCE(SUM(total_value_usd), 0) as total FROM exchanges WHERE user_id = ?').get(userId).total;
    
    res.json({
      profiles: profileCount,
      projects: projectCount,
      registrations: registrationCount,
      exchanges: exchangeCount,
      totalInvestment,
      totalEarnings,
      totalExchangeValue: exchangeTotal,
      roi: totalInvestment > 0 ? Math.round((totalEarnings - totalInvestment) / totalInvestment * 100) : 0,
      currencyBreakdown,
      pendingCount,
      statusDistribution: statusDist,
      kycDistribution: kycDist,
      phaseDistribution: phaseDist,
      avgCompleteness
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ error: '获取概览失败' });
  }
});

// GET /api/dashboard/upcoming
router.get('/upcoming', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const upcoming = [];
    
    // Get projects with important dates
    const projects = db.prepare('SELECT * FROM projects WHERE user_id = ? AND important_dates IS NOT NULL').all(userId);
    
    projects.forEach(p => {
      try {
        const dates = JSON.parse(p.important_dates);
        if (!Array.isArray(dates)) return;
        
        dates.forEach(d => {
          if (!d.date) return;
          const dateObj = new Date(d.date);
          const daysUntil = Math.ceil((dateObj - now) / (1000 * 60 * 60 * 24));
          
          // Show dates within next 30 days or overdue within 7 days
          if (daysUntil >= -7 && daysUntil <= 30) {
            upcoming.push({
              project_id: p.id,
              project_name: p.name,
              project_logo: p.logo,
              label: d.label,
              date: d.date,
              remind: d.remind,
              days_until: daysUntil,
              is_overdue: daysUntil < 0
            });
          }
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Sort by date (soonest first)
    upcoming.sort((a, b) => a.days_until - b.days_until);
    
    res.json({ upcoming });
  } catch (err) {
    console.error('Dashboard upcoming error:', err);
    res.status(500).json({ error: '获取即将截止项目失败' });
  }
});

// GET /api/dashboard/recent
router.get('/recent', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    
    // Recent profiles
    const recentProfiles = db.prepare(
      'SELECT id, nickname, avatar, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?'
    ).all(userId, Math.min(limit, 10));
    
    // Recent projects
    const recentProjects = db.prepare(
      'SELECT id, name, logo, phase, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?'
    ).all(userId, Math.min(limit, 10));
    
    // Recent registrations
    const recentRegistrations = db.prepare(`
      SELECT pp.id, pp.status, pp.created_at, pp.updated_at,
             pr.nickname, pr.avatar,
             p.name as project_name, p.logo as project_logo
      FROM profile_projects pp
      JOIN profiles pr ON pp.profile_id = pr.id
      JOIN projects p ON pp.project_id = p.id
      WHERE pp.user_id = ?
      ORDER BY pp.updated_at DESC
      LIMIT ?
    `).all(userId, Math.min(limit, 10));
    
    // Combine and sort all activities
    const activities = [];
    
    recentProfiles.forEach(p => {
      activities.push({
        type: 'profile',
        id: p.id,
        title: p.nickname,
        avatar: p.avatar,
        action: p.created_at === p.updated_at ? '创建身份' : '更新身份',
        timestamp: p.updated_at
      });
    });
    
    recentProjects.forEach(p => {
      activities.push({
        type: 'project',
        id: p.id,
        title: p.name,
        logo: p.logo,
        phase: p.phase,
        action: p.created_at === p.updated_at ? '创建项目' : '更新项目',
        timestamp: p.updated_at
      });
    });
    
    recentRegistrations.forEach(r => {
      activities.push({
        type: 'registration',
        id: r.id,
        title: `${r.nickname} → ${r.project_name}`,
        nickname: r.nickname,
        avatar: r.avatar,
        project_name: r.project_name,
        project_logo: r.project_logo,
        status: r.status,
        action: r.created_at === r.updated_at ? '注册项目' : '更新注册',
        timestamp: r.updated_at
      });
    });
    
    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ activities: activities.slice(0, limit) });
  } catch (err) {
    console.error('Dashboard recent error:', err);
    res.status(500).json({ error: '获取最近活动失败' });
  }
});

// GET /api/dashboard/search
router.get('/search', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    const { q } = req.query;
    if (!q || q.length < 1) return res.json({ results: [] });
    
    const userId = req.user.id;
    const s = q.toLowerCase();
    const results = [];
    
    // Search profiles by nickname, tags
    const profiles = db.prepare('SELECT id, nickname, avatar, tags FROM profiles WHERE user_id = ?').all(userId);
    profiles.forEach(p => {
      if ((p.nickname && p.nickname.toLowerCase().includes(s)) || (p.tags && p.tags.toLowerCase().includes(s))) {
        results.push({ type: 'profile', id: p.id, title: p.nickname, subtitle: p.tags, avatar: p.avatar });
      }
    });
    
    // Search projects by name, type_tags, ecosystem_tags, chain
    const projects = db.prepare('SELECT id, name, logo, type_tags, ecosystem_tags, phase, chain FROM projects WHERE user_id = ?').all(userId);
    projects.forEach(p => {
      if ((p.name && p.name.toLowerCase().includes(s)) || 
          (p.type_tags && p.type_tags.toLowerCase().includes(s)) ||
          (p.ecosystem_tags && p.ecosystem_tags.toLowerCase().includes(s)) ||
          (p.chain && p.chain.toLowerCase().includes(s))) {
        results.push({ type: 'project', id: p.id, title: p.name, subtitle: `${p.phase} ${p.chain || ''}`.trim(), logo: p.logo });
      }
    });
    
    // Search exchanges by exchange_name
    const exchanges = db.prepare('SELECT id, exchange_name, profile_id FROM exchanges WHERE user_id = ?').all(userId);
    exchanges.forEach(ex => {
      if (ex.exchange_name && ex.exchange_name.toLowerCase().includes(s)) {
        results.push({ type: 'exchange', id: ex.id, title: ex.exchange_name });
      }
    });
    
    res.json({ results: results.slice(0, 20) });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: '搜索失败' });
  }
});

module.exports = router;
