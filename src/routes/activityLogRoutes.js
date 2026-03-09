const express = require('express');
const router = express.Router();
const ActivityLogController = require('../controllers/ActivityLogController');
const { authenticate } = require('../middleware/auth');

// Only admin and manager should see logs
router.get('/', authenticate, ActivityLogController.getActivityLogs);

module.exports = router;
