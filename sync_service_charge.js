const ServiceCharge = require('./src/models/ServiceCharge');
const sequelize = require('./src/config/database');

async function syncModel() {
    try {
        await ServiceCharge.sync({ alter: true });
        console.log('Model ServiceCharge synced successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing ServiceCharge:', error);
        process.exit(1);
    }
}

syncModel();
