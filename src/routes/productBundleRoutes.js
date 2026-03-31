const express = require('express');
const router = express.Router();
const productBundleController = require('../controllers/ProductBundleController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, productBundleController.createBundle);
router.get('/', authenticate, productBundleController.getAllBundles);
router.get('/:id', authenticate, productBundleController.getBundleById);
router.put('/:id', authenticate, productBundleController.updateBundle);
router.patch('/:id/deactivate', authenticate, productBundleController.deactivateBundle);
router.patch('/:id/activate', authenticate, productBundleController.activateBundle);

module.exports = router;
