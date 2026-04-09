const productBundleController = require('../src/controllers/ProductBundleController');
const ProductBundle = require('../src/models/ProductBundle');
const ProductBundleBranch = require('../src/models/ProductBundleBranch');
const ProductBundleItem = require('../src/models/ProductBundleItem');
require('../src/models/associations');

// Mock req and res
const mockUser = { id: 1 };
const mockRes = {
    status: function(s) { this.statusCode = s; return this; },
    json: function(j) { this.body = j; return this; }
};

async function verifyBundleV2() {
    try {
        console.log('Testing createBundle...');
        const createReq = {
            user: mockUser,
            body: {
                name: 'Summer Deal',
                description: 'Special summer bundle with drinks and snacks',
                expire_date: '2026-08-31',
                price: 49.99,
                branches: [1], // Select branch 1
                items: [
                    { productId: 1, quantity: 2 }
                ]
            }
        };

        const resCreate = { ...mockRes };
        await productBundleController.createBundle(createReq, resCreate);
        
        if (resCreate.statusCode === 201) {
            const bundle = resCreate.body;
            console.log('Bundle Created Successfully:', bundle.id);
            console.log('Description:', bundle.description);
            console.log('Expire Date:', bundle.expire_date);
            console.log('Price:', bundle.price);
            console.log('Branches count:', bundle.branches.length);

            // Verify branch data (should not have price)
            console.log('Branch 1 price (should be undefined):', bundle.branches[0].price);

            // Test Update
            console.log('\nTesting updateBundle...');
            const updateReq = {
                params: { id: bundle.id },
                user: mockUser,
                body: {
                    name: 'Summer Deal Updated',
                    price: 55.00,
                    description: 'Updated description'
                }
            };

            const resUpdate = { ...mockRes };
            await productBundleController.updateBundle(updateReq, resUpdate);
            console.log('Bundle Updated. New Price:', resUpdate.body.price);

        } else {
            console.error('Failed to create bundle:', resCreate.body);
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification Error:', error);
        process.exit(1);
    }
}

verifyBundleV2();
