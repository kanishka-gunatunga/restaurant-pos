const express = require('express');
const router = express.Router();
const CronController = require('../controllers/CronController');

router.get('/normalize-stock-status', CronController.normalizeStockStatus);

module.exports = router;
