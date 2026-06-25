const sequelize = require('./src/config/database');
const OrderItem = require('./src/models/OrderItem');
const ProductBundle = require('./src/models/ProductBundle');
const ProductBundleItem = require('./src/models/ProductBundleItem');
const ProductBundleBranch = require('./src/models/ProductBundleBranch');
const BogoPromotion = require('./src/models/BogoPromotion');
const BogoPromotionBranch = require('./src/models/BogoPromotionBranch');
const Payment = require('./src/models/Payment');

async function syncMissing() {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        console.log('Syncing OrderItem...');
        await OrderItem.sync({ alter: true });

        console.log('Syncing ProductBundle...');
        await ProductBundle.sync({ alter: true });

        console.log('Syncing ProductBundleItem...');
        await ProductBundleItem.sync({ alter: true });

        console.log('Syncing ProductBundleBranch...');
        await ProductBundleBranch.sync({ alter: true });

        console.log('Syncing BogoPromotion...');
        await BogoPromotion.sync({ alter: true });

        console.log('Syncing BogoPromotionBranch...');
        await BogoPromotionBranch.sync({ alter: true });

        console.log('Syncing Payment...');
        await Payment.sync({ alter: true });

        console.log('All targeted models synced successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing missing models:', error);
        process.exit(1);
    }
}

syncMissing();
