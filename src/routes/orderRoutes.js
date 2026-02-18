const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const { authenticate } = require('../middleware/auth');

router.get('/', OrderController.getAllOrders);
router.get('/:id', OrderController.getOrderById);
router.post('/', authenticate, OrderController.createOrder);
router.put('/:id', authenticate, OrderController.updateOrder);
router.put('/:id/status', authenticate, OrderController.updateOrderStatus);
router.put('/item/:itemId/status', authenticate, OrderController.updateOrderItemStatus);

module.exports = router;
