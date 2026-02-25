const Order = require('./src/models/Order');
const Customer = require('./src/models/Customer');
require('./src/models/associations');
const sequelize = require('./src/config/database');
const { createOrder, updateOrder, getOrderById } = require('./src/controllers/OrderController');

async function verifyDeliveryFields() {
    try {
        console.log('\n--- Verifying Delivery Fields ---');

        // 1. Sync Database
        console.log('Syncing database...');
        await sequelize.sync({ alter: true });
        console.log('Database synced.');

        // 2. Mock req and res for createOrder
        console.log('\nTesting createOrder with delivery fields:');
        const createReq = {
            body: {
                customerMobile: '1234567890',
                customerName: 'Delivery Test User',
                totalAmount: 100.00,
                orderType: 'delivery',
                deliveryAddress: '123 Test St, Test City',
                landmark: 'Near Test Park',
                zipcode: '12345',
                deliveryInstructions: 'Ring the bell twice',
                order_products: []
            },
            user: { id: 1 }
        };

        let createdOrderId;
        const res = {
            status: (code) => ({
                json: (data) => {
                    console.log(`Response [${code}]:`, data.id ? 'Order Created' : data);
                    if (data.id) createdOrderId = data.id;
                }
            }),
            json: (data) => {
                console.log('Response [200]:', data.id ? 'Order Success' : data);
                if (data.id) createdOrderId = data.id;
            }
        };

        await createOrder(createReq, res);

        if (!createdOrderId) {
            throw new Error('Order creation failed');
        }

        // 3. Verify fields in getOrderById
        console.log('\nVerifying fields via getOrderById:');
        const getRes = {
            json: (order) => {
                console.log('Delivery Address:', order.deliveryAddress);
                console.log('Landmark:', order.landmark);
                console.log('Zipcode:', order.zipcode);
                console.log('Instructions:', order.deliveryInstructions);

                if (order.deliveryAddress === '123 Test St, Test City' &&
                    order.landmark === 'Near Test Park' &&
                    order.zipcode === '12345' &&
                    order.deliveryInstructions === 'Ring the bell twice') {
                    console.log('✅ Create Order delivery fields verified!');
                } else {
                    console.log('❌ Create Order delivery fields mismatch!');
                }
            }
        };
        await getOrderById({ params: { id: createdOrderId } }, getRes);

        // 4. Test updateOrder
        console.log('\nTesting updateOrder delivery fields:');
        const updateReq = {
            params: { id: createdOrderId },
            body: {
                deliveryAddress: '456 Updated Ave',
                landmark: 'Opposite Mall',
                zipcode: '54321',
                deliveryInstructions: 'Leave at the door'
            }
        };
        const updateRes = {
            json: (order) => {
                console.log('Updated Delivery Address:', order.deliveryAddress);
                if (order.deliveryAddress === '456 Updated Ave' &&
                    order.landmark === 'Opposite Mall' &&
                    order.zipcode === '54321' &&
                    order.deliveryInstructions === 'Leave at the door') {
                    console.log('✅ Update Order delivery fields verified!');
                } else {
                    console.log('❌ Update Order delivery fields mismatch!');
                }
            }
        };
        await updateOrder(updateReq, updateRes);

        console.log('\n--- Verification Complete ---');
    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await sequelize.close();
    }
}

verifyDeliveryFields();
