const User = require('./src/models/User');
const UserDetail = require('./src/models/UserDetail');
const bcrypt = require('bcryptjs');
const sequelize = require('./src/config/database');

async function seedUser() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const hashedPasscode = await bcrypt.hash('1234', 10);

        const user = await User.create({
            employeeId: 'EMP001',
            password: hashedPassword,
            role: 'admin',
            passcode: '1234', // In a real scenario, this would be encrypted
            status: 'active'
        });

        await UserDetail.create({
            userId: user.id,
            name: 'Admin User',
            email: 'admin@example.com',
            branchId: 1
        });

        console.log('Test user created successfully: admin / password123 (Passcode: 1234)');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding user:', error);
        process.exit(1);
    }
}

seedUser();
