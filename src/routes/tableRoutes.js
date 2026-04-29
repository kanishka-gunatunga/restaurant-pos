const express = require('express');
const router = express.Router();
const tableController = require('../controllers/TableController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, tableController.getTables);
router.post('/', protect, tableController.createTable);
router.put('/:id', protect, tableController.updateTable);
router.delete('/:id', protect, tableController.deleteTable);

module.exports = router;
