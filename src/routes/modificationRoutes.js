const express = require('express');
const router = express.Router();
const ModificationController = require('../controllers/ModificationController');

router.get('/', ModificationController.getAllModifications);
router.get('/:id', ModificationController.getModificationById);
router.post('/', ModificationController.createModification);
router.put('/:id', ModificationController.updateModification);
router.delete('/:id', ModificationController.deleteModification);

module.exports = router;
