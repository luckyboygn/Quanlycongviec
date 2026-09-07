const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboard.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.get('/stats', authenticateToken, DashboardController.getStats);
router.get('/departments-comparison', authenticateToken, DashboardController.getDepartmentsComparison);
router.get('/department-members-comparison', authenticateToken, DashboardController.getDepartmentMembersComparison);
router.get('/status-distribution', authenticateToken, DashboardController.getStatusDistribution);

module.exports = router;
