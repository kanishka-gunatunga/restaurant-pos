const { runNormalizeStockStatus } = require('../services/normalizeStockStatus');

exports.normalizeStockStatus = async (req, res) => {
    try {
        const secret = process.env.CRON_SECRET;
        const auth = req.headers.authorization;
        const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : '';

        if (!secret || token !== secret) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { updated, total } = await runNormalizeStockStatus();
        console.log('[cron] normalize-stock-status', { updated, total });
        return res.status(200).json({
            message: 'Normalize completed',
            updated,
            total,
        });
    } catch (error) {
        console.error('[cron] normalize-stock-status error', error);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
};
