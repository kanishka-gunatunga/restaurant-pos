const express = require('express');
const router = express.Router();
const multer = require('multer');
const UploadController = require('../controllers/UploadController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/image', upload.single('image'), UploadController.uploadImage);

module.exports = router;
