const { Op } = require('sequelize');

/**
 * Generates a random 13-digit barcode with an optional prefix.
 * @param {string} prefix - Optional prefix (e.g. first 4 digits).
 * @returns {string}
 */
function generateRawBarcode(prefix = '') {
    const totalLength = 13;
    const randomLength = totalLength - prefix.length;
    
    if (randomLength <= 0) return prefix.slice(0, totalLength);

    const min = Math.pow(10, randomLength - 1);
    const max = Math.pow(10, randomLength) - 1;
    const randomPart = Math.floor(min + Math.random() * (max - min + 1)).toString();
    
    return prefix + randomPart;
}

/**
 * Ensures the barcode is unique across Product and VariationOption tables.
 * @param {Object} ProductModel 
 * @param {Object} VariationOptionModel 
 * @param {string} prefix - Optional prefix for the barcode.
 * @returns {Promise<string>}
 */
async function generateUniqueBarcode(ProductModel, VariationOptionModel, prefix = '') {
    let barcode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 15;

    while (!isUnique && attempts < maxAttempts) {
        barcode = generateRawBarcode(prefix);
        const productExists = await ProductModel.findOne({ where: { barcode } });
        const optionExists = await VariationOptionModel.findOne({ where: { barcode } });

        if (!productExists && !optionExists) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        throw new Error('Failed to generate a unique barcode after multiple attempts.');
    }

    return barcode;
}

module.exports = {
    generateUniqueBarcode
};
