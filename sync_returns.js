const sequelize = require('./src/config/database');
const Return = require('./src/models/Return');
const ReturnItem = require('./src/models/ReturnItem');
const Product = require('./src/models/Product');
require('./src/models/associations');

async function syncReturns() {
    try {
        console.log('Syncing returns and return_items tables...');
        await Return.sync({ alter: true });
        await ReturnItem.sync({ alter: true });
        
        console.log('Adding is_returnable to products...');
        await Product.sync({ alter: true });
        
        console.log('Database synced successfully for Returns module.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing database:', error);
        process.exit(1);
    }
}

syncReturns();
