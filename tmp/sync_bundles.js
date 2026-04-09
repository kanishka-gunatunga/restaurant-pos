const sequelize = require('../src/config/database');
const ProductBundle = require('../src/models/ProductBundle');
const ProductBundleItem = require('../src/models/ProductBundleItem');
const ProductBundleBranch = require('../src/models/ProductBundleBranch');
const VariationOption = require('../src/models/VariationOption');
require('../src/models/associations');

async function syncTargeted() {
    try {
        console.log('Syncing ProductBundle models and items...');
        await ProductBundle.sync({ alter: true });
        console.log('ProductBundle synced.');
        await ProductBundleItem.sync({ alter: true });
        console.log('ProductBundleItem synced.');
        await ProductBundleBranch.sync({ alter: true });
        console.log('ProductBundleBranch synced.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing targeted models:', error);
        process.exit(1);
    }
}

syncTargeted();
