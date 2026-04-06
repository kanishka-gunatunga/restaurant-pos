const associations = require('../src/models/associations');
const sequelize = require('../src/config/database');
const PaymentController = require('../src/controllers/PaymentController');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const { syncBalanceDuePayment } = require('../src/utils/orderPaymentState');

async function testFix() {
    const t = await sequelize.transaction();
    try {
        console.log('Creating test order...');
        const order = await Order.create({
            totalAmount: 1000,
            status: 'pending',
            orderType: 'takeaway',
            userId: 1,
            branchId: 1
        }, { transaction: t });

        console.log('Creating pending payment (balance_due)...');
        await Payment.create({
            orderId: order.id,
            amount: 1000,
            status: 'pending',
            paymentRole: 'balance_due',
            paymentMethod: 'cash'
        }, { transaction: t });

        await t.commit();
        console.log('Test order created with ID:', order.id);

        const paidAmount = 1200; // Customer gives 1200 for 1000 bill
        
        const req = {
            body: {
                orderId: order.id,
                paymentMethod: 'cash',
                amount: 1000,
                paidAmount: paidAmount,
                status: 'paid'
            },
            user: { id: 1, role: 'admin' },
            ip: '::1'
        };

        const res = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { this.jsonData = data; return this; }
        };

        console.log('Settling payment for order', order.id, 'with paidAmount:', paidAmount);
        await PaymentController.createPayment(req, res);

        console.log('Response status:', res.statusCode);
        
        const settledPayment = await Payment.findOne({
            where: { orderId: order.id, status: 'paid' }
        });

        if (settledPayment) {
            console.log('Settled/Created payment found. ID:', settledPayment.id);
            console.log('Record paidAmount:', settledPayment.paidAmount);
            if (parseFloat(settledPayment.paidAmount) === paidAmount) {
                console.log('SUCCESS: paidAmount was correctly saved during settlement.');
            } else {
                console.log('FAILURE: paidAmount was NOT saved. Value is:', settledPayment.paidAmount);
            }
        } else {
            console.log('FAILURE: No paid payment record found.');
        }

        // Cleanup
        await Payment.destroy({ where: { orderId: order.id } });
        await order.destroy();

    } catch (err) {
        console.error('Test error:', err);
        if (t) await t.rollback();
    } finally {
        await sequelize.close();
    }
}

testFix();
