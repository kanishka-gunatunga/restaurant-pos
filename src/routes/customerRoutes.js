const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/CustomerController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, CustomerController.createCustomer);
router.post('/find-or-create', authenticate, CustomerController.findOrCreate);
router.get('/', authenticate, CustomerController.getAllCustomers);
router.get('/search', authenticate, CustomerController.searchCustomers);
router.get('/mobile/:mobile', authenticate, CustomerController.getByMobile);
router.get('/:id', authenticate, CustomerController.getCustomerById);
router.put('/:id', authenticate, CustomerController.updateCustomer);
router.put('/:id/promotions', authenticate, CustomerController.updatePromotionPreference);
router.post('/send-promotions', authenticate, CustomerController.sendBulkPromotions);

router.post('/:id/activate', authenticate, CustomerController.activateCustomer);
router.post('/:id/deactivate', authenticate, CustomerController.deactivateCustomer);



module.exports = router;
