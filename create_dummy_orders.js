const Order = require('./src/models/Order');
const OrderItem = require('./src/models/OrderItem');
const Payment = require('./src/models/Payment');
const Customer = require('./src/models/Customer');
require('./src/models/associations');
const sequelize = require('./src/config/database');

async function createDummyOrders() {
    try {
        console.log('\n--- Creating Dummy Orders for Testing ---\n');

        // IDs from existing DB data
        const customerId = 1; // John Doe
        const productId = 1;  // Chicken Burger
        const variationId = 1; // Regular

        // 1. Order without payment
        const orderNoPayment = await Order.create({
            customerId: customerId,
            totalAmount: 550.00,
            orderType: 'takeaway',
            status: 'pending',
            userId: 1
        });
        await OrderItem.create({
            orderId: orderNoPayment.id,
            productId: productId,
            variationId: variationId,
            quantity: 1,
            unitPrice: 550.00,
            totalPrice: 550.00
        });
        console.log('Order #', orderNoPayment.id, 'created WITHOUT payment.');

        // 2. Order with payment
        const orderWithPayment = await Order.create({
            customerId: customerId,
            totalAmount: 1100.00,
            orderType: 'dine-in',
            status: 'pending',
            userId: 1
        });
        await OrderItem.create({
            orderId: orderWithPayment.id,
            productId: productId,
            variationId: variationId,
            quantity: 2,
            unitPrice: 550.00,
            totalPrice: 1100.00
        });
        await Payment.create({
            orderId: orderWithPayment.id,
            amount: 1100.00,
            paymentMethod: 'cash',
            status: 'paid',
            userId: 1
        });
        console.log('Order #', orderWithPayment.id, 'created WITH PAID payment.');

        console.log('\nDummy orders created successfully! You can now test searching and filtering.');
    } catch (error) {
        console.error('Error creating dummy orders:', error);
    } finally {
        await sequelize.close();
    }
}

createDummyOrders();
