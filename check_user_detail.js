const UserDetail = require('./src/models/UserDetail');
const sequelize = require('./src/config/database');

async function checkUserDetail() {
    try {
        const detail = await UserDetail.findOne({ where: { userId: 12 } });
        console.log('UserDetail for userId 12:', detail ? detail.toJSON() : 'not found');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUserDetail();
