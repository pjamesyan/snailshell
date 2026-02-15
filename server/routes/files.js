const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { UPLOADS_DIR, DATA_DIR } = require('../db');
const { authMiddleware } = require('../middleware');

const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

// POST /api/files/upload
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }
    
    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/api/files/${req.file.filename}`
    };
    
    // For images, we skip server-side thumbnail generation
    // (sharp is hard to install; thumbnails will be handled by frontend CSS)
    if (req.file.mimetype.startsWith('image/')) {
      fileInfo.thumbnail = fileInfo.path; // Same path, frontend will resize
      fileInfo.isImage = true;
    }
    
    res.status(201).json({
      message: '文件上传成功',
      file: fileInfo
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: '文件上传失败' });
  }
});

// Avatar storage
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
    }
    cb(null, AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只支持图片文件'), false);
  }
});

// POST /api/files/avatars/upload
router.post('/avatars/upload', authMiddleware, avatarUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  res.status(201).json({ filename: req.file.filename });
});

// GET /api/files/avatars - list available avatars
router.get('/avatars', authMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
      return res.json({ avatars: [] });
    }
    const files = fs.readdirSync(AVATARS_DIR).filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));
    res.json({ avatars: files });
  } catch (err) {
    res.status(500).json({ error: '获取头像列表失败' });
  }
});

// GET /api/files/avatars/:filename - serve avatar (no auth needed for display)
router.get('/avatars/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(AVATARS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '头像不存在' });
  res.sendFile(filePath);
});

// GET /api/files/:filename (no auth - filenames are UUIDs, not guessable)
router.get('/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    const filePath = path.join(UPLOADS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    res.sendFile(filePath);
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ error: '获取文件失败' });
  }
});

// DELETE /api/files/:filename
router.delete('/:filename', authMiddleware, (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    const filePath = path.join(UPLOADS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    fs.unlinkSync(filePath);
    
    res.json({ message: '文件已删除' });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: '删除文件失败' });
  }
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小不能超过10MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
