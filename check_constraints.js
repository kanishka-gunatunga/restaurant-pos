const sequelize = require('./src/config/database');
async function showCreate() {
    try {
        const [results] = await sequelize.query('SHOW CREATE TABLE user_details');
        console.log(results[0]['Create Table']);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
showCreate();
