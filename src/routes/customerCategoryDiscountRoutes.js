const express = require('express');
const router = express.Router();
const controller = require('../controllers/CustomerCategoryDiscountController');
const auth = require('../middleware/auth');

router.get('/', auth, controller.getAllDiscounts);
router.post('/', auth, controller.upsertDiscounts);

module.exports = router;
