const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

class BarcodeService {
    /**
     * Generates a barcode image as a Buffer.
     * @param {string} text - The text to encode in the barcode.
     * @returns {Promise<Buffer>}
     */
    async generateBarcodeImage(text) {
        return bwipjs.toBuffer({
            bcid: 'code128',       // Barcode type (Code 128 is versatile)
            text: text,            // Text to encode
            scale: 3,              // 3x scaling factor
            height: 10,             // Bar height, in millimeters
            includetext: true,     // Show human-readable text below the bars
            textxalign: 'center',
            backgroundcolor: 'FFFFFF'
        });
    }

    /**
     * Generates a printable PDF containing the barcode and product info.
     * @param {string} productName 
     * @param {string} barcode 
     * @param {string|number} price 
     * @returns {Promise<Buffer>}
     */
    async generateBarcodePdf(productName, barcode, price) {
        const imageBuffer = await this.generateBarcodeImage(barcode);
        
        return new Promise((resolve, reject) => {
            // Label size: 50mm x 30mm (approx 142 x 85 points)
            const doc = new PDFDocument({
                size: [141.73, 85.04], 
                margins: { top: 5, bottom: 5, left: 5, right: 5 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', err => reject(err));

            // 1. Product Name
            doc.font('Helvetica-Bold').fontSize(8);
            doc.text(productName.toUpperCase(), { 
                align: 'center',
                width: 131.73,
                height: 20,
                ellipsis: true 
            });
            
            // 2. Barcode Image
            // Position it centrally
            doc.image(imageBuffer, 5, 20, { 
                width: 131.73, 
                height: 40 
            });
            
            // 3. Price (placed at bottom)
            if (price) {
                doc.fontSize(10);
                doc.font('Helvetica-Bold');
                doc.text(`Rs. ${parseFloat(price).toFixed(2)}`, 5, 65, { 
                    align: 'center',
                    width: 131.73
                });
            }

            doc.end();
        });
    }
}

module.exports = new BarcodeService();
