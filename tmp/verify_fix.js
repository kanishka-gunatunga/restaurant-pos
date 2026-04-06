const associations = require('../src/models/associations');
const sequelize = require('../src/config/database');
const PaymentController = require('../src/controllers/PaymentController');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');

async function testSettlePayment() {
    const orderId = 142;
    const paidAmount = 1500;
    const amount = 1350; // The order total for 142 is 1350 + 150 delivery = 1500. Actually let's check it again.
    
    // Order 142 totalAmount: 1350, deliveryChargeAmount: 150. Total = 1500.
    
    // Create a mock request and response
    const req = {
        body: {
            orderId,
            paymentMethod: 'cash',
            amount: 1500,
            paidAmount: 1500,
            status: 'paid'
        },
        user: { id: 1, role: 'admin' },
        ip: '::1'
    };

    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.jsonData = data;
            return this;
        }
    };

    try {
        console.log('Testing createPayment for Order 142...');
        await PaymentController.createPayment(req, res);
        
        console.log('Response Status:', res.statusCode);
        console.log('Response JSON:', JSON.stringify(res.jsonData, null, 2));

        if (res.statusCode === 200 || res.statusCode === 201) {
            const paymentId = res.jsonData.id;
            const updatedPayment = await Payment.findByPk(paymentId);
            console.log('Saved Payment paidAmount:', updatedPayment.paidAmount);
            if (updatedPayment.paidAmount == paidAmount) {
                console.log('SUCCESS: paidAmount was correctly saved.');
            } else {
                console.log('FAILURE: paidAmount was NOT correctly saved.');
            }
        } else {
            console.log('FAILED to create/settle payment. Error:', res.jsonData.message);
        }
    } catch (err) {
        console.error('Test execution error:', err);
    } finally {
        await sequelize.close();
    }
}

testSettlePayment();
