const express = require('express');
const router = express.Router();
const DeliveryChargeController = require('../controllers/DeliveryChargeController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, DeliveryChargeController.getAllDeliveryCharges);
router.get('/branch/:branchId', authenticate, DeliveryChargeController.getDeliveryChargesByBranch);
router.get('/:id', authenticate, DeliveryChargeController.getDeliveryChargeById);
router.post('/', authenticate, DeliveryChargeController.createDeliveryCharge);
router.put('/:id', authenticate, DeliveryChargeController.updateDeliveryCharge);
router.post('/:id/activate', authenticate, DeliveryChargeController.activateDeliveryCharge);
router.post('/:id/deactivate', authenticate, DeliveryChargeController.deactivateDeliveryCharge);

module.exports = router;
