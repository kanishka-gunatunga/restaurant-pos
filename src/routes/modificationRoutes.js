const express = require('express');
const router = express.Router();
const ModificationController = require('../controllers/ModificationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, ModificationController.getAllModifications);
router.get('/:id', authenticate, ModificationController.getModificationById);
router.post('/', authenticate, ModificationController.createModification);
router.put('/:id', authenticate, ModificationController.updateModification);
router.post('/:id/activate', authenticate, ModificationController.activateModification);
router.post('/:id/deactivate', authenticate, ModificationController.deactivateModification);

module.exports = router;
