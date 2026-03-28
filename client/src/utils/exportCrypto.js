/**
 * Export encryption utilities using Web Crypto API
 * All encryption happens in the browser, password never sent to server
 */

const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt JSON data with password
 * @param {Object} data - JSON data to encrypt
 * @param {string} password - Export password
 * @returns {Object} - { encrypted: true, salt: "hex", iv: "hex", data: "hex" }
 */
export async function encryptExport(data, password) {
  if (!password || password.length < 8) {
    throw new Error('导出密码至少需要8位');
  }
  
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Derive key from password
  const key = await deriveKey(password, salt);
  
  // Encrypt data
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    plaintext
  );
  
  // Convert to hex strings
  const toHex = (arr) => Array.from(new Uint8Array(arr))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return {
    encrypted: true,
    version: '1.0',
    salt: toHex(salt),
    iv: toHex(iv),
    data: toHex(ciphertext)
  };
}

/**
 * Decrypt encrypted export data
 * @param {Object} encryptedData - { encrypted: true, salt: "hex", iv: "hex", data: "hex" }
 * @param {string} password - Export password
 * @returns {Object} - Decrypted JSON data
 */
export async function decryptExport(encryptedData, password) {
  if (!encryptedData.encrypted || !encryptedData.salt || !encryptedData.iv || !encryptedData.data) {
    throw new Error('无效的加密数据格式');
  }
  
  // Convert hex strings to Uint8Array
  const fromHex = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  };
  
  const salt = fromHex(encryptedData.salt);
  const iv = fromHex(encryptedData.iv);
  const ciphertext = fromHex(encryptedData.data);
  
  // Derive key from password
  const key = await deriveKey(password, salt);
  
  try {
    // Decrypt data
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    const json = decoder.decode(plaintext);
    return JSON.parse(json);
  } catch (err) {
    throw new Error('解密失败，密码可能不正确');
  }
}

/**
 * Check if data is encrypted
 */
export function isEncrypted(data) {
  return data && typeof data === 'object' && data.encrypted === true;
}
