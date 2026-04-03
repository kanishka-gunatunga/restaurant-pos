const User = require('./src/models/User');
const sequelize = require('./src/config/database');

async function checkUser() {
    try {
        const user = await User.findOne({ where: { employeeId: 'EMP001' } });
        console.log('User EMP001:', user ? user.toJSON() : 'not found');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUser();
