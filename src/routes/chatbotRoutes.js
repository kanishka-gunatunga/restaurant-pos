const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/ChatbotController');

router.post('/', ChatbotController.handleChat);

module.exports = router;
