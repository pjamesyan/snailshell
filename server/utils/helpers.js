const { decryptField, decryptJsonField } = require('../crypto');

/**
 * Calculate profile completeness score (0-100)
 */
function calculateCompleteness(profile, encryptionKey) {
  let score = 0;
  
  if (profile.avatar) score += 5;
  if (decryptField(profile.email, encryptionKey)) score += 10;
  if (decryptField(profile.discord, encryptionKey)) score += 10;
  if (decryptField(profile.twitter, encryptionKey)) score += 10;
  if (decryptField(profile.telegram, encryptionKey)) score += 10;
  if (decryptField(profile.phone, encryptionKey)) score += 5;
  
  const wallets = decryptJsonField(profile.wallets, encryptionKey);
  if (wallets && Array.isArray(wallets) && wallets.length > 0) score += 15;
  
  if (profile.kyc_status === 'verified') score += 20;
  if (profile.tags && profile.tags.trim()) score += 5;
  if (decryptField(profile.notes, encryptionKey)) score += 10;
  
  return score;
}

/**
 * Decrypt profile fields for API response
 */
function decryptProfile(profile, encryptionKey) {
  if (!profile) return null;
  
  return {
    ...profile,
    real_name: decryptField(profile.real_name, encryptionKey),
    email: decryptField(profile.email, encryptionKey),
    discord: decryptField(profile.discord, encryptionKey),
    twitter: decryptField(profile.twitter, encryptionKey),
    telegram: decryptField(profile.telegram, encryptionKey),
    phone: decryptField(profile.phone, encryptionKey),
    email_password_hint: decryptField(profile.email_password_hint, encryptionKey),
    phone_password_hint: decryptField(profile.phone_password_hint, encryptionKey),
    discord_password_hint: decryptField(profile.discord_password_hint, encryptionKey),
    twitter_password_hint: decryptField(profile.twitter_password_hint, encryptionKey),
    telegram_password_hint: decryptField(profile.telegram_password_hint, encryptionKey),
    email_password: decryptField(profile.email_password, encryptionKey),
    phone_password: decryptField(profile.phone_password, encryptionKey),
    discord_password: decryptField(profile.discord_password, encryptionKey),
    twitter_password: decryptField(profile.twitter_password, encryptionKey),
    telegram_password: decryptField(profile.telegram_password, encryptionKey),
    custom_socials: decryptJsonField(profile.custom_socials, encryptionKey),
    wallets: decryptJsonField(profile.wallets, encryptionKey),
    notes: decryptField(profile.notes, encryptionKey),
    kyc_files: profile.kyc_files ? JSON.parse(profile.kyc_files) : [],
    login_devices: profile.login_devices ? JSON.parse(profile.login_devices) : [],
    completeness: calculateCompleteness(profile, encryptionKey)
  };
}

/**
 * Decrypt registration (profile_project) fields for API response
 */
function decryptRegistration(reg, encryptionKey) {
  if (!reg) return null;
  
  return {
    ...reg,
    username: decryptField(reg.username, encryptionKey),
    password_hint: decryptField(reg.password_hint, encryptionKey),
    investment: decryptJsonField(reg.investment, encryptionKey),
    earnings: decryptJsonField(reg.earnings, encryptionKey),
    notes: decryptField(reg.notes, encryptionKey),
    screenshots: reg.screenshots ? JSON.parse(reg.screenshots) : [],
    timeline: reg.timeline ? JSON.parse(reg.timeline) : []
  };
}

/**
 * Parse important_dates JSON field
 */
function parseProjectDates(project) {
  if (!project) return null;
  return {
    ...project,
    important_dates: project.important_dates ? JSON.parse(project.important_dates) : [],
    login_devices: project.login_devices ? JSON.parse(project.login_devices) : [],
    images: project.images ? JSON.parse(project.images) : []
  };
}

/**
 * Paginate results (not used currently but available)
 */
function paginate(items, page = 1, limit = 50) {
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    items: items.slice(start, end),
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit)
  };
}

module.exports = {
  calculateCompleteness,
  decryptProfile,
  decryptRegistration,
  parseProjectDates,
  paginate
};
