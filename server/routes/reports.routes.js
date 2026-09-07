const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/report.controller');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/rbac.middleware');

router.get('/', authenticateToken, ReportController.getAll);
router.get('/aggregate-data', authenticateToken, ReportController.aggregateData);
router.post('/', authenticateToken, ReportController.create);
router.put('/:id/review', authenticateToken, requireRole('manager', 'director', 'admin'), ReportController.review);

module.exports = router;
