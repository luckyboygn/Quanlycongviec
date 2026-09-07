const express = require('express');
const router = express.Router();
const TaskController = require('../controllers/task.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.get('/', authenticateToken, TaskController.getAll);
router.get('/:id', authenticateToken, TaskController.getById);
router.post('/', authenticateToken, TaskController.create);
router.put('/:id', authenticateToken, TaskController.update);
router.put('/:id/progress', authenticateToken, TaskController.updateProgress);
router.delete('/:id', authenticateToken, TaskController.delete);
router.post('/:id/logs', authenticateToken, TaskController.addLog);

module.exports = router;
