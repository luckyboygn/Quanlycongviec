const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/rbac.middleware');

router.get('/', authenticateToken, UserController.getAll);
router.post('/', authenticateToken, requireRole('admin'), UserController.create);
router.put('/:id/role', authenticateToken, requireRole('admin'), UserController.changeRole);
router.put('/:id/position', authenticateToken, requireRole('admin'), UserController.changePosition);
router.put('/:id/department', authenticateToken, requireRole('admin'), UserController.changeDepartment);
router.put('/:id', authenticateToken, UserController.update);
router.post('/:id/reset-password', authenticateToken, requireRole('admin'), UserController.resetPassword);
router.delete('/:id', authenticateToken, requireRole('admin'), UserController.delete);

module.exports = router;

