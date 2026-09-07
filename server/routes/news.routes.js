const express = require('express');
const router = express.Router();
const NewsController = require('../controllers/news.controller');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/rbac.middleware');

// All authenticated users can view news
router.get('/', authenticateToken, NewsController.getAll);
router.get('/:id', authenticateToken, NewsController.getById);

// Only Admin can create, update, pin, delete news
router.post('/', authenticateToken, requireRole('admin'), NewsController.create);
router.put('/:id', authenticateToken, requireRole('admin'), NewsController.update);
router.put('/:id/pin', authenticateToken, requireRole('admin'), NewsController.togglePin);
router.delete('/:id', authenticateToken, requireRole('admin'), NewsController.delete);

module.exports = router;
