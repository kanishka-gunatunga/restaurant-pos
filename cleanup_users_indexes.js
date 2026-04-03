const sequelize = require('./src/config/database');

async function cleanupIndexes() {
  try {
    console.log('Fetching indexes for table: users...');
    const [results] = await sequelize.query('SHOW INDEX FROM users');
    
    // We want to keep:
    // 1. PRIMARY
    // 2. Any other necessary indexes (like passcode, role etc if they are indexed)
    // 3. ONLY ONE employee_id index.
    
    const employeeIdIndexes = results.filter(r => r.Column_name === 'employee_id' && r.Key_name !== 'PRIMARY');
    console.log(`Found ${employeeIdIndexes.length} unique indexes for 'employee_id'.`);

    if (employeeIdIndexes.length <= 1) {
      console.log('No redundant employee_id indexes found to clean.');
      process.exit(0);
    }

    // Keep the one with the "best" name (e.g. just 'employee_id' or the first one found)
    const [keep, ...toDrop] = employeeIdIndexes;
    console.log(`Keeping index: ${keep.Key_name}`);
    
    for (const idx of toDrop) {
      console.log(`Dropping redundant index: ${idx.Key_name}...`);
      await sequelize.query(`ALTER TABLE users DROP INDEX ${idx.Key_name}`);
    }

    console.log(`Successfully dropped ${toDrop.length} redundant indexes.`);
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning up indexes:', err);
    process.exit(1);
  }
}

cleanupIndexes();
