const User = require('./src/models/User');
const sequelize = require('./src/config/database');

async function listUsers() {
    try {
        const users = await User.findAll({ attributes: ['id', 'employeeId', 'role'] });
        console.log('Available users:');
        users.forEach(u => console.log(`- ${u.employeeId} (${u.role})`));
        process.exit(0);
    } catch (error) {
        console.error('Error fetching users:', error);
        process.exit(1);
    }
}

listUsers();
