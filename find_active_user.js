const User = require('./src/models/User');
const UserDetail = require('./src/models/UserDetail');
const sequelize = require('./src/config/database');

async function findActiveUser() {
    try {
        const users = await User.findAll({
            where: { status: 'active' },
            include: [{ model: UserDetail, as: 'UserDetail' }]
        });
        const validUsers = users.filter(u => u.UserDetail);
        if (validUsers.length > 0) {
            console.log('Active User with Detail:', validUsers[0].employeeId);
        } else {
            console.log('No active users with details found.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findActiveUser();
