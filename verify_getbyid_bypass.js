const Product = require('./src/models/Product');
const Category = require('./src/models/Category');
require('./src/models/associations');
const sequelize = require('./src/config/database');
const ProductController = require('./src/controllers/ProductController');
const CategoryController = require('./src/controllers/CategoryController');

async function verifyGetByIdBypass() {
    try {
        console.log('\n--- Verifying GetByID Status Bypass ---\n');

        let responseData = null;
        const mockRes = {
            json: (data) => { responseData = data; return data; },
            status: (code) => ({
                json: (data) => { responseData = data; return { code, data }; }
            }),
            getResponse: () => responseData
        };

        // 1. Create an inactive product
        const product = await Product.create({
            name: 'Bypass Test Product',
            status: 'inactive',
            code: 'BYPASS001',
            sku: 'BYPASS001'
        });
        console.log('  Created Inactive Product (id:', product.id, ')');

        // 2. Try to get it by ID without any query params
        console.log('\nTesting Product GetByID (Standard lookup):');
        await ProductController.getProductById({ params: { id: product.id }, query: {} }, mockRes);
        let result = mockRes.getResponse();

        if (result && result.id === product.id) {
            console.log('  Found Inactive Product by ID: YES (OK)');
        } else {
            console.log('  Found Inactive Product by ID: NO (ERROR)');
            console.log('  Result:', JSON.stringify(result, null, 2));
        }

        // 3. Create an inactive category
        const category = await Category.create({
            name: 'Bypass Test Category',
            status: 'inactive'
        });
        console.log('\n  Created Inactive Category (id:', category.id, ')');

        // 4. Try to get it by ID
        console.log('\nTesting Category GetByID (Standard lookup):');
        await CategoryController.getCategoryById({ params: { id: category.id }, query: {} }, mockRes);
        result = mockRes.getResponse();

        if (result && result.id === category.id) {
            console.log('  Found Inactive Category by ID: YES (OK)');
        } else {
            console.log('  Found Inactive Category by ID: NO (ERROR)');
        }

        console.log('\n--- GetByID Status Bypass Verification Complete ---');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        // Cleanup handled by sequelize or manual destroy if needed
        await Product.destroy({ where: { code: 'BYPASS001' }, force: true });
        await Category.destroy({ where: { name: 'Bypass Test Category' }, force: true });
        await sequelize.close();
    }
}

verifyGetByIdBypass();
