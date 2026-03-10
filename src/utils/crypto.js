const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '84cad4b8ccbf424da1c6baaf9e237cfc'; // 32 characters for AES-256
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
    if (!text) return null;
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        if (textParts.length < 2) return text; // Plain text (legacy), return as-is
        const ivHex = textParts.shift();
        const iv = Buffer.from(ivHex, 'hex');
        if (iv.length !== IV_LENGTH) return text; // Invalid IV, treat as plain text
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        return text; // Decryption failed (e.g. wrong format), treat as plain text
    }
}

module.exports = { encrypt, decrypt };
