const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    async sendEmail(to, subject, text, html) {
        try {
            const info = await this.transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Restaurant POS'}" <${process.env.SMTP_USER}>`,
                to,
                subject,
                text,
                html,
            });
            console.log(`[EmailService] Email sent: ${info.messageId}`);
            return info;
        } catch (error) {
            console.error(`[EmailService] Error sending email:`, error.message);
            throw error;
        }
    }
}

module.exports = new EmailService();
