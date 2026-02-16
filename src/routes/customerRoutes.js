const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/CustomerController');

router.post('/find-or-create', CustomerController.findOrCreate);
router.get('/:mobile', CustomerController.getByMobile);

module.exports = router;
