require('dotenv').config();
const sequelize = require('../src/config/database');
require('../src/models/associations');
const { runNormalizeStockStatus } = require('../src/services/normalizeStockStatus');

async function main() {
    await sequelize.authenticate();
    const { updated, total } = await runNormalizeStockStatus();
    console.log(`Done. Updated ${updated} of ${total} stock rows.`);
    await sequelize.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
