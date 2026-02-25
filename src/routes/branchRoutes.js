const express = require('express');
const router = express.Router();
const BranchController = require('../controllers/BranchController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, BranchController.getAllBranches);
router.get('/:id', authenticate, BranchController.getBranchById);
router.post('/', authenticate, BranchController.createBranch);
router.put('/:id', authenticate, BranchController.updateBranch);
router.post('/:id/activate', authenticate, BranchController.activateBranch);
router.post('/:id/deactivate', authenticate, BranchController.deactivateBranch);

module.exports = router;
