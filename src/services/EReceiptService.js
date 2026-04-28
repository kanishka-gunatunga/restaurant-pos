const { put } = require('@vercel/blob');
const ReceiptPdfService = require('./ReceiptPdfService');
const templateService = require('./templateService');
const MobitelSmsService = require('./MobitelSmsService');
const EmailService = require('./EmailService');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const User = require('../models/User');
const UserDetail = require('../models/UserDetail');
const Branch = require('../models/Branch');
const Payment = require('../models/Payment');
const OrderItem = require('../models/OrderItem');
const OrderItemModification = require('../models/OrderItemModification');
const ModificationItem = require('../models/ModificationItem');
const Product = require('../models/Product');
const Variation = require('../models/Variation');
const VariationOption = require('../models/VariationOption');
const { PAYMENT_LIST_ATTRIBUTES } = require('../utils/orderPaymentState');

class EReceiptService {
    async processEReceipt(orderId, paymentRecord, userId) {
        try {
            console.log(`[EReceiptService] Starting e-receipt process for Order #${orderId}`);

            // 1. Fetch full data
            const fullOrder = await Order.findByPk(orderId, {
                include: [
                    { model: Customer, as: 'customer' },
                    { model: User, as: 'user' },
                    {
                        model: OrderItem,
                        as: 'items',
                        include: [
                            { model: Product, as: 'product' },
                            {
                                model: VariationOption,
                                as: 'variationOption',
                                include: [{ model: Variation, as: 'Variation' }]
                            },
                            {
                                model: OrderItemModification,
                                as: 'modifications',
                                include: [{ model: ModificationItem, as: 'modification' }]
                            }
                        ]
                    },
                    {
                        model: Payment,
                        as: 'payments',
                        attributes: PAYMENT_LIST_ATTRIBUTES
                    }
                ]
            });

            if (!fullOrder) {
                console.error(`[EReceiptService] Order #${orderId} not found`);
                return;
            }

            const customerMobile = fullOrder.customer?.mobile;

            const userDetail = await UserDetail.findOne({ where: { userId } });
            const branchId = userDetail?.branchId || 1;
            const branch = await Branch.findByPk(branchId);

            if (fullOrder.user && userDetail) {
                fullOrder.user.name = userDetail.name;
            }

            // 2. Generate structured data
            const data = templateService.generateReceiptStructuredData(fullOrder, paymentRecord, branch);

            // 3. Generate PDF
            const pdfBuffer = await ReceiptPdfService.generateReceiptPdf(data);

            // 4. Upload to Vercel Blob
            // Path: receipts/order_{id}_{timestamp}.pdf
            const fileName = `receipts/order_${orderId}_${Date.now()}.pdf`;
            const blob = await put(fileName, pdfBuffer, {
                access: 'public',
                contentType: 'application/pdf',
            });

            console.log(`[EReceiptService] PDF uploaded to Vercel Blob: ${blob.url}`);

            /*
            // 5. Send SMS (if mobile exists)
            if (customerMobile) {
                try {
                    const message = `Thanks for your order #${data.orderId}! View your e-receipt here: ${blob.url}`;
                    await MobitelSmsService.sendInstantSms([customerMobile], message, "E-Receipt");
                    console.log(`[EReceiptService] SMS sent to ${customerMobile}`);
                } catch (smsError) {
                    console.error(`[EReceiptService] Failed to send SMS:`, smsError.message);
                }
            } else {
                console.log(`[EReceiptService] No customer mobile for Order #${orderId}. Skipping SMS.`);
            }
            */

            // 6. Send Email (hardcoded for testing)
            const customerEmail = "ap0925803@gmail.com";
            try {
                const subject = `Your E-Receipt for Order #${data.orderId}`;
                const text = `Thanks for your order! You can view your e-receipt here: ${blob.url}`;
                const html = `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Thanks for your order!</h2>
                        <p>We appreciate your business. You can view or download your e-receipt by clicking the button below:</p>
                        <a href="${blob.url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">View E-Receipt</a>
                        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">If the button doesn't work, copy and paste this link into your browser: <br/> ${blob.url}</p>
                    </div>
                `;
                await EmailService.sendEmail(customerEmail, subject, text, html);
                console.log(`[EReceiptService] Email sent to ${customerEmail}`);
            } catch (emailError) {
                console.error(`[EReceiptService] Failed to send email:`, emailError.message);
            }

            return blob.url;

        } catch (error) {
            console.error(`[EReceiptService] Error processing e-receipt:`, error);
        }
    }
}

module.exports = new EReceiptService();
