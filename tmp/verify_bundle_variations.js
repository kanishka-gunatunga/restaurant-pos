const productBundleController = require('../src/controllers/ProductBundleController');
require('../src/models/associations');

const mockUser = { id: 1 };
const mockRes = {
    status: function(s) { this.statusCode = s; return this; },
    json: function(j) { this.body = j; return this; }
};

async function verifyBundleVariations() {
    try {
        console.log('Testing createBundle with variations...');
        const createReq = {
            user: mockUser,
            body: {
                name: 'Variation Bundle',
                description: 'Bundle with a product and a variation',
                expire_date: '2026-12-31',
                price: 100.00,
                original_price: 140.00,
                customer_saves: 40.00,
                branches: [1],
                items: [
                    { productId: 1, quantity: 1 }, // Simple product
                    { productId: 1, variationOptionId: 5, quantity: 1 } // Specific variation
                ]
            }
        };

        const resCreate = { ...mockRes };
        await productBundleController.createBundle(createReq, resCreate);
        
        if (resCreate.statusCode === 201) {
            const bundle = resCreate.body;
            console.log('Bundle Created Successfully:', bundle.id);
            console.log('Items Count:', bundle.items.length);
            
            bundle.items.forEach((item, index) => {
                console.log(`Item ${index + 1}: Product ID ${item.productId}, Variation ID ${item.variationOptionId}, Variation Data:`, item.variationOption ? 'Present' : 'Missing');
            });

            // Test Update
            console.log('\nTesting updateBundle items...');
            const updateReq = {
                params: { id: bundle.id },
                user: mockUser,
                body: {
                    items: [
                        { productId: 1, variationOptionId: 5, quantity: 5 }
                    ]
                }
            };

            const resUpdate = { ...mockRes };
            await productBundleController.updateBundle(updateReq, resUpdate);
            console.log('Bundle Updated. New Item Quantity:', resUpdate.body.items[0].quantity);

        } else {
            console.error('Failed to create bundle:', resCreate.body);
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification Error:', error);
        process.exit(1);
    }
}

verifyBundleVariations();
