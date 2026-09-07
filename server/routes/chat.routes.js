const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.get('/contacts', authenticateToken, ChatController.getContacts);
router.get('/messages', authenticateToken, ChatController.getMessages);
router.post('/messages', authenticateToken, ChatController.sendMessage);
router.delete('/messages/:id', authenticateToken, ChatController.deleteMessage);
router.put('/messages/:id/recall', authenticateToken, ChatController.recallMessage);
router.post('/messages/:id/recall', authenticateToken, ChatController.recallMessage);
router.get('/unread-count', authenticateToken, ChatController.getUnreadCount);

module.exports = router;
