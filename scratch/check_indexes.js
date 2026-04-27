const sequelize = require('../src/config/database');

async function checkIndexes() {
    try {
        const [results] = await sequelize.query('SHOW INDEX FROM user_details');
        console.log('Indexes on user_details:');
        results.forEach(idx => {
            console.log(`- ${idx.Key_name} (Column: ${idx.Column_name}, Unique: ${idx.Non_unique === 0})`);
        });
        console.log(`Total indexes: ${results.length}`);
    } catch (err) {
        console.error('Error checking indexes:', err);
    } finally {
        await sequelize.close();
    }
}

checkIndexes();
