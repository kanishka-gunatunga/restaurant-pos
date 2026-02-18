const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const { authenticate } = require('../middleware/auth');

router.get('/sales', authenticate, ReportController.getSalesReport);

module.exports = router;
