const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { UPLOADS_DIR } = require('./config/constants');
const apiRoutes = require('./routes/index');

const app = express();

// Middlewares
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with caching
const staticOptions = {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '1h',
  etag: true
};
app.use(express.static(path.join(__dirname, '../public'), staticOptions));
app.use('/uploads', express.static(UPLOADS_DIR, staticOptions));

// API Routes mounting
app.use('/api', apiRoutes);

// Fallback SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint không tồn tại' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ: ' + (err.message || 'Unknown error') });
  }
});

module.exports = app;
