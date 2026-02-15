const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { encryptField, decryptField, decryptJsonField, deriveKey } = require('../crypto');
const { authMiddleware } = require('../middleware');
const { decryptProfile, calculateCompleteness } = require('../utils/helpers');

// Get encryption key from header
function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

// GET /api/profiles/stats
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ?').all(req.user.id);
    
    const total = profiles.length;
    const kycDistribution = { none: 0, pending: 0, verified: 0 };
    let totalCompleteness = 0;
    
    profiles.forEach(p => {
      kycDistribution[p.kyc_status] = (kycDistribution[p.kyc_status] || 0) + 1;
      totalCompleteness += calculateCompleteness(p, key);
    });
    
    const avgCompleteness = total > 0 ? Math.round(totalCompleteness / total) : 0;
    
    // Tag distribution
    const tagCounts = {};
    profiles.forEach(p => {
      if (p.tags) {
        p.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    res.json({
      total,
      kycDistribution,
      avgCompleteness,
      tagCounts
    });
  } catch (err) {
    console.error('Profile stats error:', err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

// GET /api/profiles/
router.get('/', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const { search, tag, kyc_status } = req.query;
    
    let profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
    
    // Get counts for each profile
    const profilesWithCounts = profiles.map(p => {
      const registration_count = db.prepare('SELECT COUNT(*) as count FROM profile_projects WHERE profile_id = ?').get(p.id).count;
      const exchange_count = db.prepare('SELECT COUNT(*) as count FROM exchanges WHERE profile_id = ?').get(p.id).count;
      return { ...p, registration_count, exchange_count };
    });
    
    // Decrypt and filter
    let decrypted = profilesWithCounts.map(p => decryptProfile(p, key));
    
    // Filter by search (searches nickname, email, discord, twitter, telegram, phone, notes, real_name)
    if (search) {
      const s = search.toLowerCase();
      decrypted = decrypted.filter(p => {
        return (
          (p.nickname && p.nickname.toLowerCase().includes(s)) ||
          (p.real_name && p.real_name.toLowerCase().includes(s)) ||
          (p.email && p.email.toLowerCase().includes(s)) ||
          (p.discord && p.discord.toLowerCase().includes(s)) ||
          (p.twitter && p.twitter.toLowerCase().includes(s)) ||
          (p.telegram && p.telegram.toLowerCase().includes(s)) ||
          (p.phone && p.phone.includes(s)) ||
          (p.notes && p.notes.toLowerCase().includes(s))
        );
      });
    }
    
    // Filter by tag
    if (tag) {
      decrypted = decrypted.filter(p => {
        if (!p.tags) return false;
        return p.tags.split(',').map(t => t.trim()).includes(tag);
      });
    }
    
    // Filter by KYC status
    if (kyc_status) {
      decrypted = decrypted.filter(p => p.kyc_status === kyc_status);
    }
    
    res.json({ profiles: decrypted, total: decrypted.length });
  } catch (err) {
    console.error('List profiles error:', err);
    res.status(500).json({ error: '获取身份列表失败' });
  }
});

// GET /api/profiles/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!profile) {
      return res.status(404).json({ error: '身份不存在' });
    }
    
    const decrypted = decryptProfile(profile, key);
    
    // Get associated projects
    const registrations = db.prepare(`
      SELECT pp.*, p.name as project_name, p.logo as project_logo, p.phase as project_phase,
             p.type_tags as project_type_tags, p.website as project_website
      FROM profile_projects pp
      JOIN projects p ON pp.project_id = p.id
      WHERE pp.profile_id = ? AND pp.user_id = ?
      ORDER BY pp.updated_at DESC
    `).all(req.params.id, req.user.id);
    
    const { decryptRegistration } = require('../utils/helpers');
    decrypted.projects = registrations.map(r => ({
      ...decryptRegistration(r, key),
      project_name: r.project_name,
      project_logo: r.project_logo,
      project_phase: r.project_phase,
      project_type_tags: r.project_type_tags,
      project_website: r.project_website
    }));
    
    // Get referrer info
    if (profile.referrer_id) {
      const referrer = db.prepare('SELECT id, nickname, avatar FROM profiles WHERE id = ?').get(profile.referrer_id);
      decrypted.referrer = referrer || null;
    }
    
    res.json({ profile: decrypted });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: '获取身份详情失败' });
  }
});

// POST /api/profiles/
router.post('/', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const { nickname, real_name, avatar, email, discord, twitter, telegram, phone,
            email_password_hint, phone_password_hint, discord_password_hint, twitter_password_hint, telegram_password_hint,
            email_password, phone_password, discord_password, twitter_password, telegram_password,
            custom_socials, wallets, kyc_status, kyc_files, tags, referrer_id, notes, login_devices } = req.body;
    
    if (!nickname) {
      return res.status(400).json({ error: '昵称不能为空' });
    }
    
    const result = db.prepare(`
      INSERT INTO profiles (user_id, avatar, nickname, real_name, email, discord, twitter, telegram, phone,
        email_password_hint, phone_password_hint, discord_password_hint, twitter_password_hint, telegram_password_hint,
        email_password, phone_password, discord_password, twitter_password, telegram_password,
        custom_socials, wallets, kyc_status, kyc_files, tags, referrer_id, notes, login_devices)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      avatar || null,
      nickname,
      encryptField(real_name, key),
      encryptField(email, key),
      encryptField(discord, key),
      encryptField(twitter, key),
      encryptField(telegram, key),
      encryptField(phone, key),
      encryptField(email_password_hint, key),
      encryptField(phone_password_hint, key),
      encryptField(discord_password_hint, key),
      encryptField(twitter_password_hint, key),
      encryptField(telegram_password_hint, key),
      encryptField(email_password, key),
      encryptField(phone_password, key),
      encryptField(discord_password, key),
      encryptField(twitter_password, key),
      encryptField(telegram_password, key),
      custom_socials ? encryptField(JSON.stringify(custom_socials), key) : null,
      wallets ? encryptField(JSON.stringify(wallets), key) : null,
      kyc_status || 'none',
      kyc_files ? JSON.stringify(kyc_files) : null,
      tags || null,
      referrer_id || null,
      encryptField(notes, key),
      login_devices ? JSON.stringify(login_devices) : null
    );
    
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      message: '身份创建成功',
      profile: decryptProfile(profile, key)
    });
  } catch (err) {
    console.error('Create profile error:', err);
    res.status(500).json({ error: '创建身份失败' });
  }
});

// PUT /api/profiles/sort-order
router.put('/sort-order', authMiddleware, (req, res) => {
  try {
    const { orders } = req.body; // [{id, sort_order}]
    if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: '无效的排序数据' });
    const stmt = db.prepare('UPDATE profiles SET sort_order = ? WHERE id = ? AND user_id = ?');
    const update = db.transaction(() => {
      orders.forEach(o => stmt.run(o.sort_order, o.id, req.user.id));
    });
    update();
    res.json({ message: '排序已更新' });
  } catch (err) {
    res.status(500).json({ error: '更新排序失败' });
  }
});

// PUT /api/profiles/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '身份不存在' });
    }
    
    const { nickname, real_name, avatar, email, discord, twitter, telegram, phone,
            email_password_hint, phone_password_hint, discord_password_hint, twitter_password_hint, telegram_password_hint,
            email_password, phone_password, discord_password, twitter_password, telegram_password,
            custom_socials, wallets, kyc_status, kyc_files, tags, referrer_id, notes, login_devices } = req.body;
    
    db.prepare(`
      UPDATE profiles SET
        avatar = COALESCE(?, avatar),
        nickname = COALESCE(?, nickname),
        real_name = ?,
        email = ?,
        discord = ?,
        twitter = ?,
        telegram = ?,
        phone = ?,
        email_password_hint = ?,
        phone_password_hint = ?,
        discord_password_hint = ?,
        twitter_password_hint = ?,
        telegram_password_hint = ?,
        email_password = ?,
        phone_password = ?,
        discord_password = ?,
        twitter_password = ?,
        telegram_password = ?,
        custom_socials = ?,
        wallets = ?,
        kyc_status = COALESCE(?, kyc_status),
        kyc_files = COALESCE(?, kyc_files),
        tags = ?,
        referrer_id = ?,
        notes = ?,
        login_devices = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      avatar !== undefined ? avatar : null,
      nickname || null,
      real_name !== undefined ? encryptField(real_name, key) : existing.real_name,
      email !== undefined ? encryptField(email, key) : existing.email,
      discord !== undefined ? encryptField(discord, key) : existing.discord,
      twitter !== undefined ? encryptField(twitter, key) : existing.twitter,
      telegram !== undefined ? encryptField(telegram, key) : existing.telegram,
      phone !== undefined ? encryptField(phone, key) : existing.phone,
      email_password_hint !== undefined ? encryptField(email_password_hint, key) : existing.email_password_hint,
      phone_password_hint !== undefined ? encryptField(phone_password_hint, key) : existing.phone_password_hint,
      discord_password_hint !== undefined ? encryptField(discord_password_hint, key) : existing.discord_password_hint,
      twitter_password_hint !== undefined ? encryptField(twitter_password_hint, key) : existing.twitter_password_hint,
      telegram_password_hint !== undefined ? encryptField(telegram_password_hint, key) : existing.telegram_password_hint,
      email_password !== undefined ? encryptField(email_password, key) : existing.email_password,
      phone_password !== undefined ? encryptField(phone_password, key) : existing.phone_password,
      discord_password !== undefined ? encryptField(discord_password, key) : existing.discord_password,
      twitter_password !== undefined ? encryptField(twitter_password, key) : existing.twitter_password,
      telegram_password !== undefined ? encryptField(telegram_password, key) : existing.telegram_password,
      custom_socials !== undefined ? (custom_socials ? encryptField(JSON.stringify(custom_socials), key) : null) : existing.custom_socials,
      wallets !== undefined ? (wallets ? encryptField(JSON.stringify(wallets), key) : null) : existing.wallets,
      kyc_status || null,
      kyc_files !== undefined ? (kyc_files ? JSON.stringify(kyc_files) : null) : null,
      tags !== undefined ? tags : existing.tags,
      referrer_id !== undefined ? referrer_id : existing.referrer_id,
      notes !== undefined ? encryptField(notes, key) : existing.notes,
      login_devices !== undefined ? (login_devices ? JSON.stringify(login_devices) : null) : existing.login_devices,
      req.params.id,
      req.user.id
    );
    
    const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
    
    res.json({
      message: '身份更新成功',
      profile: decryptProfile(updated, key)
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: '更新身份失败' });
  }
});

// DELETE /api/profiles/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: '身份不存在' });
    }
    
    // Delete associated registrations first
    db.prepare('DELETE FROM profile_projects WHERE profile_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    
    // Clear referrer references
    db.prepare('UPDATE profiles SET referrer_id = NULL WHERE referrer_id = ?').run(req.params.id);
    db.prepare('UPDATE profile_projects SET referrer_profile_id = NULL WHERE referrer_profile_id = ?').run(req.params.id);
    
    db.prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    
    res.json({ message: '身份已删除' });
  } catch (err) {
    console.error('Delete profile error:', err);
    res.status(500).json({ error: '删除身份失败' });
  }
});

// GET /api/profiles/:id/referrals
router.get('/:id/referrals', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!profile) {
      return res.status(404).json({ error: '身份不存在' });
    }
    
    // Profiles referred by this profile
    const referrals = db.prepare('SELECT * FROM profiles WHERE referrer_id = ? AND user_id = ?').all(req.params.id, req.user.id);
    
    // Project-level referrals
    const projectReferrals = db.prepare(`
      SELECT pp.*, p.name as project_name, pr.nickname as referred_nickname
      FROM profile_projects pp
      JOIN projects p ON pp.project_id = p.id
      JOIN profiles pr ON pp.profile_id = pr.id
      WHERE pp.referrer_profile_id = ? AND pp.user_id = ?
    `).all(req.params.id, req.user.id);
    
    res.json({
      profileReferrals: referrals.map(r => decryptProfile(r, key)),
      projectReferrals: projectReferrals.map(r => ({
        ...r,
        username: decryptField(r.username, key),
        project_name: r.project_name,
        referred_nickname: r.referred_nickname
      }))
    });
  } catch (err) {
    console.error('Get referrals error:', err);
    res.status(500).json({ error: '获取推荐列表失败' });
  }
});

module.exports = router;
