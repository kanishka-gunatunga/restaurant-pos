// I'll use global fetch which is available in Node 18+.

class MobitelSmsService {
    constructor() {
        this.username = process.env.MOBITEL_USERNAME;
        this.password = process.env.MOBITEL_PASSWORD;
        this.accountNo = process.env.MOBITEL_ACCOUNT;
        this.senderId = process.env.MOBITEL_SENDER_ID;
        this.url = "https://msmsent.mobitel.lk/BulkSMS_v2/SendBulk"; // SOAP endpoint
    }

    async sendInstantSms(numbers, message, campaignName = "Promotions") {
        try {
            const startDate = new Date().toISOString().replace('T', ' ').split('.')[0];
            const endDate = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').split('.')[0];

            let numberListXml = numbers.map(num => `<string>${num}</string>`).join('');

            const xml = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sms.mobitel.lk/">
   <soapenv:Header/>
   <soapenv:Body>
      <ser:SendInstantSMS>
         <SMSDetails>
            <username>${this.username}</username>
            <password>${this.password}</password>
            <account_no>${this.accountNo}</account_no>
            <send_id>${this.senderId}</send_id>
            <language>1</language>
            <sms_content>${message}</sms_content>
            <bulk_start_date>${startDate}</bulk_start_date>
            <bulk_end_date>${endDate}</bulk_end_date>
            <campaign_name>${campaignName}</campaign_name>
            <number_list>${numberListXml}</number_list>
            <add_block_notification>1</add_block_notification>
            <enableTax>2</enableTax>
         </SMSDetails>
      </ser:SendInstantSMS>
   </soapenv:Body>
</soapenv:Envelope>`;

            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'SendInstantSMS'
                },
                body: xml
            });

            const result = await response.text();
            console.log("Mobitel Response:", result);
            return result;
        } catch (error) {
            console.error("Mobitel SMS Error:", error);
            throw error;
        }
    }
}

module.exports = new MobitelSmsService();
