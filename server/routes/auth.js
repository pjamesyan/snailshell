const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { db } = require('../db');
const { deriveKey, generateSalt, encryptField, decryptField, NEW_ITERATIONS } = require('../crypto');
const { authMiddleware, generateToken } = require('../middleware');

// Login failure tracking (in-memory)
const loginFailures = new Map(); // username -> { count, lockedUntil }
const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Password strength validation
function validatePasswordStrength(password) {
  if (password.length < 8) return '密码至少需要8位';
  if (!/[A-Z]/.test(password)) return '密码需要包含至少一个大写字母';
  if (!/[a-z]/.test(password)) return '密码需要包含至少一个小写字母';
  if (!/[0-9]/.test(password)) return '密码需要包含至少一个数字';
  return null;
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: '用户名长度需在3-50之间' });
    }
    
    // Password strength check
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }
    
    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    
    const passwordHash = bcrypt.hashSync(password, 12);
    const encryptionSalt = generateSalt();
    
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, encryption_salt, pbkdf2_iterations) VALUES (?, ?, ?, ?)'
    ).run(username, passwordHash, encryptionSalt, NEW_ITERATIONS);
    
    const user = { id: result.lastInsertRowid, username };
    const token = generateToken(user);
    
    // Derive encryption key with new iterations
    const encryptionKey = deriveKey(password, encryptionSalt, NEW_ITERATIONS);
    
    res.status(201).json({
      message: '注册成功',
      token,
      user: { id: user.id, username: user.username },
      encryptionKey: encryptionKey.toString('hex')
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password, totpCode } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    // Check login lock
    const failureRecord = loginFailures.get(username);
    if (failureRecord && failureRecord.lockedUntil > Date.now()) {
      const remainingMs = failureRecord.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(429).json({ 
        error: `登录已锁定，请在 ${remainingMin} 分钟后重试`,
        lockedUntil: failureRecord.lockedUntil
      });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      // Record failure
      const record = loginFailures.get(username) || { count: 0, lockedUntil: 0 };
      record.count++;
      if (record.count >= MAX_FAILURES) {
        record.lockedUntil = Date.now() + LOCK_DURATION_MS;
      }
      loginFailures.set(username, record);
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      // Record failure
      const record = loginFailures.get(username) || { count: 0, lockedUntil: 0 };
      record.count++;
      if (record.count >= MAX_FAILURES) {
        record.lockedUntil = Date.now() + LOCK_DURATION_MS;
        loginFailures.set(username, record);
        return res.status(429).json({ 
          error: `密码错误次数过多，账号已锁定 15 分钟`,
          lockedUntil: record.lockedUntil
        });
      }
      loginFailures.set(username, record);
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // Get user's PBKDF2 iterations (default to old value if not set)
    const iterations = user.pbkdf2_iterations || 100000;
    const encryptionKey = deriveKey(password, user.encryption_salt, iterations);
    
    // Check 2FA if enabled
    if (user.totp_enabled) {
      if (!totpCode) {
        return res.status(200).json({ requires2FA: true, message: '请输入2FA验证码' });
      }
      
      // Decrypt totp_secret if encrypted
      let totpSecret = user.totp_secret;
      if (totpSecret && totpSecret.includes(':')) {
        // Encrypted format
        totpSecret = decryptField(totpSecret, encryptionKey);
        if (!totpSecret) {
          return res.status(500).json({ error: '2FA密钥解密失败，请联系管理员' });
        }
      }
      
      const verified = speakeasy.totp.verify({
        secret: totpSecret,
        encoding: 'base32',
        token: totpCode,
        window: 2
      });
      
      if (!verified) {
        return res.status(401).json({ error: '2FA验证码错误，请检查手机时间是否准确' });
      }
    }
    
    // Clear login failures on success
    loginFailures.delete(username);
    
    const token = generateToken(user);
    
    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        totp_enabled: !!user.totp_enabled
      },
      encryptionKey: encryptionKey.toString('hex')
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, totp_enabled, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: { ...user, totpEnabled: !!user.totp_enabled } });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// POST /api/auth/2fa/setup
router.post('/2fa/setup', authMiddleware, (req, res) => {
  try {
    const keyHex = req.headers['x-encryption-key'];
    if (!keyHex) {
      return res.status(400).json({ error: '缺少加密密钥，请重新登录' });
    }
    const encryptionKey = Buffer.from(keyHex, 'hex');
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA已启用' });
    }
    
    const secret = speakeasy.generateSecret({
      name: `AccountManager:${user.username}`,
      issuer: 'AccountManager'
    });
    
    // Encrypt and store secret
    const encryptedSecret = encryptField(secret.base32, encryptionKey);
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(encryptedSecret, user.id);
    
    // Generate QR code
    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) {
        return res.status(500).json({ error: '生成二维码失败' });
      }
      
      res.json({
        secret: secret.base32,
        qrCode: dataUrl,
        message: '请扫描二维码并输入验证码确认'
      });
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: '设置2FA失败' });
  }
});

// POST /api/auth/2fa/verify
router.post('/2fa/verify', authMiddleware, (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: '请输入验证码' });
    }
    
    const keyHex = req.headers['x-encryption-key'];
    if (!keyHex) {
      return res.status(400).json({ error: '缺少加密密钥，请重新登录' });
    }
    const encryptionKey = Buffer.from(keyHex, 'hex');
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user.totp_secret) {
      return res.status(400).json({ error: '请先设置2FA' });
    }
    
    // Decrypt totp_secret
    const totpSecret = decryptField(user.totp_secret, encryptionKey);
    if (!totpSecret) {
      return res.status(500).json({ error: '2FA密钥解密失败' });
    }
    
    const verified = speakeasy.totp.verify({
      secret: totpSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });
    
    if (!verified) {
      return res.status(400).json({ error: '验证码错误，请检查手机时间是否准确' });
    }
    
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
    
    res.json({ message: '2FA已启用' });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ error: '验证2FA失败' });
  }
});

// POST /api/auth/2fa/disable
router.post('/2fa/disable', authMiddleware, (req, res) => {
  try {
    const { password, code } = req.body;
    if (!password || !code) {
      return res.status(400).json({ error: '请输入密码和2FA验证码' });
    }
    
    const keyHex = req.headers['x-encryption-key'];
    if (!keyHex) {
      return res.status(400).json({ error: '缺少加密密钥，请重新登录' });
    }
    const encryptionKey = Buffer.from(keyHex, 'hex');
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '密码错误' });
    }
    
    if (!user.totp_enabled) {
      return res.status(400).json({ error: '2FA未启用' });
    }
    
    // Decrypt totp_secret
    const totpSecret = decryptField(user.totp_secret, encryptionKey);
    if (!totpSecret) {
      return res.status(500).json({ error: '2FA密钥解密失败' });
    }
    
    const verified = speakeasy.totp.verify({
      secret: totpSecret,
      encoding: 'base32',
      token: code,
      window: 1
    });
    
    if (!verified) {
      return res.status(400).json({ error: '2FA验证码错误' });
    }
    
    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(user.id);
    
    res.json({ message: '2FA已禁用' });
  } catch (err) {
    console.error('2FA disable error:', err);
    res.status(500).json({ error: '禁用2FA失败' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请输入旧密码和新密码' });
    }
    
    // Password strength check
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(401).json({ error: '旧密码错误' });
    }
    
    // Get old iterations
    const oldIterations = user.pbkdf2_iterations || 100000;
    
    // Re-encrypt all data with new key
    const oldKey = deriveKey(oldPassword, user.encryption_salt, oldIterations);
    const newSalt = generateSalt();
    const newKey = deriveKey(newPassword, newSalt, NEW_ITERATIONS);
    const newHash = bcrypt.hashSync(newPassword, 12);
    
    const { decrypt, encrypt } = require('../crypto');
    
    // Re-encrypt profiles
    const profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ?').all(user.id);
    const encryptedFields = ['email', 'discord', 'twitter', 'telegram', 'phone', 'custom_socials', 'wallets', 'notes', 'real_name',
      'email_password_hint', 'phone_password_hint', 'discord_password_hint', 'twitter_password_hint', 'telegram_password_hint',
      'email_password', 'phone_password', 'discord_password', 'twitter_password', 'telegram_password'];
    
    const updateProfile = db.prepare(
      `UPDATE profiles SET email=?, discord=?, twitter=?, telegram=?, phone=?, custom_socials=?, wallets=?, notes=?, real_name=?,
       email_password_hint=?, phone_password_hint=?, discord_password_hint=?, twitter_password_hint=?, telegram_password_hint=?,
       email_password=?, phone_password=?, discord_password=?, twitter_password=?, telegram_password=? WHERE id=?`
    );
    
    const updateReg = db.prepare(
      `UPDATE profile_projects SET username=?, password_hint=?, investment=?, earnings=?, notes=? WHERE id=?`
    );
    
    const reEncrypt = db.transaction(() => {
      // Re-encrypt profiles
      for (const profile of profiles) {
        const decrypted = encryptedFields.map(f => decrypt(profile[f], oldKey));
        const reEncrypted = decrypted.map(v => v !== null ? encrypt(v, newKey) : null);
        updateProfile.run(...reEncrypted, profile.id);
      }
      
      // Re-encrypt registrations
      const regs = db.prepare('SELECT * FROM profile_projects WHERE user_id = ?').all(user.id);
      const regFields = ['username', 'password_hint', 'investment', 'earnings', 'notes'];
      
      for (const reg of regs) {
        const decrypted = regFields.map(f => decrypt(reg[f], oldKey));
        const reEncrypted = decrypted.map(v => v !== null ? encrypt(v, newKey) : null);
        updateReg.run(...reEncrypted, reg.id);
      }
      
      // Re-encrypt 2FA secret if exists
      let newTotpSecret = null;
      if (user.totp_secret) {
        const decryptedTotp = decrypt(user.totp_secret, oldKey);
        if (decryptedTotp) {
          newTotpSecret = encrypt(decryptedTotp, newKey);
        }
      }
      
      // Update user with new iterations
      db.prepare('UPDATE users SET password_hash = ?, encryption_salt = ?, pbkdf2_iterations = ?, totp_secret = ? WHERE id = ?')
        .run(newHash, newSalt, NEW_ITERATIONS, newTotpSecret, user.id);
    });
    
    reEncrypt();
    
    const token = generateToken(user);
    const encryptionKey = deriveKey(newPassword, newSalt, NEW_ITERATIONS);
    
    res.json({
      message: '密码修改成功，所有数据已重新加密',
      token,
      encryptionKey: encryptionKey.toString('hex')
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: '修改密码失败' });
  }
});

module.exports = router;
