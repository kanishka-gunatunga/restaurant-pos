const express = require('express');
const router = express.Router();
const tableController = require('../controllers/TableController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, tableController.getTables);
router.post('/', authenticate, tableController.createTable);
router.put('/:id', authenticate, tableController.updateTable);
router.delete('/:id', authenticate, tableController.deleteTable);

module.exports = router;
