const express = require('express');
const router = express.Router();
const bogoPromotionController = require('../controllers/BogoPromotionController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, bogoPromotionController.createBogoPromotion);
router.get('/', authenticate, bogoPromotionController.getAllBogoPromotions);
router.get('/:id', authenticate, bogoPromotionController.getBogoPromotionById);
router.put('/:id', authenticate, bogoPromotionController.updateBogoPromotion);
router.patch('/:id/deactivate', authenticate, bogoPromotionController.deactivateBogoPromotion);
router.patch('/:id/activate', authenticate, bogoPromotionController.activateBogoPromotion);

module.exports = router;
