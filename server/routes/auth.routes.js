const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.post('/login', AuthController.login);
router.post('/quick-switch', AuthController.quickSwitch);
router.post('/switch-my-role', AuthController.switchMyRole);
router.post('/change-password', authenticateToken, AuthController.changePassword);
router.get('/me', authenticateToken, AuthController.getMe);

module.exports = router;
