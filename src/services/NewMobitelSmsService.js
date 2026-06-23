class NewMobitelSmsService {
    constructor() {
        this.username = process.env.MOBITEL_SMS_USERNAME;
        this.password = process.env.MOBITEL_SMS_PASSWORD;
        this.alias = process.env.MOBITEL_SMS_ALIAS;
        this.apiUrl = process.env.MOBITEL_SMS_API_URL;

        this.RESPONSE_CODES = {
            200: "Message received OK",
            151: "Invalid session",
            152: "Session is still in use for previous request",
            155: "Service halted",
            156: "Other network messaging disabled",
            157: "IDD messages disabled",
            159: "Failed credit check",
            160: "No message found",
            161: "Message exceeding 160 characters",
            162: "Invalid message type found",
            164: "Invalid group",
            165: "No recipients found",
            166: "Recipient list exceeding allowed limit",
            167: "Invalid long number",
            168: "Invalid short code",
            169: "Invalid alias",
            170: "Black listed numbers in number list",
            171: "Non-white listed numbers in number list",
        };
    }

    /**
     * Send an SMS using Mobitel Enterprise SMS API via query parameters
     * @param {string|string[]} to Single string or array of recipient numbers
     * @param {string} text The message to send
     * @param {number} messageType 1 for Promotional, 0 for Non-Promotional (default: 0)
     */
    async sendSms(to, text, messageType = 0) {
        try {
            let currentAlias = this.alias;
            if (currentAlias.length > 11) {
                currentAlias = currentAlias.substring(0, 11);
            }

            const recipients = Array.isArray(to) ? to.join(",") : to;

            const params = new URLSearchParams({
                m: text,
                r: recipients,
                a: currentAlias,
                u: this.username,
                p: this.password,
                t: messageType.toString()
            });

            const requestUrl = `${this.apiUrl}?${params.toString()}`;

            const response = await fetch(requestUrl, {
                method: 'POST'
            });

            const resultData = await response.text();
            console.log(`[NewMobitelSmsService] Raw API Response:`, resultData);

            let parsedCode;
            try {
                const parsed = JSON.parse(resultData.trim());
                parsedCode = Number(parsed.resultcode || parsed.status || parsed.code);
            } catch (e) {
                parsedCode = Number(resultData.trim());
            }

            if (response.status === 200) {
                if (!isNaN(parsedCode) && parsedCode !== 200) {
                    const errorMsg = this.RESPONSE_CODES[parsedCode] || `Unknown response code: ${parsedCode}`;
                    console.error(`[NewMobitelSmsService] API Error: [${parsedCode}] ${errorMsg}`);
                    return false;
                }

                console.log(`[NewMobitelSmsService] SMS sent successfully to ${recipients}`);
                return true;
            } else {
                console.error(`[NewMobitelSmsService] HTTP Error: [${response.status}] ${response.statusText}`);
                return false;
            }
        } catch (error) {
            console.error("[NewMobitelSmsService] Exception:", error.message || error);
            return false;
        }
    }

    /**
     * Send a promotional message
     * @param {string|string[]} to 
     * @param {string} text 
     */
    async sendPromotionMessage(to, text) {
        return this.sendSms(to, text, 1);
    }
}

module.exports = new NewMobitelSmsService();
