const Category = require('./src/models/Category');
const CategoryController = require('./src/controllers/CategoryController');
const sequelize = require('./src/config/database');
require('./src/models/associations');

async function runTest() {
    try {
        await sequelize.sync();
        console.log('Database synced');

        // Mock response helper
        const mockRes = () => {
            const res = {};
            res.status = (code) => {
                res.statusCode = code;
                return res;
            };
            res.json = (data) => {
                res.body = data;
                return res;
            };
            return res;
        };

        // 1. Test creation
        console.log('\n--- Testing Creation ---');
        const createReq = {
            body: {
                name: 'Main Category Test',
                subcategories: ['Sub 1', 'Sub 2']
            }
        };
        const createRes = mockRes();
        await CategoryController.createCategory(createReq, createRes);

        console.log('Create Status:', createRes.statusCode || 200);
        console.log('Created Parent:', createRes.body.name);
        console.log('Subcategories Count:', createRes.body.subcategories.length);

        const parentId = createRes.body.id;
        const sub1 = createRes.body.subcategories[0];
        const sub2 = createRes.body.subcategories[1];

        // 2. Test edit
        console.log('\n--- Testing Edit (Update name, add new, remove old) ---');
        const updateReq = {
            params: { id: parentId },
            body: {
                name: 'Main Category Updated',
                subcategories: [
                    { id: sub1.id, name: 'Sub 1 Updated' }, // update existing
                    { name: 'Sub 3 New' } // add new
                    // Sub 2 is missing, so it should be deleted
                ]
            }
        };
        const updateRes = mockRes();
        await CategoryController.updateCategory(updateReq, updateRes);
        console.log('Update Status:', updateRes.statusCode || 200);
        console.log('Update Response:', updateRes.body.message);

        // 3. Verify final state
        console.log('\n--- Verifying Final State ---');
        const finalParent = await Category.findByPk(parentId, {
            include: [{ model: Category, as: 'subcategories' }]
        });

        console.log('Final Parent Name:', finalParent.name);
        console.log('Final Subcategories:');
        finalParent.subcategories.forEach(s => {
            console.log(`- ${s.name} (ID: ${s.id})`);
        });

        if (finalParent.name === 'Main Category Updated' &&
            finalParent.subcategories.length === 2 &&
            finalParent.subcategories.some(s => s.name === 'Sub 1 Updated') &&
            finalParent.subcategories.some(s => s.name === 'Sub 3 New') &&
            !finalParent.subcategories.some(s => s.name === 'Sub 2')) {
            console.log('\nVERIFICATION SUCCESSFUL');
        } else {
            console.log('\nVERIFICATION FAILED');
        }

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTest();
