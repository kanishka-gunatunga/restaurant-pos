const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/SessionController');
const { authenticate } = require('../middleware/auth');

router.post('/start', authenticate, sessionController.startSession);
router.get('/active', authenticate, sessionController.getActiveSession);
router.post('/cash-action', authenticate, sessionController.cashAction);
router.post('/close', authenticate, sessionController.closeSession);
router.get('/history', authenticate, sessionController.getHistory);
router.get('/today/summary', authenticate, sessionController.getTodaySummary);
router.get('/today/sessions', authenticate, sessionController.getTodaySessions);
router.get('/all-history', authenticate, sessionController.getAllHistory);

module.exports = router;
