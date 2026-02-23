const express = require('express');
const router = express.Router();
const BranchController = require('../controllers/BranchController');

router.get('/', BranchController.getAllBranches);
router.get('/:id', BranchController.getBranchById);
router.post('/', BranchController.createBranch);
router.put('/:id', BranchController.updateBranch);
router.delete('/:id', BranchController.deleteBranch);

module.exports = router;
