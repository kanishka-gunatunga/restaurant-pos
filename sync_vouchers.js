const sequelize = require('./src/config/database');
const VoucherTemplate = require('./src/models/VoucherTemplate');

async function syncVouchers() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');
        await VoucherTemplate.sync({ alter: true });
        console.log('VoucherTemplate table synced successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing VoucherTemplate:', error);
        process.exit(1);
    }
}

syncVouchers();
