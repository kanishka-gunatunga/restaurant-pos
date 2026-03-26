const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const poolMaxRaw = parseInt(process.env.DB_POOL_MAX, 10);
const defaultPoolMax = isProd ? 10 : 1;
let poolMax = Number.isFinite(poolMaxRaw) && poolMaxRaw > 0 ? poolMaxRaw : defaultPoolMax;
// Shared dev DB users (e.g. genaitech_user): high DB_POOL_MAX + Workbench = ER_TOO_MANY_USER_CONNECTIONS
if (!isProd) {
    poolMax = Math.min(poolMax, 2);
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    dialectModule: require('mysql2'),
    logging: false,
    pool: {
      max: poolMax,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },
  }
);

/**
 * Authenticate with retries. ER_TOO_MANY_USER_CONNECTIONS means all slots for this MySQL *user*
 * are taken (Workbench, other devs, zombie node) — not fixable by pool size alone.
 */
sequelize.connectWithRetry = async function connectWithRetry() {
    const retries = isProd ? 5 : 15;
    const delayMs = 3000;
    let lastErr;
    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.authenticate();
            if (i > 0) {
                console.log(`[DB] Connected after ${i + 1} attempts`);
            }
            return;
        } catch (err) {
            lastErr = err;
            const code = err.parent?.code || err.original?.code;
            const isUserLimit =
                code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
                String(err.message || '').includes('max_user_connections');
            const isTimeout = code === 'ETIMEDOUT' || String(err.message || '').includes('ETIMEDOUT');
            if (i < retries - 1 && (isUserLimit || isTimeout)) {
                console.warn(
                    `[DB] ${code || 'connect failed'} (attempt ${i + 1}/${retries}). ` +
                        `Waiting ${delayMs / 1000}s… Close MySQL Workbench, stop duplicate Node servers, ` +
                        `or ask DBA: SHOW PROCESSLIST / raise max_user_connections for ${process.env.DB_USER || 'user'}.`
                );
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
};

module.exports = sequelize;
