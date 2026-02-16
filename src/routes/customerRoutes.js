const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/CustomerController');
const { authenticate } = require('../middleware/auth');

router.post('/find-or-create', authenticate, CustomerController.findOrCreate);
router.get('/', authenticate, CustomerController.getAllCustomers);
router.get('/mobile/:mobile', authenticate, CustomerController.getByMobile);
router.get('/:id', authenticate, CustomerController.getCustomerById);
router.put('/:id', authenticate, CustomerController.updateCustomer);

module.exports = router;
