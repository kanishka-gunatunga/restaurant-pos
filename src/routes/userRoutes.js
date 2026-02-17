const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticate, requireRole } = require('../middleware/auth');

// All routes require auth. List, get, update, deactivate require admin or manager.
router.get('/', authenticate, requireRole('admin', 'manager'), UserController.getAllUsers);
router.get('/:id', authenticate, requireRole('admin', 'manager'), UserController.getUserById);
router.put('/:id', authenticate, requireRole('admin', 'manager'), UserController.updateUser);
router.patch('/:id/deactivate', authenticate, requireRole('admin', 'manager'), UserController.deactivateUser);

module.exports = router;
