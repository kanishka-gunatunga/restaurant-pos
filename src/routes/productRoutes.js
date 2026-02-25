const express = require('express');
const router = express.Router();
const multer = require('multer');
const ProductController = require('../controllers/ProductController');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticate, ProductController.getAllProducts);
router.get('/search', authenticate, ProductController.searchProducts);
router.get('/:id', authenticate, ProductController.getProductById);
router.get('/category/:categoryId', authenticate, ProductController.getProductsByCategory);
router.post('/', authenticate, upload.single('image'), ProductController.createProduct);
router.put('/:id', authenticate, upload.single('image'), ProductController.updateProduct);
router.post('/:id/activate', authenticate, ProductController.activateProduct);
router.post('/:id/deactivate', authenticate, ProductController.deactivateProduct);

module.exports = router;
