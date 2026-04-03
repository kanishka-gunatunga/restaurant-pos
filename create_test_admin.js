const User = require('./src/models/User');
const UserDetail = require('./src/models/UserDetail');
const bcrypt = require('bcryptjs');
const { encrypt } = require('./src/utils/crypto');

async function createTestUser() {
    try {
        const password = await bcrypt.hash('testpass123', 10);
        const passcode = encrypt('1234');
        const user = await User.create({
            employeeId: 'EMP_TEST_01',
            password: password,
            role: 'admin',
            passcode: passcode,
            status: 'active'
        });
        await UserDetail.create({
            userId: user.id,
            name: 'Test Administrator',
            email: 'test_admin@example.com',
            branchId: 1
        });
        console.log('Test user EMP_TEST_01 created with password testpass123');
        process.exit(0);
    } catch (error) {
        console.error('Error creating user:', error);
        process.exit(1);
    }
}

createTestUser();
