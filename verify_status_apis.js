const Branch = require('./src/models/Branch');
const Category = require('./src/models/Category');
const Product = require('./src/models/Product');
const Modification = require('./src/models/Modification');
require('./src/models/associations');
const sequelize = require('./src/config/database');

const BranchController = require('./src/controllers/BranchController');
const CategoryController = require('./src/controllers/CategoryController');
const ProductController = require('./src/controllers/ProductController');
const ModificationController = require('./src/controllers/ModificationController');

async function verify() {
    try {
        console.log('\n--- Verifying Activation/Deactivation Logic ---\n');

        let responseData = null;
        const mockRes = {
            json: (data) => { responseData = data; return data; },
            status: (code) => ({
                json: (data) => { responseData = data; return { code, data }; }
            }),
            getResponse: () => responseData
        };

        // 1. Verify Branch
        console.log('Testing Branch:');
        const branch = await Branch.create({ name: 'Test Branch' });
        console.log('  Created:', branch.id, branch.name, branch.status);

        await BranchController.deactivateBranch({ params: { id: branch.id } }, mockRes);
        const branchAfterDeactivate = await Branch.findByPk(branch.id);
        console.log('  After Deactivate:', branchAfterDeactivate.status);

        await BranchController.getAllBranches({}, mockRes);
        const allActiveBranches = mockRes.getResponse();
        const found = allActiveBranches.find(b => b.id === branch.id);
        console.log('  In getAllBranches (Active only):', found ? 'FOUND (ERROR)' : 'NOT FOUND (OK)');

        await BranchController.activateBranch({ params: { id: branch.id } }, mockRes);
        const branchAfterActivate = await Branch.findByPk(branch.id);
        console.log('  After Activate:', branchAfterActivate.status);

        // 2. Verify Category
        console.log('\nTesting Category:');
        const category = await Category.create({ name: 'Test Category' });
        console.log('  Created:', category.id, category.name, category.status);

        await CategoryController.deactivateCategory({ params: { id: category.id } }, mockRes);
        const catAfterDeactivate = await Category.findByPk(category.id);
        console.log('  After Deactivate:', catAfterDeactivate.status);

        await CategoryController.getAllCategories({}, mockRes);
        const allActiveCats = mockRes.getResponse();
        const catFound = allActiveCats.find(c => c.id === category.id);
        console.log('  In getAllCategories (Active only):', catFound ? 'FOUND (ERROR)' : 'NOT FOUND (OK)');

        // 3. Verify Product
        console.log('\nTesting Product:');
        const prod = await Product.create({
            name: 'Test Product',
            code: 'TP001',
            sku: 'TEST-SKU',
            categoryId: category.id
        });
        console.log('  Created:', prod.id, prod.name, prod.status);

        await ProductController.deactivateProduct({ params: { id: prod.id } }, mockRes);
        const prodAfterDeactivate = await Product.findByPk(prod.id);
        console.log('  After Deactivate:', prodAfterDeactivate.status);

        await ProductController.getAllProducts({ query: {} }, mockRes);
        const allActiveProds = mockRes.getResponse();
        const prodFound = allActiveProds.find(p => p.id === prod.id);
        console.log('  In getAllProducts (Active only):', prodFound ? 'FOUND (ERROR)' : 'NOT FOUND (OK)');

        await ProductController.activateProduct({ params: { id: prod.id } }, mockRes);
        const prodAfterActivate = await Product.findByPk(prod.id);
        console.log('  After Activate:', prodAfterActivate.status);

        // Cleanup test data (actually we just leave them as inactive or active since they are test records)

        console.log('\n--- Verification complete ---');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        // Clean up
        await Branch.destroy({ where: { name: 'Test Branch' }, force: true });
        await Category.destroy({ where: { name: 'Test Category' }, force: true });
        await sequelize.close();
    }
}

verify();
