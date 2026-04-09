const sequelize = require('../src/config/database');
const ProductBundle = require('../src/models/ProductBundle');
const ProductBundleBranch = require('../src/models/ProductBundleBranch');
require('../src/models/associations');

async function syncTargeted() {
    try {
        console.log('Syncing ProductBundle models...');
        await ProductBundle.sync({ alter: true });
        console.log('ProductBundle synced.');
        await ProductBundleBranch.sync({ alter: true });
        console.log('ProductBundleBranch synced.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing targeted models:', error);
        process.exit(1);
    }
}

syncTargeted();
