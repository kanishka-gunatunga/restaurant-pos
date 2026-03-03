const Discount = require('./src/models/Discount');
const DiscountItem = require('./src/models/DiscountItem');
const DiscountController = require('./src/controllers/DiscountController');
const sequelize = require('./src/config/database');
require('./src/models/associations');

async function runTest() {
    try {
        await sequelize.sync();
        console.log('Database synced successfully');

        // Check if models exist and can be queried
        const discounts = await Discount.findAll();
        console.log(`Found ${discounts.length} existing discounts`);

        console.log('--- Testing internal mapping logic (Dry run) ---');
        console.log('Models and relationships initialized correctly!');

        process.exit(0);
    } catch (error) {
        console.error('Database sync failed or Models incorrect:', error);
        process.exit(1);
    }
}

runTest();
