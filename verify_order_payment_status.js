const Order = require('./src/models/Order');
const Payment = require('./src/models/Payment');
const Customer = require('./src/models/Customer');
require('./src/models/associations');
const sequelize = require('./src/config/database');
const { searchOrders, filterOrdersByStatus } = require('./src/controllers/OrderController');

async function verifyOrderPaymentStatus() {
    try {
        console.log('\n--- Verifying Order Payment Status Logic ---\n');

        let responseData = null;
        const mockRes = {
            json: (data) => { responseData = data; return data; },
            status: (code) => ({
                json: (data) => { responseData = data; return { code, data }; }
            }),
            getResponse: () => responseData
        };

        // 1. Create a test customer
        const customer = await Customer.create({ name: 'Payment Test Customer', mobile: '9999999999' });
        console.log('  Created Test Customer (id:', customer.id, ')');

        // 2. Create an order without payment
        const orderNoPayment = await Order.create({
            customerId: customer.id,
            totalAmount: 100.00,
            orderType: 'takeaway',
            status: 'pending'
        });
        console.log('  Created Order without Payment (id:', orderNoPayment.id, ')');

        // 3. Create an order with 'paid' payment
        const orderWithPayment = await Order.create({
            customerId: customer.id,
            totalAmount: 200.00,
            orderType: 'takeaway',
            status: 'pending'
        });
        await Payment.create({
            orderId: orderWithPayment.id,
            amount: 200.00,
            paymentMethod: 'cash',
            status: 'paid'
        });
        console.log('  Created Order with Paid Payment (id:', orderWithPayment.id, ')');

        // 4. Test searchOrders and check paymentStatus
        console.log('\nTesting searchOrders for paymentStatus inclusion:');
        await searchOrders({ query: { q: '9999999999' } }, mockRes);
        let results = mockRes.getResponse();

        const resNoPayment = results.find(o => o.id === orderNoPayment.id);
        const resWithPayment = results.find(o => o.id === orderWithPayment.id);

        console.log('  Order #', orderNoPayment.id, 'paymentStatus:', resNoPayment ? resNoPayment.paymentStatus : 'NOT FOUND', '(Expected: pending)');
        console.log('  Order #', orderWithPayment.id, 'paymentStatus:', resWithPayment ? resWithPayment.paymentStatus : 'NOT FOUND', '(Expected: paid)');

        // 5. Test filterOrdersByStatus with paymentStatus=pending
        console.log('\nTesting filterOrdersByStatus?paymentStatus=pending:');
        await filterOrdersByStatus({ query: { paymentStatus: 'pending' } }, mockRes);
        results = mockRes.getResponse();
        let foundNoPayment = results.find(o => o.id === orderNoPayment.id);
        let foundWithPayment = results.find(o => o.id === orderWithPayment.id);
        console.log('  Found Order without payment:', foundNoPayment ? 'YES (OK)' : 'NO (ERROR)');
        console.log('  Found Order with paid payment:', foundWithPayment ? 'YES (ERROR)' : 'NO (OK)');

        // 6. Test filterOrdersByStatus with paymentStatus=paid
        console.log('\nTesting filterOrdersByStatus?paymentStatus=paid:');
        await filterOrdersByStatus({ query: { paymentStatus: 'paid' } }, mockRes);
        results = mockRes.getResponse();
        foundNoPayment = results.find(o => o.id === orderNoPayment.id);
        foundWithPayment = results.find(o => o.id === orderWithPayment.id);
        console.log('  Found Order without payment:', foundNoPayment ? 'YES (ERROR)' : 'NO (OK)');
        console.log('  Found Order with paid payment:', foundWithPayment ? 'YES (OK)' : 'NO (ERROR)');

        console.log('\n--- Order Payment Status Verification Complete ---');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        // Cleanup
        await Payment.destroy({ where: { status: 'paid' } });
        await Order.destroy({ where: { customerId: { [sequelize.Sequelize.Op.ne]: null } }, force: true });
        await Customer.destroy({ where: { name: 'Payment Test Customer' }, force: true });
        await sequelize.close();
    }
}

verifyOrderPaymentStatus();
