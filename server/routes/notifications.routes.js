const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.get('/', authenticateToken, NotificationController.getMyNotifications);
router.put('/:id/read', authenticateToken, NotificationController.markAsRead);
router.put('/read-all', authenticateToken, NotificationController.markAllAsRead);

module.exports = router;
