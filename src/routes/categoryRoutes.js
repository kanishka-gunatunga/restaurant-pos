const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticate, CategoryController.getAllCategories);
router.get('/export-template', authenticate, CategoryController.exportTemplate);
router.post('/import', authenticate, upload.single('file'), CategoryController.importCategories);
router.get('/parents', authenticate, CategoryController.getParentCategories);
router.get('/:parentId/subcategories', authenticate, CategoryController.getSubCategories);
router.get('/:id', authenticate, CategoryController.getCategoryById);
router.post('/', authenticate, CategoryController.createCategory);
router.put('/:id', authenticate, CategoryController.updateCategory);
router.post('/:id/activate', authenticate, CategoryController.activateCategory);
router.post('/:id/deactivate', authenticate, CategoryController.deactivateCategory);

module.exports = router;
