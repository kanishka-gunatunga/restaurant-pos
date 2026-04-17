const express = require('express');
const router = express.Router();
const productBundleController = require('../controllers/ProductBundleController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });


router.post('/', authenticate, upload.single('image'), productBundleController.createBundle);
router.get('/', authenticate, productBundleController.getAllBundles);
router.get('/:id', authenticate, productBundleController.getBundleById);
router.put('/:id', authenticate, upload.single('image'), productBundleController.updateBundle);
router.patch('/:id/deactivate', authenticate, productBundleController.deactivateBundle);
router.patch('/:id/activate', authenticate, productBundleController.activateBundle);

module.exports = router;
