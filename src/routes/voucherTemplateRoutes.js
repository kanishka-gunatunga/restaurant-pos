const express = require('express');
const router = express.Router();
const voucherTemplateController = require('../controllers/voucherTemplateController');
const { authenticate, requireRole } = require('../middleware/auth');

// Base route is /api/voucher-templates

router.get('/', authenticate, voucherTemplateController.getAllTemplates);
router.post('/', authenticate, requireRole('admin', 'manager'), voucherTemplateController.createTemplate);
router.put('/:id', authenticate, requireRole('admin', 'manager'), voucherTemplateController.updateTemplate);
router.patch('/:id/status', authenticate, requireRole('admin', 'manager'), voucherTemplateController.updateTemplateStatus);

module.exports = router;
