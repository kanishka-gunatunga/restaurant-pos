const sequelize = require('./src/config/database');

async function checkIndexes() {
  try {
    const [results] = await sequelize.query('SHOW INDEX FROM users');
    console.log('Current indexes on table "users":');
    console.table(results.map(r => ({
      Table: r.Table,
      Non_unique: r.Non_unique,
      Key_name: r.Key_name,
      Seq_in_index: r.Seq_in_index,
      Column_name: r.Column_name,
    })));
    
    const count = results.length;
    console.log(`\nTotal indexes: ${count}`);
    
    if (count >= 64) {
      console.warn('\n>>> ALERT: You are at or near the 64-index limit! <<<');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error checking indexes:', err);
    process.exit(1);
  }
}

checkIndexes();
