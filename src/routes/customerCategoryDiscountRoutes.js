const express = require('express');
const router = express.Router();
const controller = require('../controllers/CustomerCategoryDiscountController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, controller.getAllDiscounts);
router.post('/', authenticate, controller.upsertDiscounts);

module.exports = router;
