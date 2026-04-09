const sequelize = require('../src/config/database');
const BogoPromotion = require('../src/models/BogoPromotion');
const BogoPromotionBranch = require('../src/models/BogoPromotionBranch');
require('../src/models/associations');

async function sync() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await BogoPromotion.sync({ alter: true });
        await BogoPromotionBranch.sync({ alter: true });
        console.log('BogoPromotion models synced successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
}

sync();
