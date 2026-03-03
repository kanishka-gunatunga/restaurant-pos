const express = require('express');
const router = express.Router();
const DiscountController = require('../controllers/DiscountController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, DiscountController.getAllDiscounts);
router.get('/:id', authenticate, DiscountController.getDiscountById);
router.post('/', authenticate, DiscountController.createDiscount);
router.put('/:id', authenticate, DiscountController.updateDiscount);
router.delete('/:id', authenticate, DiscountController.deleteDiscount);
router.post('/:id/activate', authenticate, DiscountController.activateDiscount);
router.post('/:id/deactivate', authenticate, DiscountController.deactivateDiscount);

module.exports = router;
