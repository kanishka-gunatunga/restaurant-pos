const sequelize = require('./src/config/database');
const Payment = require('./src/models/Payment');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await Payment.sync({ alter: true });
        console.log('Payment table synced successfully');
        process.exit(0);
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
})();
