const Order = require('./src/models/Order');
const Customer = require('./src/models/Customer');
const OrderItem = require('./src/models/OrderItem');
const Product = require('./src/models/Product');
const Variation = require('./src/models/Variation');
require('./src/models/associations');
const sequelize = require('./src/config/database');
const { searchOrders, filterOrdersByStatus } = require('./src/controllers/OrderController');

async function testAPIs() {
    try {
        console.log('--- Testing Order Search and Filter Logic ---');

        // Mock res object
        const res = {
            json: (data) => console.log('Response Data:', JSON.stringify(data, null, 2)),
            status: (code) => ({
                json: (data) => console.log(`Response [${code}]:`, JSON.stringify(data, null, 2))
            })
        };

        console.log('\n1. Testing searchOrders by q (CustomerID/Name/Phone):');
        await searchOrders({ query: { q: 'John' } }, res);

        console.log('\n2. Testing searchOrders by phone:');
        await searchOrders({ query: { phone: '123' } }, res);

        console.log('\n3. Testing filterOrdersByStatus:');
        await filterOrdersByStatus({ query: { status: 'pending' } }, res);

        console.log('\n--- Verification logic check complete ---');
    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await sequelize.close();
    }
}

testAPIs();
