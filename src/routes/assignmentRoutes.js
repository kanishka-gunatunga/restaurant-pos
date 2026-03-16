const express = require('express');
const router = express.Router();
const AssignmentController = require('../controllers/AssignmentController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, AssignmentController.listAssignments);
router.get('/:id', authenticate, AssignmentController.getAssignmentById);
router.post('/', authenticate, AssignmentController.createAssignment);
router.put('/:id', authenticate, AssignmentController.updateAssignment);
router.delete('/:id', authenticate, AssignmentController.deleteAssignment);

module.exports = router;
