const PDFDocument = require('pdfkit');

class ReceiptPdfService {
    async generateReceiptPdf(data) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: [226, 841.89], // 80mm wide (approx 226 points), height is long (A4 height or adjustable)
                margins: { top: 20, bottom: 20, left: 10, right: 10 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', err => reject(err));

            // Helper to center text
            const centerText = (text, options = {}) => {
                doc.text(text, { align: 'center', ...options });
            };

            // Helper for item lines
            const drawItemLine = (name, price, qty, total) => {
                const startY = doc.y;
                doc.fontSize(8);
                doc.text(name, 10, startY, { width: 100 });
                doc.text(price, 110, startY, { width: 30, align: 'right' });
                doc.text(qty, 140, startY, { width: 25, align: 'right' });
                doc.text(total, 165, startY, { width: 45, align: 'right' });
                doc.moveDown(1.2);
            };

            const drawTotalLine = (label, value, bold = false) => {
                doc.fontSize(bold ? 9 : 8);
                if (bold) doc.font('Helvetica-Bold');
                else doc.font('Helvetica');
                
                const currentY = doc.y;
                doc.text(label, 10, currentY);
                doc.text(`: ${parseFloat(value || 0).toFixed(2)}`, 140, currentY, { width: 70, align: 'right' });
                doc.moveDown(1);
            };

            // ================= HEADER =================
            doc.font('Helvetica-Bold').fontSize(12);
            if (data.branch.name) {
                centerText(data.branch.name.toUpperCase());
            }

            doc.font('Helvetica').fontSize(9);
            if (data.branch.location) {
                centerText(data.branch.location.toUpperCase());
            }
            if (data.branch.mobile) {
                centerText(data.branch.mobile);
            }

            doc.moveDown();

            // ================= ORDER BLOCK =================
            doc.rect(10, doc.y, 206, 25).fill('#000');
            doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10);
            centerText("ORDER NO", { baseline: 'middle' });
            centerText(data.orderId);
            doc.fillColor('#000').font('Helvetica');
            doc.moveDown(1.5);

            // ================= META =================
            doc.fontSize(8);
            const dt = new Date(data.dateTime);
            const dateStr = dt.toISOString().replace('T', ' ').substring(0, 19);

            const printPair = (label, value) => {
                if (!value) return;
                doc.text(`${label.padEnd(12)} : ${value}`);
            };

            printPair("RECEIPT NO", data.receiptNo || data.orderId);
            printPair("DATE", dateStr);
            printPair("CASHIER", (data.cashier || "").toUpperCase());
            printPair("ORDER TYPE", (data.orderType || "Takeaway").toUpperCase());
            printPair("CUSTOMER", (data.customerName || "GUEST").toUpperCase());
            printPair("CONTACT NO", data.customerMobile || "");

            doc.moveDown();
            doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
            doc.moveDown(0.5);

            // ================= TABLE HEADER =================
            doc.font('Helvetica-Bold');
            drawItemLine("ITEM", "PRICE", "QTY", "TOTAL");
            doc.font('Helvetica');
            doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
            doc.moveDown(0.5);

            // ================= ITEMS =================
            for (const item of data.items) {
                let cleanVariation = "";
                if (item.variation) {
                    cleanVariation = item.variation
                        .replace(/variants?:/i, "")
                        .replace(/variation:/i, "")
                        .trim();
                }
                const capitalizeFirst = (str) => {
                    if (!str) return "";
                    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
                };

                const name = cleanVariation
                    ? `${item.name} - ${capitalizeFirst(cleanVariation)}`
                    : item.name;

                doc.font('Helvetica-Bold');
                doc.text(name.toUpperCase(), 10, doc.y, { width: 196 });
                doc.font('Helvetica');

                if (item.modifications && item.modifications.length > 0) {
                    for (const mod of item.modifications) {
                        doc.text(`  - ${mod}`, { indent: 10 });
                    }
                }

                drawItemLine(
                    "",
                    parseFloat(item.price).toFixed(2),
                    `x${item.qty}`,
                    parseFloat(item.amount).toFixed(2)
                );
            }

            doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
            doc.moveDown(0.5);

            // ================= TOTALS =================
            drawTotalLine("GROSS TOTAL", data.totals.subTotal);

            if (parseFloat(data.totals.discount) > 0) {
                drawTotalLine("PROMO DISCOUNT", -Math.abs(data.totals.discount));
            }

            if (parseFloat(data.totals.serviceCharge) > 0) {
                drawTotalLine("SERVICE CHARGE", data.totals.serviceCharge);
            }

            if (parseFloat(data.totals.deliveryCharge) > 0) {
                drawTotalLine("DELIVERY CHARGE", data.totals.deliveryCharge);
            }

            drawTotalLine("NET TOTAL", data.totals.total, true);
            drawTotalLine("PAYMENT", data.payment.paidAmount || data.totals.total);
            drawTotalLine("BALANCE", data.payment.balance || 0, true);

            doc.moveDown();
            doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
            doc.moveDown(0.5);

            // ================= FOOTER =================
            doc.fontSize(8);
            centerText("THANKS FOR CHOOSING US! COME BACK ANYTIME!");
            centerText("SOFTWARE BY SLTMobitel");

            doc.end();
        });
    }
}

module.exports = new ReceiptPdfService();
