const PaymentController = require('./src/controllers/PaymentController');
const sequelize = require('./src/config/database');

// Load associations
require('./src/models/associations');

async function testSearch(query, label) {
    console.log(`\n--- Testing Search: ${label} ---`);
    console.log(`Query: ${JSON.stringify(query)}`);

    const req = { query };
    const res = {
        json: (data) => {
            console.log(`Results found: ${data.length}`);
            if (data.length > 0) {
                console.log('First result snapshot:');
                console.log(JSON.stringify(data[0], null, 2));
            }
        },
        status: (code) => {
            console.log('Response Status:', code);
            return res;
        }
    };

    await PaymentController.searchPaymentDetails(req, res);
}

async function verify() {
    try {
        // Test 1: Search by Order ID (using query)
        await testSearch({ query: '12' }, 'General search by Order ID (12)');

        // Test 2: Search by Customer Name (using query)
        await testSearch({ query: 'John' }, 'General search by Customer Name (John)');

        // Test 3: Search by Customer Mobile (using query)
        await testSearch({ query: '077' }, 'General search by Customer Mobile (077)');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await sequelize.close();
    }
}

verify();
