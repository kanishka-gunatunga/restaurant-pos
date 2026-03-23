const express = require('express');
const router = express.Router();
const SupplierController = require('../controllers/SupplierController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, SupplierController.listSuppliers);
router.get('/:id', authenticate, SupplierController.getSupplierById);
router.post('/', authenticate, SupplierController.createSupplier);
router.put('/:id', authenticate, SupplierController.updateSupplier);
router.delete('/:id', authenticate, SupplierController.deleteSupplier);

module.exports = router;
