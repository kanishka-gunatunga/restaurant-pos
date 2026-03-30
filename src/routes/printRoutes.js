const express = require('express');
const router = express.Router();
const PrintController = require('../controllers/PrintController');
const { authenticate } = require('../middleware/auth');

router.get('/pending', PrintController.getPendingJobs);
router.patch('/:id/status', PrintController.updateStatus);
router.post('/manual', authenticate, PrintController.createManualPrintJob);

module.exports = router;
