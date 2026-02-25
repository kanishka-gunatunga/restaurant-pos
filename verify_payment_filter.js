const PaymentController = require('./src/controllers/PaymentController');
const sequelize = require('./src/config/database');

// Load associations
require('./src/models/associations');

async function testFilter(status, label) {
    console.log(`\n--- Testing Filter: ${label} ---`);
    console.log(`Status: ${status}`);

    const req = { query: { status } };
    const res = {
        json: (data) => {
            console.log(`Results found: ${data.length}`);
            if (data.length > 0) {
                const uniqueStatuses = [...new Set(data.map(item => item.paymentStatus))];
                console.log('Unique statuses in results:', uniqueStatuses);
                console.log('First result snapshot (status check):', data[0].paymentStatus);
            }
        },
        status: (code) => {
            console.log('Response Status:', code);
            return res;
        }
    };

    await PaymentController.filterPaymentsByStatus(req, res);
}

async function verify() {
    try {
        // Test 1: Filter by 'paid'
        await testFilter('paid', 'Filter by paid payments');

        // Test 2: Filter by 'Pending'
        await testFilter('Pending', 'Filter by pending payments');

        // Test 3: Filter by 'refund'
        await testFilter('refund', 'Filter by refund payments');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await sequelize.close();
    }
}

verify();
