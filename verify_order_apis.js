const Order = require('./src/models/Order');
const Customer = require('./src/models/Customer');
const OrderItem = require('./src/models/OrderItem');
const Product = require('./src/models/Product');
const Variation = require('./src/models/Variation');
require('./src/models/associations');
const sequelize = require('./src/config/database');
const { searchOrders, filterOrdersByStatus, getAllOrders, getOrderById } = require('./src/controllers/OrderController');

async function testAPIs() {
    try {
        console.log('\n--- Testing Order Search and Filter Logic ---');

        // Mock res object
        const res = {
            json: (data) => {
                const isArray = Array.isArray(data);
                const firstItem = isArray ? data[0] : data;
                console.log('Response Data Check:',
                    isArray ? `Array[${data.length}]` : (data ? 'Object' : 'Null'),
                    firstItem && firstItem.customer ? 'Customer Included' : 'No Customer'
                );
                if (firstItem) {
                    console.log('Order ID:', firstItem.id);
                    console.log('Order Customer ID:', firstItem.customerId);
                    console.log('Order Fields:', Object.keys(firstItem.dataValues || firstItem));
                    if (firstItem.customer) {
                        console.log('Customer Details:', JSON.stringify(firstItem.customer));
                    } else {
                        console.log('Customer field is MISSING or NULL');
                    }
                }
            },
            status: (code) => ({
                json: (data) => console.log(`Response [${code}]:`, data)
            })
        };

        console.log('\n1. Testing getAllOrders:');
        await getAllOrders({}, res);

        console.log('\n2. Testing searchOrders by q:');
        await searchOrders({ query: { q: 'John' } }, res);

        console.log('\n3. Testing filterOrdersByStatus:');
        await filterOrdersByStatus({ query: { status: 'pending' } }, res);

        console.log('\n4. Testing getOrderById:');
        await getOrderById({ params: { id: 7 } }, res);

        console.log('\n--- Verification logic check complete ---');
    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await sequelize.close();
    }
}

testAPIs();
