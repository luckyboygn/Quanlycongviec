const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/rbac.middleware');

router.put('/users/:id/toggle-status', authenticateToken, requireRole('admin'), AdminController.toggleUserStatus);
router.post('/users/:id/toggle-status', authenticateToken, requireRole('admin'), AdminController.toggleUserStatus);
router.post('/users/batch-import', authenticateToken, requireRole('admin'), AdminController.batchImportUsers);
router.get('/backup', authenticateToken, requireRole('admin'), AdminController.exportBackup);
router.post('/restore', authenticateToken, requireRole('admin'), AdminController.restoreBackup);

module.exports = router;
