const express = require('express');
const multer = require('multer');
const router = express.Router();
const StockController = require('../controllers/StockController');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticate, StockController.listStocks);
router.get('/export', authenticate, StockController.exportStocks);
router.get('/import-template', authenticate, StockController.getStockImportTemplate);
router.post('/import', authenticate, upload.single('file'), StockController.importStocks);
router.get('/:id', authenticate, StockController.getStockById);
router.post('/', authenticate, StockController.createStock);
router.put('/:id', authenticate, StockController.updateStock);
router.delete('/:id', authenticate, StockController.deleteStock);

module.exports = router;
