const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/DashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/cashier', authenticate, dashboardController.getCashierDashboard);
router.get('/manager', authenticate, dashboardController.getManagerDashboard);
router.get('/admin', authenticate, dashboardController.getAdminDashboard);
router.get('/kitchen', authenticate, dashboardController.getKitchenDashboard);

module.exports = router;
