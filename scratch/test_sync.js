const UserDetail = require('../src/models/UserDetail');
const sequelize = require('../src/config/database');

async function triggerSync() {
    try {
        console.log('Triggering sync for UserDetail...');
        await UserDetail.sync({ alter: true, logging: console.log });
        console.log('Sync finished.');
        
        const [results] = await sequelize.query('SHOW INDEX FROM user_details');
        console.log('Indexes on user_details after sync:');
        results.forEach(idx => {
            console.log(`- ${idx.Key_name} (Column: ${idx.Column_name}, Unique: ${idx.Non_unique === 0})`);
        });
    } catch (err) {
        console.error('Error during sync test:', err);
    } finally {
        await sequelize.close();
    }
}

triggerSync();
