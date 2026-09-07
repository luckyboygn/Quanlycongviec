const express = require('express');
const router = express.Router();
const DepartmentController = require('../controllers/department.controller');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/rbac.middleware');

router.get('/', authenticateToken, DepartmentController.getAll);
router.post('/', authenticateToken, requireRole('admin', 'director'), DepartmentController.create);
router.put('/:id', authenticateToken, requireRole('admin', 'director'), DepartmentController.update);
router.delete('/:id', authenticateToken, requireRole('admin', 'director'), DepartmentController.delete);

module.exports = router;
