const sequelize = require('../src/config/database');

async function addBarcodeColumn() {
    try {
        console.log('Adding barcode column to variationoptions table...');
        await sequelize.query('ALTER TABLE variationoptions ADD COLUMN barcode VARCHAR(255) UNIQUE AFTER name');
        console.log('Column added successfully.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        await sequelize.close();
    }
}

addBarcodeColumn();
