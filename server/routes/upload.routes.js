const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không tìm thấy file tải lên' });
  }
  const fileUrl = '/uploads/' + req.file.filename;
  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

module.exports = router;
