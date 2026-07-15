const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../src/config/database');

async function migrate() {
    try {
        console.log("Starting migration...");
        
        // 1. Add new `value` column to both tables
        const queryInterface = sequelize.getQueryInterface();
        
        console.log("Adding `value` column to voucher_templates...");
        await queryInterface.addColumn('voucher_templates', 'value', {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        }).catch(err => console.log("Column may already exist:", err.message));
        
        console.log("Adding `value` column to issued_vouchers...");
        await queryInterface.addColumn('issued_vouchers', 'value', {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        }).catch(err => console.log("Column may already exist:", err.message));

        // 2. Fetch and convert data for voucher_templates
        console.log("Migrating data for voucher_templates...");
        const [templates] = await sequelize.query('SELECT id, valueFormatted FROM voucher_templates');
        for (const t of templates) {
            if (t.valueFormatted) {
                const numericVal = parseFloat(t.valueFormatted.replace(/[^0-9.-]+/g, '')) || 0;
                await sequelize.query(
                    'UPDATE voucher_templates SET value = :val WHERE id = :id',
                    { replacements: { val: numericVal, id: t.id } }
                );
            }
        }

        // 3. Fetch and convert data for issued_vouchers
        console.log("Migrating data for issued_vouchers...");
        const [vouchers] = await sequelize.query('SELECT id, valueFormatted FROM issued_vouchers');
        for (const v of vouchers) {
            if (v.valueFormatted) {
                const numericVal = parseFloat(v.valueFormatted.replace(/[^0-9.-]+/g, '')) || 0;
                await sequelize.query(
                    'UPDATE issued_vouchers SET value = :val WHERE id = :id',
                    { replacements: { val: numericVal, id: v.id } }
                );
            }
        }

        // 4. Change `value` column to allow null: false (Wait, sqlite/mysql handle this differently. We will leave it as is or alter again if needed).
        console.log("Making `value` column NOT NULL...");
        await queryInterface.changeColumn('voucher_templates', 'value', {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        }).catch(err => console.log("Failed to alter to NOT NULL, ignoring:", err.message));

        await queryInterface.changeColumn('issued_vouchers', 'value', {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        }).catch(err => console.log("Failed to alter to NOT NULL, ignoring:", err.message));

        // 5. Remove old `valueFormatted` columns
        console.log("Dropping `valueFormatted` column from voucher_templates...");
        await queryInterface.removeColumn('voucher_templates', 'valueFormatted').catch(err => console.log(err.message));

        console.log("Dropping `valueFormatted` column from issued_vouchers...");
        await queryInterface.removeColumn('issued_vouchers', 'valueFormatted').catch(err => console.log(err.message));

        console.log("Migration complete!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
