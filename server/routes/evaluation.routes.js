const express = require('express');
const router = express.Router();
const EvaluationController = require('../controllers/evaluation.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.get('/my', authenticateToken, EvaluationController.getMyEvaluation);
router.post('/my', authenticateToken, EvaluationController.saveMyEvaluation);
router.get('/', authenticateToken, EvaluationController.getEvaluations);

module.exports = router;
