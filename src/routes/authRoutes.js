const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/register', UserController.register);
router.post('/login', loginLimiter, UserController.login);
router.get('/me', authenticate, UserController.getMe);
router.post('/verify-passcode', authenticate, UserController.verifyPasscode);

module.exports = router;
