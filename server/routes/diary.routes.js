const express = require('express');
const router = express.Router();
const DiaryController = require('../controllers/diary.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.get('/', authenticateToken, DiaryController.getAll);
router.get('/stats', authenticateToken, DiaryController.getStats);
router.post('/', authenticateToken, DiaryController.create);
router.post('/batch-approve', authenticateToken, DiaryController.batchApprove);
router.put('/:id/approve', authenticateToken, DiaryController.approve);
router.put('/:id/status', authenticateToken, DiaryController.updateStatus);
router.put('/:id', authenticateToken, DiaryController.update);
router.delete('/:id', authenticateToken, DiaryController.delete);

module.exports = router;
