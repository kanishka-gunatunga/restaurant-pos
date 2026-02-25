const PaymentController = require('./src/controllers/PaymentController');
const Order = require('./src/models/Order');
const Customer = require('./src/models/Customer');
const Payment = require('./src/models/Payment');
const sequelize = require('./src/config/database');

// Load associations
require('./src/models/associations');

async function verify() {
    console.log('--- Verifying Payment API Details Result Format ---');

    try {
        // Mock req and res
        const req = {};
        const res = {
            json: (data) => {
                console.log('API Response:');
                console.log(JSON.stringify(data, null, 2));

                if (Array.isArray(data) && data.length > 0) {
                    const item = data[0];
                    const requiredKeys = ['id', 'orderNo', 'customerName', 'customerMobile', 'dateTime', 'method', 'paymentStatus', 'amount'];
                    const missingKeys = requiredKeys.filter(key => !(key in item));

                    if (missingKeys.length === 0) {
                        console.log('\nSUCCESS: All required fields found in response.');
                    } else {
                        console.error('\nFAILURE: Missing fields:', missingKeys);
                    }
                } else {
                    console.log('\nNo data returned or empty array. Please ensure there is test data in the database.');
                }
            },
            status: (code) => {
                console.log('Response Status:', code);
                return res;
            }
        };

        await PaymentController.getAllPaymentDetails(req, res);
    } catch (error) {
        console.error('Verification failed with error:', error);
    } finally {
        await sequelize.close();
    }
}

verify();
