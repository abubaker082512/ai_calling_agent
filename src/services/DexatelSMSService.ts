/**
 * Dexatel SMS Service
 * Handles single and bulk SMS sending via Dexatel API
 */

import axios from 'axios';

export interface SMSMessage {
    to: string;
    text: string;
    from?: string;
}

export interface BulkSMSMessage {
    to: string[];
    text: string;
    from?: string;
}

export interface SMSResponse {
    message_id: string;
    status: string;
    to: string;
    cost?: number;
}

export class DexatelSMSService {
    private apiKey: string;
    private baseUrl: string = 'https://api.dexatel.com/v1';
    private defaultSender: string;

    constructor() {
        this.apiKey = process.env.DEXATEL_API_KEY || '';
        this.defaultSender = process.env.DEXATEL_FROM_NUMBER || 'Callify';

        if (!this.apiKey) {
            console.warn('⚠️ DEXATEL_API_KEY not set - SMS service will not work');
            return;
        }

        console.log('✅ DexatelSMSService initialized');
    }

    /**
     * Send single SMS
     */
    async sendSMS(message: SMSMessage): Promise<SMSResponse> {
        try {
            if (!this.apiKey) {
                throw new Error('DEXATEL_API_KEY not configured');
            }

            console.log(`📱 Sending SMS to: ${message.to}`);

            const response = await axios.post(
                `${this.baseUrl}/messages`,
                {
                    to: [message.to],
                    text: message.text,
                    from: message.from || this.defaultSender,
                    channel: 'sms'
                },
                {
                    headers: {
                        'X-Dexatel-Key': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            console.log(`✅ SMS sent: ${response.data.id}`);

            return {
                message_id: response.data.id,
                status: response.data.status,
                to: message.to,
                cost: response.data.cost
            };

        } catch (error: any) {
            console.error(`❌ Error sending SMS:`, error.response?.data || error.message);
            throw new Error(`Failed to send SMS: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Send bulk SMS
     */
    async sendBulkSMS(message: BulkSMSMessage): Promise<SMSResponse[]> {
        try {
            if (!this.apiKey) {
                throw new Error('DEXATEL_API_KEY not configured');
            }

            console.log(`📱 Sending bulk SMS to ${message.to.length} recipients`);

            const response = await axios.post(
                `${this.baseUrl}/messages`,
                {
                    to: message.to,
                    text: message.text,
                    from: message.from || this.defaultSender,
                    channel: 'sms'
                },
                {
                    headers: {
                        'X-Dexatel-Key': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            console.log(`✅ Bulk SMS sent: ${response.data.id}`);

            // Return array of responses for each recipient
            return message.to.map((recipient, index) => ({
                message_id: `${response.data.id}-${index}`,
                status: response.data.status,
                to: recipient,
                cost: response.data.cost ? response.data.cost / message.to.length : 0
            }));

        } catch (error: any) {
            console.error(`❌ Error sending bulk SMS:`, error.response?.data || error.message);
            throw new Error(`Failed to send bulk SMS: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get SMS delivery status
     */
    async getSMSStatus(messageId: string): Promise<any> {
        try {
            if (!this.apiKey) {
                throw new Error('DEXATEL_API_KEY not configured');
            }

            const response = await axios.get(
                `${this.baseUrl}/messages/${messageId}`,
                {
                    headers: {
                        'X-Dexatel-Key': this.apiKey,
                        'Accept': 'application/json'
                    }
                }
            );

            return response.data;

        } catch (error: any) {
            console.error(`❌ Error getting SMS status:`, error.response?.data || error.message);
            throw new Error(`Failed to get SMS status: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get SMS balance
     */
    async getBalance(): Promise<any> {
        try {
            if (!this.apiKey) {
                throw new Error('DEXATEL_API_KEY not configured');
            }

            const response = await axios.get(
                `${this.baseUrl}/account/balance`,
                {
                    headers: {
                        'X-Dexatel-Key': this.apiKey,
                        'Accept': 'application/json'
                    }
                }
            );

            return response.data;

        } catch (error: any) {
            console.error(`❌ Error getting balance:`, error.response?.data || error.message);
            throw new Error(`Failed to get balance: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Validate phone number
     */
    validatePhoneNumber(phoneNumber: string): boolean {
        // E.164 format validation
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        return e164Regex.test(phoneNumber);
    }

    /**
     * Parse CSV for bulk SMS
     */
    parseCSV(csvContent: string): string[] {
        const lines = csvContent.split('\n');
        const phoneNumbers: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && this.validatePhoneNumber(trimmed)) {
                phoneNumbers.push(trimmed);
            }
        }

        return phoneNumbers;
    }

    /**
     * Calculate SMS cost estimate
     */
    estimateCost(recipients: number, messageLength: number): number {
        // Dexatel pricing: ~$0.01 per SMS (160 chars)
        const smsCount = Math.ceil(messageLength / 160);
        const costPerSMS = 0.01;
        return recipients * smsCount * costPerSMS;
    }

    /**
     * Split long message into parts
     */
    splitMessage(message: string, maxLength: number = 160): string[] {
        const parts: string[] = [];
        let remaining = message;

        while (remaining.length > 0) {
            parts.push(remaining.substring(0, maxLength));
            remaining = remaining.substring(maxLength);
        }

        return parts;
    }
}
