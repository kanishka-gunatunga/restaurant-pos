const Branch = require('./src/models/Branch');
require('./src/models/associations');
const sequelize = require('./src/config/database');
const BranchController = require('./src/controllers/BranchController');

async function verifyStatusQuery() {
    try {
        console.log('\n--- Verifying Status Query Parameter Logic ---\n');

        let responseData = null;
        const mockRes = {
            json: (data) => { responseData = data; return data; },
            status: (code) => ({
                json: (data) => { responseData = data; return { code, data }; }
            }),
            getResponse: () => responseData
        };

        // 1. Create a test branch and deactivate it
        const branch = await Branch.create({ name: 'Query Test Branch', status: 'active' });
        await Branch.update({ status: 'inactive' }, { where: { id: branch.id } });
        console.log('  Created and Deactivated Branch (id:', branch.id, ')');

        // 2. Test ?status=active (Default)
        console.log('\nTesting ?status=active (Default):');
        await BranchController.getAllBranches({ query: {} }, mockRes);
        let result = mockRes.getResponse();
        let found = result.find(b => b.id === branch.id);
        console.log('  Found Inactive Branch:', found ? 'YES (ERROR)' : 'NO (OK)');

        // 3. Test ?status=inactive
        console.log('\nTesting ?status=inactive:');
        await BranchController.getAllBranches({ query: { status: 'inactive' } }, mockRes);
        result = mockRes.getResponse();
        found = result.find(b => b.id === branch.id);
        console.log('  Found Inactive Branch:', found ? 'YES (OK)' : 'NO (ERROR)');

        // 4. Test ?status=all
        console.log('\nTesting ?status=all:');
        await BranchController.getAllBranches({ query: { status: 'all' } }, mockRes);
        result = mockRes.getResponse();
        found = result.find(b => b.id === branch.id);
        console.log('  Found Inactive Branch:', found ? 'YES (OK)' : 'NO (ERROR)');

        console.log('\n--- Status Query Verification Complete ---');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await Branch.destroy({ where: { name: 'Query Test Branch' }, force: true });
        await sequelize.close();
    }
}

verifyStatusQuery();
