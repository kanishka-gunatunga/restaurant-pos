const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const { authenticate } = require('../middleware/auth');

router.get('/sales', authenticate, ReportController.getSalesReport);
router.get('/orders', authenticate, ReportController.getOrdersReport);
router.get('/payments', authenticate, ReportController.getPaymentsReport);
router.get('/product-performance', authenticate, ReportController.getProductPerformanceReport);
router.get('/itemized-sales', authenticate, ReportController.getItemizedSalesList);
router.get('/products', authenticate, ReportController.getProductsReport);

module.exports = router;

