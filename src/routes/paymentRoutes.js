const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, PaymentController.createPayment);
router.put('/:id/status', authenticate, PaymentController.updatePaymentStatus);
router.get('/order/:orderId', authenticate, PaymentController.getPaymentsByOrder);

module.exports = router;
