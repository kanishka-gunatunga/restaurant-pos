const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');

router.get('/', OrderController.getAllOrders);
router.get('/:id', OrderController.getOrderById);
router.post('/', OrderController.createOrder);
router.put('/:id/status', OrderController.updateOrderStatus);
router.put('/item/:itemId/status', OrderController.updateOrderItemStatus);

module.exports = router;
