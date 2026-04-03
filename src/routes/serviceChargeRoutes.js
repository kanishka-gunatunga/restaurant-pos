const express = require('express');
const router = express.Router();
const ServiceChargeController = require('../controllers/ServiceChargeController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, ServiceChargeController.getServiceCharge);
router.get('/:branchId', authenticate, ServiceChargeController.getBranchServiceCharge);
router.put('/', authenticate, ServiceChargeController.updateServiceCharge);

module.exports = router;
