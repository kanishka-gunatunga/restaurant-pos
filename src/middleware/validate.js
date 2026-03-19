/**
 * Lightweight input validation. Returns error message or null if valid.
 * Does not change API contracts—only rejects invalid input before existing logic.
 */
function validatePositiveInt(value, fieldName) {
    if (value === undefined || value === null) return null;
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 1) return `${fieldName} must be a positive integer`;
    return null;
}

function validateNonNegativeNumber(value, fieldName) {
    if (value === undefined || value === null) return null;
    const n = parseFloat(value);
    if (Number.isNaN(n) || n < 0) return `${fieldName} must be a non-negative number`;
    return null;
}

function validateStringMax(value, fieldName, maxLen = 500) {
    if (value === undefined || value === null) return null;
    const s = String(value);
    if (s.length > maxLen) return `${fieldName} must be at most ${maxLen} characters`;
    return null;
}

function validateIdParam(req, res, next) {
    const id = req.params.id;
    if (id === undefined) return next();
    const err = validatePositiveInt(id, 'id');
    if (err) return res.status(400).json({ message: err });
    next();
}

module.exports = {
    validatePositiveInt,
    validateNonNegativeNumber,
    validateStringMax,
    validateIdParam,
};
