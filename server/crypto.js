const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000; // Old default
const NEW_ITERATIONS = 600000; // New secure default

/**
 * Derive encryption key from master password + salt
 */
function deriveKey(masterPassword, salt, iterations = ITERATIONS) {
  const saltBuf = Buffer.from(salt, 'hex');
  return crypto.pbkdf2Sync(masterPassword, saltBuf, iterations, KEY_LENGTH, 'sha512');
}

/**
 * Generate a random salt
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns: iv:encrypted:tag (all hex)
 */
function encrypt(plaintext, key) {
  if (!plaintext && plaintext !== '') return null;
  if (plaintext === null || plaintext === undefined) return null;
  
  const text = String(plaintext);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Input format: iv:encrypted:tag (all hex)
 */
function decrypt(ciphertext, key) {
  if (!ciphertext) return null;
  
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return null;
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}

/**
 * Encrypt a field - convenience wrapper
 */
function encryptField(value, key) {
  if (value === null || value === undefined || value === '') return null;
  return encrypt(typeof value === 'object' ? JSON.stringify(value) : String(value), key);
}

/**
 * Decrypt a field - convenience wrapper
 */
function decryptField(value, key) {
  if (!value) return null;
  return decrypt(value, key);
}

/**
 * Decrypt a JSON field
 */
function decryptJsonField(value, key) {
  const decrypted = decryptField(value, key);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

module.exports = {
  deriveKey,
  generateSalt,
  encrypt,
  decrypt,
  encryptField,
  decryptField,
  decryptJsonField,
  ALGORITHM,
  IV_LENGTH,
  TAG_LENGTH,
  SALT_LENGTH,
  KEY_LENGTH,
  ITERATIONS,
  NEW_ITERATIONS
};
