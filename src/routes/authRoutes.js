const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticate } = require('../middleware/auth');

router.post('/register', UserController.register);
router.post('/login', UserController.login);
router.post('/verify-passcode', authenticate, UserController.verifyPasscode);

module.exports = router;
