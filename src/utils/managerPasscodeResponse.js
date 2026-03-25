const INVALID_MANAGER_PASSCODE = 'INVALID_MANAGER_PASSCODE';

function invalidManagerPasscode(res, message = 'Invalid manager passcode') {
    return res.status(403).json({
        code: INVALID_MANAGER_PASSCODE,
        message,
    });
}

module.exports = {
    INVALID_MANAGER_PASSCODE,
    invalidManagerPasscode,
};
