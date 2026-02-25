const Branch = require('./src/models/Branch');
const Category = require('./src/models/Category');
const Product = require('./src/models/Product');
require('./src/models/associations');
const sequelize = require('./src/config/database');

const BranchController = require('./src/controllers/BranchController');

async function verifyRoleVisibility() {
    try {
        console.log('\n--- Verifying Role-Based Visibility (Admin vs Member) ---\n');

        let responseData = null;
        const mockRes = {
            json: (data) => { responseData = data; return data; },
            status: (code) => ({
                json: (data) => { responseData = data; return { code, data }; }
            }),
            getResponse: () => responseData
        };

        // Create a test branch and deactivate it
        const branch = await Branch.create({ name: 'Role Test Branch', status: 'active' });
        await Branch.update({ status: 'inactive' }, { where: { id: branch.id } });
        console.log('  Created and Deactivated Branch (id:', branch.id, ')');

        // Test as Admin
        console.log('\nTesting visibility for ADMIN:');
        const adminReq = { user: { role: 'admin' } };
        await BranchController.getAllBranches(adminReq, mockRes);
        const adminResult = mockRes.getResponse();
        const foundByAdmin = adminResult.find(b => b.id === branch.id);
        console.log('  Found by Admin:', foundByAdmin ? 'YES (OK)' : 'NO (ERROR)');

        // Test as Member
        console.log('\nTesting visibility for MEMBER:');
        const memberReq = { user: { role: 'member' } };
        await BranchController.getAllBranches(memberReq, mockRes);
        const memberResult = mockRes.getResponse();
        const foundByMember = memberResult.find(b => b.id === branch.id);
        console.log('  Found by Member:', foundByMember ? 'YES (ERROR)' : 'NO (OK)');

        console.log('\n--- Role Visibility Verification Complete ---');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await Branch.destroy({ where: { name: 'Role Test Branch' }, force: true });
        await sequelize.close();
    }
}

verifyRoleVisibility();
