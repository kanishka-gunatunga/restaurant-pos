const User = require('./src/models/User');
const bcrypt = require('bcryptjs');
const sequelize = require('./src/config/database');

// Target user IDs
const TARGET_IDS = [4, 6, 9];

// New passwords mapped to user ID — strong but memorable
const NEW_PASSWORDS = {
    4: 'Ahas@Pos#2024',
    6: 'Resto@Staff#86',
    9: 'Branch@Key#731',
};

async function resetPasswords() {
    try {
        console.log('Fetching users with IDs:', TARGET_IDS);

        const users = await User.findAll({
            where: { id: TARGET_IDS },
            attributes: ['id', 'employeeId', 'role'],
        });

        if (users.length === 0) {
            console.error('No users found for the given IDs.');
            process.exit(1);
        }

        console.log('\n--- Resetting Passwords ---');

        for (const user of users) {
            const newPassword = NEW_PASSWORDS[user.id];
            if (!newPassword) {
                console.warn(`No password defined for user ID ${user.id}, skipping.`);
                continue;
            }

            const hashed = await bcrypt.hash(newPassword, 10);
            await User.update({ password: hashed }, { where: { id: user.id } });

            console.log(`✅  ID: ${user.id} | EmployeeID: ${user.employeeId} | Role: ${user.role} | New Password: ${newPassword}`);
        }

        console.log('\n======================================');
        console.log('  CREDENTIALS — Share Securely');
        console.log('======================================');
        for (const user of users) {
            const newPassword = NEW_PASSWORDS[user.id];
            if (newPassword) {
                console.log(`  EmployeeID : ${user.employeeId}`);
                console.log(`  Password   : ${newPassword}`);
                console.log('--------------------------------------');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error resetting passwords:', error);
        process.exit(1);
    }
}

resetPasswords();
