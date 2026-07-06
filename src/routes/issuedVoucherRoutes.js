const express = require('express');
const router = express.Router();
const issuedVoucherController = require('../controllers/issuedVoucherController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/validate', authenticate, requireRole('admin', 'manager', 'cashier'), issuedVoucherController.validateVoucher);
router.get('/', authenticate, requireRole('admin', 'manager'), issuedVoucherController.getAllIssuedVouchers);
router.put('/:id', authenticate, requireRole('admin', 'manager'), issuedVoucherController.updateIssuedVoucher);
router.patch('/:id/status', authenticate, requireRole('admin', 'manager'), issuedVoucherController.updateIssuedVoucherStatus);

module.exports = router;
