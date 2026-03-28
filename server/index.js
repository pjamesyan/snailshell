const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database (creates tables if needed)
const { db, DATA_DIR } = require('./db');

// Network mode config
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {}
  return { networkMode: 'lan' };
}
function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
const config = readConfig();
const BIND_HOST = config.networkMode === 'local' ? '127.0.0.1' : '0.0.0.0';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// Network mode config API (no auth needed - used on login page)
app.get('/api/config/network', (req, res) => {
  const cfg = readConfig();
  res.json({ mode: cfg.networkMode || 'lan' });
});
app.post('/api/config/network', (req, res) => {
  const { mode } = req.body;
  if (!mode || !['lan', 'local'].includes(mode)) {
    return res.status(400).json({ error: '无效的模式，只能是 lan 或 local' });
  }
  const cfg = readConfig();
  cfg.networkMode = mode;
  writeConfig(cfg);
  res.json({ success: true, mode, message: '请重启服务生效' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/files', require('./routes/files'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/exchanges', require('./routes/exchanges'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/logins', require('./routes/logins'));

// Serve static files (for future frontend)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API路由不存在' });
  }
  const indexPath = path.join(publicDir, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'Account Manager v2 API Server', version: '2.0.0' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// Start server
app.listen(PORT, BIND_HOST, () => {
  console.log(`\n🚀 Account Manager v2 server running on http://${BIND_HOST}:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health`);
  console.log(`   Time: ${new Date().toISOString()}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});

module.exports = app;
