const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');

router.get('/', OrderController.getAllOrders);
router.post('/', OrderController.createOrder);
router.patch('/:id/status', OrderController.updateOrderStatus);

module.exports = router;
