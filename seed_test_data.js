const sequelize = require('./src/config/database');
const Customer = require('./src/models/Customer');
const Order = require('./src/models/Order');
require('./src/models/associations');

async function seedTestData() {
    try {
        await sequelize.sync();

        // Create a test customer
        const [customer] = await Customer.findOrCreate({
            where: { mobile: '1234567890' },
            defaults: { name: 'Test John' }
        });

        console.log('Test Customer:', customer.name, '(', customer.id, ')');

        // Create a test order for this customer
        const order = await Order.create({
            customerId: customer.id,
            totalAmount: 150.00,
            orderType: 'dining',
            status: 'pending'
        });

        console.log('Test Order Created with ID:', order.id);

    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await sequelize.close();
    }
}

seedTestData();
