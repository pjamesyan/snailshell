const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'accounts.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, AVATARS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const db = new DatabaseSync(DB_PATH);

// Wrap prepare to auto-convert undefined to null (node:sqlite doesn't accept undefined)
const originalPrepare = db.prepare.bind(db);
db.prepare = function(sql) {
  const stmt = originalPrepare(sql);
  const originalRun = stmt.run.bind(stmt);
  const originalGet = stmt.get.bind(stmt);
  const originalAll = stmt.all.bind(stmt);
  
  const sanitize = (args) => args.map(a => a === undefined ? null : a);
  
  stmt.run = function(...args) { return originalRun(...sanitize(args)); };
  stmt.get = function(...args) { return originalGet(...sanitize(args)); };
  stmt.all = function(...args) { return originalAll(...sanitize(args)); };
  return stmt;
};

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Add transaction() method for compatibility with better-sqlite3
db.transaction = function(fn) {
  return function(...args) {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
};

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    totp_enabled INTEGER DEFAULT 0,
    encryption_salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    avatar TEXT,
    nickname TEXT NOT NULL,
    email TEXT,
    discord TEXT,
    twitter TEXT,
    telegram TEXT,
    phone TEXT,
    custom_socials TEXT,
    wallets TEXT,
    kyc_status TEXT DEFAULT 'none',
    kyc_files TEXT,
    tags TEXT,
    referrer_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referrer_id) REFERENCES profiles(id) ON DELETE SET NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    website TEXT,
    logo TEXT,
    type_tags TEXT,
    ecosystem_tags TEXT,
    phase TEXT DEFAULT 'testnet',
    important_dates TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS profile_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    username TEXT,
    password_hint TEXT,
    screenshots TEXT,
    status TEXT DEFAULT 'registered',
    investment TEXT,
    earnings TEXT,
    timeline TEXT,
    referrer_profile_id INTEGER,
    notes TEXT,
    registered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (referrer_profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE(profile_id, project_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS exchanges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile_id INTEGER NOT NULL,
    exchange_name TEXT NOT NULL,
    account_email TEXT,
    password_hint TEXT,
    kyc_status TEXT DEFAULT 'none',
    api_key_note TEXT,
    assets TEXT,
    total_value_usd REAL DEFAULT 0,
    screenshots TEXT,
    notes TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_profile_projects_user_id ON profile_projects(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_profile_projects_profile_id ON profile_projects(profile_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_profile_projects_project_id ON profile_projects(project_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_exchanges_user_id ON exchanges(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_exchanges_profile_id ON exchanges(profile_id)`);

// Migration helper
function getColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

// Migration: add password hint columns to profiles
const profileColumns = getColumns('profiles');
const newCols = [
  'email_password_hint', 'phone_password_hint',
  'discord_password_hint', 'twitter_password_hint', 'telegram_password_hint',
  'email_password', 'phone_password',
  'discord_password', 'twitter_password', 'telegram_password'
];
for (const col of newCols) {
  if (!profileColumns.includes(col)) {
    db.exec(`ALTER TABLE profiles ADD COLUMN ${col} TEXT`);
  }
}

// Migration: add sort_order to profiles, projects, exchanges
const addSortOrder = (table) => {
  const cols = getColumns(table);
  if (!cols.includes('sort_order')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN sort_order INTEGER DEFAULT 0`);
  }
};
addSortOrder('profiles');
addSortOrder('projects');
addSortOrder('exchanges');

// Migration: add project fields (priority, status, chain)
const projectCols = getColumns('projects');
if (!projectCols.includes('priority')) db.exec(`ALTER TABLE projects ADD COLUMN priority INTEGER DEFAULT 1`);
if (!projectCols.includes('status')) db.exec(`ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'`);
if (!projectCols.includes('chain')) db.exec(`ALTER TABLE projects ADD COLUMN chain TEXT`);

// Migration: add completeness to profiles
if (!getColumns('profiles').includes('completeness')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN completeness INTEGER DEFAULT 0`);
}

// Migration: add real_name to profiles
if (!getColumns('profiles').includes('real_name')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN real_name TEXT`);
}

// Migration: add pbkdf2_iterations to users
if (!getColumns('users').includes('pbkdf2_iterations')) {
  db.exec(`ALTER TABLE users ADD COLUMN pbkdf2_iterations INTEGER DEFAULT 100000`);
}

// Migration: add exchange_uid and deposit_addresses to exchanges
const exchangeCols = getColumns('exchanges');
if (!exchangeCols.includes('exchange_uid')) {
  db.exec(`ALTER TABLE exchanges ADD COLUMN exchange_uid TEXT`);
}
if (!exchangeCols.includes('deposit_addresses')) {
  db.exec(`ALTER TABLE exchanges ADD COLUMN deposit_addresses TEXT`);
}

// Migration: add login_devices to profiles, projects, exchanges
if (!getColumns('profiles').includes('login_devices')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN login_devices TEXT`);
}
if (!getColumns('projects').includes('login_devices')) {
  db.exec(`ALTER TABLE projects ADD COLUMN login_devices TEXT`);
}
if (!exchangeCols.includes('login_devices')) {
  db.exec(`ALTER TABLE exchanges ADD COLUMN login_devices TEXT`);
}

// Migration: add referral_link and referral_code to exchanges
const exchColsLatest = getColumns('exchanges');
if (!exchColsLatest.includes('referral_link')) {
  db.exec(`ALTER TABLE exchanges ADD COLUMN referral_link TEXT`);
}
if (!exchColsLatest.includes('referral_code')) {
  db.exec(`ALTER TABLE exchanges ADD COLUMN referral_code TEXT`);
}

// Migration: todos table
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 1,
    category TEXT DEFAULT '',
    due_date TEXT,
    profile_id INTEGER,
    project_id INTEGER,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)`);

// Migration: logins table (password vault)
db.exec(`
  CREATE TABLE IF NOT EXISTS logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    username TEXT,
    password_hint TEXT,
    password TEXT,
    email TEXT,
    phone TEXT,
    category TEXT DEFAULT '',
    login_devices TEXT,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_logins_user_id ON logins(user_id)`);

// Migration: notes table
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)`);

// Migration: add images to notes and todos
if (!getColumns('notes').includes('images')) {
  db.exec(`ALTER TABLE notes ADD COLUMN images TEXT`);
}
if (!getColumns('todos').includes('images')) {
  db.exec(`ALTER TABLE todos ADD COLUMN images TEXT`);
}
if (!getColumns('projects').includes('images')) {
  db.exec(`ALTER TABLE projects ADD COLUMN images TEXT`);
}

module.exports = { db, DATA_DIR, DB_PATH, UPLOADS_DIR, BACKUPS_DIR, AVATARS_DIR };
