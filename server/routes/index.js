const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/rbac.middleware');
const AdminController = require('../controllers/admin.controller');

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/departments', require('./departments.routes'));
router.use('/tasks', require('./tasks.routes'));
router.use('/personal-logs', require('./diary.routes'));
router.use('/chat', require('./chat.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/upload', require('./upload.routes'));
router.use('/news', require('./news.routes'));

// Activity logs / Audit logs endpoint
router.get('/activity-logs', authenticateToken, requireRole('admin'), AdminController.getActivityLogs);
router.get('/audit-logs', authenticateToken, requireRole('admin'), AdminController.getActivityLogs);

module.exports = router;
