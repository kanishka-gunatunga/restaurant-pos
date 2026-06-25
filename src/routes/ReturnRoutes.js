const express = require('express');
const router = express.Router();
const ReturnController = require('../controllers/ReturnController');
const { authenticate } = require('../middleware/auth');

router.get('/search-order/:id', authenticate, ReturnController.searchOrderById);
router.post('/', authenticate, ReturnController.createReturn);
router.get('/:id', authenticate, ReturnController.getReturnById);

module.exports = router;
