const express = require('express');
const router = express.Router();
const MaterialController = require('../controllers/MaterialController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, MaterialController.listMaterials);
router.get('/:id', authenticate, MaterialController.getMaterialById);
router.post('/', authenticate, MaterialController.createMaterial);
router.put('/:id', authenticate, MaterialController.updateMaterial);
router.delete('/:id', authenticate, MaterialController.deleteMaterial);

module.exports = router;
