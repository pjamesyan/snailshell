const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database (creates tables if needed)
const { db } = require('./db');

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
app.use('/api/chat', require('./routes/chat'));

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Account Manager v2 server running on http://0.0.0.0:${PORT}`);
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
