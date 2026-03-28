const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db, DB_PATH, BACKUPS_DIR, DATA_DIR } = require('../db');
const { authMiddleware } = require('../middleware');
const { decryptField, decryptJsonField, encryptField } = require('../crypto');
const { decryptProfile, decryptRegistration, parseProjectDates } = require('../utils/helpers');

function getEncryptionKey(req) {
  const keyHex = req.headers['x-encryption-key'];
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

// POST /api/backup/create
router.post('/create', authMiddleware, (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}.db`;
    const backupPath = path.join(BACKUPS_DIR, backupName);
    
    // Checkpoint WAL to ensure all data is in the main db file
    db.exec('PRAGMA wal_checkpoint(FULL)');
    // Use file copy as backup (node:sqlite doesn't have backup API)
    fs.copyFileSync(DB_PATH, backupPath);
    const stats = fs.statSync(backupPath);
    res.json({
      message: '备份创建成功',
      backup: {
        name: backupName,
        size: stats.size,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: '备份失败' });
  }
});

// GET /api/backup/list
router.get('/list', authMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ backups: [] });
    }
    
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db') || f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          name: f,
          size: stats.size,
          created_at: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({ backups: files });
  } catch (err) {
    console.error('List backups error:', err);
    res.status(500).json({ error: '获取备份列表失败' });
  }
});

// POST /api/backup/restore/:name
router.post('/restore/:name', authMiddleware, (req, res) => {
  try {
    const backupName = path.basename(req.params.name);
    const backupPath = path.join(BACKUPS_DIR, backupName);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: '备份文件不存在' });
    }
    
    // Create a safety backup first
    const safetyName = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const safetyPath = path.join(BACKUPS_DIR, safetyName);
    fs.copyFileSync(DB_PATH, safetyPath);
    
    // Close current db, copy backup, reopen
    // Note: In production, you'd want to restart the server
    // For now, we copy the backup over the current db
    const { DatabaseSync } = require('node:sqlite');
    const backupDb = new DatabaseSync(backupPath, { readOnly: true });
    
    // Copy all data from backup to current db
    const restoreTransaction = db.transaction(() => {
      // Clear current data for this user
      const userId = req.user.id;
      
      // Get tables to restore
      const tables = ['profiles', 'projects', 'profile_projects', 'exchanges'];
      
      tables.forEach(table => {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      });
      
      // Copy data from backup
      tables.forEach(table => {
        const rows = backupDb.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).all(userId);
        if (rows.length === 0) return;
        
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(',');
        const insertStmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);
        
        rows.forEach(row => {
          insertStmt.run(...columns.map(c => row[c]));
        });
      });
    });
    
    restoreTransaction();
    backupDb.close();
    
    res.json({
      message: '恢复成功',
      safetyBackup: safetyName
    });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: '恢复失败: ' + err.message });
  }
});

// DELETE /api/backup/:name
router.delete('/:name', authMiddleware, (req, res) => {
  try {
    const backupName = path.basename(req.params.name);
    const backupPath = path.join(BACKUPS_DIR, backupName);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: '备份文件不存在' });
    }
    
    fs.unlinkSync(backupPath);
    
    res.json({ message: '备份已删除' });
  } catch (err) {
    console.error('Delete backup error:', err);
    res.status(500).json({ error: '删除备份失败' });
  }
});

// GET /api/backup/export/json
router.get('/export/json', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const userId = req.user.id;
    
    const profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ?').all(userId);
    const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(userId);
    const registrations = db.prepare('SELECT * FROM profile_projects WHERE user_id = ?').all(userId);
    const exchanges = db.prepare('SELECT * FROM exchanges WHERE user_id = ?').all(userId);
    
    const exportData = {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      profiles: profiles.map(p => decryptProfile(p, key)),
      projects: projects.map(p => parseProjectDates(p)),
      registrations: registrations.map(r => decryptRegistration(r, key)),
      exchanges: exchanges.map(ex => ({
        ...ex,
        account_email: decryptField(ex.account_email, key),
        password_hint: decryptField(ex.password_hint, key),
        api_key_note: decryptField(ex.api_key_note, key),
        assets: decryptJsonField(ex.assets, key),
        notes: decryptField(ex.notes, key),
        exchange_uid: decryptField(ex.exchange_uid, key),
        deposit_addresses: decryptJsonField(ex.deposit_addresses, key),
        referral_link: decryptField(ex.referral_link, key),
        referral_code: decryptField(ex.referral_code, key),
        login_devices: ex.login_devices ? JSON.parse(ex.login_devices) : [],
        screenshots: ex.screenshots ? (typeof ex.screenshots === 'string' ? JSON.parse(ex.screenshots) : ex.screenshots) : [],
      }))
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=account-manager-export-${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);
  } catch (err) {
    console.error('Export JSON error:', err);
    res.status(500).json({ error: '导出失败' });
  }
});

// GET /api/backup/export/csv
router.get('/export/csv', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const userId = req.user.id;
    const { sections = 'profiles,projects,registrations,exchanges', includePasswordHints = 'false' } = req.query;
    const sectionList = sections.split(',').map(s => s.trim());
    const showPasswordHints = includePasswordHints === 'true';
    
    // Build CSV
    let csv = '\uFEFF'; // BOM for Excel UTF-8
    
    // Profiles section
    if (sectionList.includes('profiles')) {
      const profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ?').all(userId);
      csv += '=== 身份列表 ===\n';
      if (showPasswordHints) {
        csv += '昵称,实名,邮箱,邮箱密码提示,Discord,Discord密码提示,Twitter,Twitter密码提示,Telegram,Telegram密码提示,手机,手机密码提示,KYC状态,标签,登录设备,创建时间\n';
      } else {
        csv += '昵称,实名,邮箱,Discord,Twitter,Telegram,手机,KYC状态,标签,登录设备,创建时间\n';
      }
      profiles.forEach(p => {
        const d = decryptProfile(p, key);
        const devices = p.login_devices ? JSON.parse(p.login_devices).join('; ') : '';
        if (showPasswordHints) {
          csv += `"${d.nickname || ''}","${d.real_name || ''}","${d.email || ''}","${d.email_password_hint || ''}","${d.discord || ''}","${d.discord_password_hint || ''}","${d.twitter || ''}","${d.twitter_password_hint || ''}","${d.telegram || ''}","${d.telegram_password_hint || ''}","${d.phone || ''}","${d.phone_password_hint || ''}","${d.kyc_status}","${d.tags || ''}","${devices}","${d.created_at}"\n`;
        } else {
          csv += `"${d.nickname || ''}","${d.real_name || ''}","${d.email || ''}","${d.discord || ''}","${d.twitter || ''}","${d.telegram || ''}","${d.phone || ''}","${d.kyc_status}","${d.tags || ''}","${devices}","${d.created_at}"\n`;
        }
      });
      csv += '\n';
    }
    
    // Projects section
    if (sectionList.includes('projects')) {
      const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(userId);
      csv += '=== 项目列表 ===\n';
      csv += '项目名,网站,类型标签,生态标签,阶段,链,登录设备,创建时间\n';
      projects.forEach(p => {
        const devices = p.login_devices ? JSON.parse(p.login_devices).join('; ') : '';
        csv += `"${p.name}","${p.website || ''}","${p.type_tags || ''}","${p.ecosystem_tags || ''}","${p.phase}","${p.chain || ''}","${devices}","${p.created_at}"\n`;
      });
      csv += '\n';
    }
    
    // Registrations section
    if (sectionList.includes('registrations')) {
      const registrations = db.prepare(`
        SELECT pp.*, pr.nickname, p.name as project_name
        FROM profile_projects pp
        JOIN profiles pr ON pp.profile_id = pr.id
        JOIN projects p ON pp.project_id = p.id
        WHERE pp.user_id = ?
      `).all(userId);
      csv += '=== 注册记录 ===\n';
      if (showPasswordHints) {
        csv += '身份,项目,账号,密码提示,状态,投入,收益,注册时间\n';
      } else {
        csv += '身份,项目,账号,状态,投入,收益,注册时间\n';
      }
      registrations.forEach(r => {
        const d = decryptRegistration(r, key);
        let inv = '';
        if (d.investment) {
          if (typeof d.investment === 'object' && d.investment.amount) {
            inv = `${d.investment.amount}${d.investment.currency || ''}`;
          } else {
            inv = String(d.investment);
          }
        }
        let earn = '';
        if (d.earnings) {
          if (typeof d.earnings === 'object' && d.earnings.amount) {
            earn = `${d.earnings.amount}${d.earnings.currency || ''}`;
          } else {
            earn = String(d.earnings);
          }
        }
        if (showPasswordHints) {
          csv += `"${r.nickname}","${r.project_name}","${d.username || ''}","${d.password_hint || ''}","${d.status}","${inv}","${earn}","${d.registered_at || ''}"\n`;
        } else {
          csv += `"${r.nickname}","${r.project_name}","${d.username || ''}","${d.status}","${inv}","${earn}","${d.registered_at || ''}"\n`;
        }
      });
      csv += '\n';
    }
    
    // Exchanges section
    if (sectionList.includes('exchanges')) {
      const csvExchanges = db.prepare(`
        SELECT e.*, pr.nickname
        FROM exchanges e
        JOIN profiles pr ON e.profile_id = pr.id
        WHERE e.user_id = ?
      `).all(userId);
      csv += '=== 交易所列表 ===\n';
      if (showPasswordHints) {
        csv += '身份,交易所,UID,账户邮箱,密码提示,KYC状态,充值地址,邀请链接,邀请码,登录设备,总估值USD,创建时间\n';
      } else {
        csv += '身份,交易所,UID,账户邮箱,KYC状态,充值地址,邀请链接,邀请码,登录设备,总估值USD,创建时间\n';
      }
      csvExchanges.forEach(ex => {
        const uid = decryptField(ex.exchange_uid, key) || '';
        const depositAddrs = ex.deposit_addresses ? JSON.parse(decryptField(ex.deposit_addresses, key) || '[]').map(d => `${d.chain}:${d.address}`).join('; ') : '';
        const devices = ex.login_devices ? JSON.parse(ex.login_devices).join('; ') : '';
        const refLink = decryptField(ex.referral_link, key) || '';
        const refCode = decryptField(ex.referral_code, key) || '';
        if (showPasswordHints) {
          csv += `"${ex.nickname}","${ex.exchange_name}","${uid}","${decryptField(ex.account_email, key) || ''}","${decryptField(ex.password_hint, key) || ''}","${ex.kyc_status}","${depositAddrs}","${refLink}","${refCode}","${devices}","${ex.total_value_usd || 0}","${ex.created_at}"\n`;
        } else {
          csv += `"${ex.nickname}","${ex.exchange_name}","${uid}","${decryptField(ex.account_email, key) || ''}","${ex.kyc_status}","${depositAddrs}","${refLink}","${refCode}","${devices}","${ex.total_value_usd || 0}","${ex.created_at}"\n`;
        }
      });
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=account-manager-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: '导出CSV失败' });
  }
});

// POST /api/backup/import/json
router.post('/import/json', authMiddleware, (req, res) => {
  try {
    const key = getEncryptionKey(req);
    if (!key) return res.status(400).json({ error: '缺少加密密钥' });
    
    const { data, mode } = req.body;  // mode: 'merge' (default) | 'overwrite'
    if (!data || !data.profiles) {
      return res.status(400).json({ error: '无效的导入数据' });
    }
    
    const userId = req.user.id;
    let importedProfiles = 0;
    let importedProjects = 0;
    let importedRegistrations = 0;
    let importedExchanges = 0;
    let skippedProfiles = 0;
    let skippedProjects = 0;
    let skippedExchanges = 0;
    
    // Map old IDs to new IDs
    const profileIdMap = {};
    const projectIdMap = {};
    
    const importTransaction = db.transaction(() => {
      // If overwrite mode, clear existing data first
      if (mode === 'overwrite') {
        db.prepare('DELETE FROM profile_projects WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM exchanges WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM profiles WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM projects WHERE user_id = ?').run(userId);
      }

      // Import profiles (deduplicate by nickname)
      if (data.profiles && Array.isArray(data.profiles)) {
        for (const p of data.profiles) {
          // Check for existing profile with same nickname
          const existing = db.prepare('SELECT id FROM profiles WHERE user_id = ? AND nickname = ?')
            .get(userId, p.nickname);
          if (existing) {
            profileIdMap[p.id] = existing.id;
            skippedProfiles++;
            continue;
          }
          
          const result = db.prepare(`
            INSERT INTO profiles (user_id, avatar, nickname, real_name, email, discord, twitter, telegram, phone,
              email_password_hint, phone_password_hint, discord_password_hint, twitter_password_hint, telegram_password_hint,
              custom_socials, wallets, kyc_status, kyc_files, tags, notes, login_devices)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            p.avatar || null,
            p.nickname || 'Imported',
            p.real_name ? encryptField(p.real_name, key) : null,
            encryptField(p.email, key),
            encryptField(p.discord, key),
            encryptField(p.twitter, key),
            encryptField(p.telegram, key),
            encryptField(p.phone, key),
            encryptField(p.email_password_hint, key),
            encryptField(p.phone_password_hint, key),
            encryptField(p.discord_password_hint, key),
            encryptField(p.twitter_password_hint, key),
            encryptField(p.telegram_password_hint, key),
            p.custom_socials ? encryptField(JSON.stringify(p.custom_socials), key) : null,
            p.wallets ? encryptField(JSON.stringify(p.wallets), key) : null,
            p.kyc_status || 'none',
            p.kyc_files ? JSON.stringify(p.kyc_files) : null,
            p.tags || null,
            encryptField(p.notes, key),
            p.login_devices ? JSON.stringify(p.login_devices) : null
          );
          profileIdMap[p.id] = result.lastInsertRowid;
          importedProfiles++;
        }
      }
      
      // Import projects (deduplicate by name)
      if (data.projects && Array.isArray(data.projects)) {
        for (const p of data.projects) {
          const existing = db.prepare('SELECT id FROM projects WHERE user_id = ? AND name = ?')
            .get(userId, p.name);
          if (existing) {
            projectIdMap[p.id] = existing.id;
            skippedProjects++;
            continue;
          }
          
          const result = db.prepare(`
            INSERT INTO projects (user_id, name, website, logo, type_tags, ecosystem_tags, phase, important_dates, notes, priority, status, chain, login_devices)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            p.name,
            p.website || null,
            p.logo || null,
            p.type_tags || null,
            p.ecosystem_tags || null,
            p.phase || 'testnet',
            p.important_dates ? JSON.stringify(p.important_dates) : null,
            p.notes || null,
            p.priority || 'medium',
            p.status || 'active',
            p.chain || null,
            p.login_devices ? JSON.stringify(p.login_devices) : null
          );
          projectIdMap[p.id] = result.lastInsertRowid;
          importedProjects++;
        }
      }
      
      // Import registrations (deduplicate by profile_id + project_id)
      if (data.registrations && Array.isArray(data.registrations)) {
        for (const r of data.registrations) {
          const newProfileId = profileIdMap[r.profile_id];
          const newProjectId = projectIdMap[r.project_id];
          
          if (!newProfileId || !newProjectId) continue;
          
          const existing = db.prepare('SELECT id FROM profile_projects WHERE profile_id = ? AND project_id = ?')
            .get(newProfileId, newProjectId);
          if (existing) continue;
          
          db.prepare(`
            INSERT INTO profile_projects (user_id, profile_id, project_id, username, password_hint,
              screenshots, status, investment, earnings, timeline, notes, registered_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            newProfileId,
            newProjectId,
            encryptField(r.username, key),
            encryptField(r.password_hint, key),
            r.screenshots ? JSON.stringify(r.screenshots) : null,
            r.status || 'registered',
            r.investment ? encryptField(JSON.stringify(r.investment), key) : null,
            r.earnings ? encryptField(JSON.stringify(r.earnings), key) : null,
            r.timeline ? JSON.stringify(r.timeline) : '[]',
            encryptField(r.notes, key),
            r.registered_at || new Date().toISOString()
          );
          importedRegistrations++;
        }
      }
      
      // Import exchanges (deduplicate by profile_id + exchange_name)
      if (data.exchanges && Array.isArray(data.exchanges)) {
        for (const ex of data.exchanges) {
          const newProfileId = profileIdMap[ex.profile_id];
          if (!newProfileId) continue;
          
          const existing = db.prepare('SELECT id FROM exchanges WHERE user_id = ? AND profile_id = ? AND exchange_name = ?')
            .get(userId, newProfileId, ex.exchange_name);
          if (existing) {
            skippedExchanges++;
            continue;
          }
          
          db.prepare(`
            INSERT INTO exchanges (user_id, profile_id, exchange_name, account_email, password_hint,
              kyc_status, api_key_note, assets, total_value_usd, notes, exchange_uid, deposit_addresses, login_devices, referral_link, referral_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            newProfileId,
            ex.exchange_name,
            encryptField(ex.account_email, key),
            encryptField(ex.password_hint, key),
            ex.kyc_status || 'none',
            encryptField(ex.api_key_note, key),
            ex.assets ? encryptField(JSON.stringify(ex.assets), key) : null,
            ex.total_value_usd || 0,
            encryptField(ex.notes, key),
            ex.exchange_uid ? encryptField(ex.exchange_uid, key) : null,
            ex.deposit_addresses ? encryptField(JSON.stringify(ex.deposit_addresses), key) : null,
            ex.login_devices ? JSON.stringify(ex.login_devices) : null,
            ex.referral_link ? encryptField(ex.referral_link, key) : null,
            ex.referral_code ? encryptField(ex.referral_code, key) : null
          );
          importedExchanges++;
        }
      }
    });
    
    importTransaction();
    
    const skippedTotal = skippedProfiles + skippedProjects + skippedExchanges;
    res.json({
      message: skippedTotal > 0 
        ? `导入成功（跳过 ${skippedTotal} 条重复记录）` 
        : '导入成功',
      imported: {
        profiles: importedProfiles,
        projects: importedProjects,
        registrations: importedRegistrations,
        exchanges: importedExchanges
      },
      skipped: {
        profiles: skippedProfiles,
        projects: skippedProjects,
        exchanges: skippedExchanges
      }
    });
  } catch (err) {
    console.error('Import JSON error:', err);
    res.status(500).json({ error: '导入失败: ' + err.message });
  }
});

module.exports = router;
