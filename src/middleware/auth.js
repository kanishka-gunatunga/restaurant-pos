const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auditLog } = require('../utils/auditLogger');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') return null;
    return 'secret';
}

exports.authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            auditLog('auth_failed', { ip: req.ip, path: req.path, reason: 'no_token' });
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const secret = getJwtSecret();
        if (!secret) return res.status(500).json({ message: 'Server configuration error' });
        const decoded = jwt.verify(token, secret);

        const user = await User.findByPk(decoded.id);
        if (!user) {
            auditLog('auth_failed', { ip: req.ip, path: req.path, reason: 'user_not_found', userId: decoded.id });
            return res.status(401).json({ message: 'Invalid or inactive user.' });
        }
        if (user.status !== 'active') {
            auditLog('auth_failed', { ip: req.ip, path: req.path, reason: 'user_inactive', userId: user.id });
            return res.status(403).json({ message: 'Account is inactive.' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            auditLog('auth_failed', { ip: req.ip, path: req.path, reason: 'invalid_token' });
            return res.status(401).json({ message: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            auditLog('auth_failed', { ip: req.ip, path: req.path, reason: 'token_expired' });
            return res.status(401).json({ message: 'Token expired.' });
        }
        if (process.env.NODE_ENV !== 'production') console.error('Auth:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
};

exports.requireRole = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
};
