const { put } = require('@vercel/blob');
const Product = require('../models/Product');

exports.uploadImage = async (req, res) => {
    try {
        const { file } = req;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const blob = await put(file.originalname, file.buffer, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        res.json({ url: blob.url });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
