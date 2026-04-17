const express = require('express');
const router = express.Router();
const bogoPromotionController = require('../controllers/BogoPromotionController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });


router.post('/', authenticate, upload.single('image'), bogoPromotionController.createBogoPromotion);
router.get('/', authenticate, bogoPromotionController.getAllBogoPromotions);
router.get('/branch-specific', authenticate, bogoPromotionController.getBogoPromotionsByBranch);
router.get('/:id', authenticate, bogoPromotionController.getBogoPromotionById);

router.put('/:id', authenticate, upload.single('image'), bogoPromotionController.updateBogoPromotion);
router.patch('/:id/deactivate', authenticate, bogoPromotionController.deactivateBogoPromotion);
router.patch('/:id/activate', authenticate, bogoPromotionController.activateBogoPromotion);

module.exports = router;
