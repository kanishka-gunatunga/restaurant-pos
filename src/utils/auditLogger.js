/**
 * Security audit logger. Logs to console as structured JSON for log aggregation.
 * Does not log passwords, tokens, or other sensitive data.
 */
function auditLog(event, { ip, userId = null, path = null, reason = null, metadata = {} }) {
    const entry = {
        timestamp: new Date().toISOString(),
        event,
        ip: ip || null,
        userId: userId || null,
        path: path || null,
        reason: reason || null,
        ...metadata,
    };
    if (process.env.NODE_ENV !== 'test') {
        console.log(JSON.stringify({ audit: entry }));
    }
}

module.exports = { auditLog };
