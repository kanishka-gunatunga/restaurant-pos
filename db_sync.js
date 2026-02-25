const sequelize = require('./src/config/database');
const Branch = require('./src/models/Branch');
const Category = require('./src/models/Category');
const Product = require('./src/models/Product');
const Modification = require('./src/models/Modification');
const Variation = require('./src/models/Variation');
const Customer = require('./src/models/Customer');
require('./src/models/associations');

async function syncDB() {
    try {
        console.log('Syncing database (altering tables)...');
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing database:', error);
        process.exit(1);
    }
}

syncDB();
