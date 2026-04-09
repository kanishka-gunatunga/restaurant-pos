const productBundleController = require('../src/controllers/ProductBundleController');
require('../src/models/associations');

const mockUser = { id: 1 };
const mockRes = {
    status: function(s) { this.statusCode = s; return this; },
    json: function(j) { this.body = j; return this; }
};

async function verifyBundleV3() {
    try {
        console.log('Testing createBundle with price metadata...');
        const createReq = {
            user: mockUser,
            body: {
                name: 'Mega Savings Deal',
                description: 'Save big with this mega bundle',
                expire_date: '2026-12-31',
                price: 150.00,
                original_price: 200.00,
                customer_saves: 50.00,
                branches: [1],
                items: [{ productId: 1, quantity: 5 }]
            }
        };

        const resCreate = { ...mockRes };
        await productBundleController.createBundle(createReq, resCreate);
        
        if (resCreate.statusCode === 201) {
            const bundle = resCreate.body;
            console.log('Bundle Created Successfully:', bundle.id);
            console.log('Price:', bundle.price);
            console.log('Original Price:', bundle.original_price);
            console.log('Customer Saves:', bundle.customer_saves);

            // Test Update
            console.log('\nTesting updateBundle metadata...');
            const updateReq = {
                params: { id: bundle.id },
                user: mockUser,
                body: {
                    original_price: 210.00,
                    customer_saves: 60.00
                }
            };

            const resUpdate = { ...mockRes };
            await productBundleController.updateBundle(updateReq, resUpdate);
            console.log('Bundle Updated. New Savings:', resUpdate.body.customer_saves);

        } else {
            console.error('Failed to create bundle:', resCreate.body);
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification Error:', error);
        process.exit(1);
    }
}

verifyBundleV3();
