import telnyx from 'telnyx';
import { supabase } from '../config/supabase';

interface SMSMessage {
    to: string;
    text: string;
    from?: string;
}

interface BulkSMSMessage {
    to: string[];
    text: string;
    from?: string;
    campaignName?: string;
}

interface SMSResponse {
    message_id: string;
    status: string;
    to: string;
    cost?: number;
}

export class TelnyxSMSService {
    private client: any;
    private fromNumber: string;

    constructor() {
        const apiKey = process.env.TELNYX_API_KEY;
        if (!apiKey) {
            throw new Error('TELNYX_API_KEY is not configured');
        }

        this.client = telnyx(apiKey);
        this.fromNumber = process.env.TELNYX_PHONE_NUMBER || '';

        if (!this.fromNumber) {
            console.warn('⚠️ TELNYX_PHONE_NUMBER not set. SMS sending may fail.');
        }
    }

    /**
     * Send a single SMS message
     */
    async sendSMS(message: SMSMessage): Promise<SMSResponse> {
        try {
            console.log(`📱 Sending SMS to ${message.to}...`);

            // Validate phone number format (E.164)
            if (!message.to.match(/^\+[1-9]\d{1,14}$/)) {
                throw new Error(`Invalid phone number format: ${message.to}. Use E.164 format (e.g., +1234567890)`);
            }

            // Send SMS via Telnyx
            const response = await this.client.messages.create({
                from: message.from || this.fromNumber,
                to: message.to,
                text: message.text
            });

            const smsData = response.data;

            console.log(`✅ SMS sent successfully! Message ID: ${smsData.id}`);

            // Store in database
            await this.storeSMS({
                message_id: smsData.id,
                to_number: message.to,
                from_number: message.from || this.fromNumber,
                message: message.text,
                status: smsData.status || 'sent',
                cost: smsData.cost ? parseFloat(smsData.cost) : 0
            });

            return {
                message_id: smsData.id,
                status: smsData.status || 'sent',
                to: message.to,
                cost: smsData.cost ? parseFloat(smsData.cost) : 0
            };
        } catch (error: any) {
            console.error(`❌ Error sending SMS:`, error);
            throw new Error(`Failed to send SMS: ${error.message}`);
        }
    }

    /**
     * Send bulk SMS to multiple recipients
     */
    async sendBulkSMS(message: BulkSMSMessage): Promise<SMSResponse[]> {
        try {
            console.log(`📨 Sending bulk SMS to ${message.to.length} recipients...`);

            // Create campaign record
            let campaignId: string | null = null;
            if (message.campaignName) {
                const { data: campaign, error } = await supabase
                    .from('telnyx_sms_campaigns')
                    .insert({
                        name: message.campaignName,
                        message: message.text,
                        total_recipients: message.to.length,
                        status: 'sending'
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('Error creating campaign:', error);
                } else {
                    campaignId = campaign.id;
                }
            }

            // Send to each recipient
            const results: SMSResponse[] = [];
            let sentCount = 0;
            let failedCount = 0;
            let totalCost = 0;

            for (const recipient of message.to) {
                try {
                    const result = await this.sendSMS({
                        to: recipient,
                        text: message.text,
                        from: message.from
                    });

                    // Update campaign ID in database
                    if (campaignId) {
                        await supabase
                            .from('telnyx_sms')
                            .update({ campaign_id: campaignId })
                            .eq('message_id', result.message_id);
                    }

                    results.push(result);
                    sentCount++;
                    totalCost += result.cost || 0;

                    console.log(`✅ Sent to ${recipient}`);
                } catch (error: any) {
                    console.error(`❌ Failed to send to ${recipient}:`, error.message);
                    failedCount++;
                    results.push({
                        message_id: `failed-${recipient}`,
                        status: 'failed',
                        to: recipient,
                        cost: 0
                    });
                }
            }

            // Update campaign status
            if (campaignId) {
                await supabase
                    .from('telnyx_sms_campaigns')
                    .update({
                        sent_count: sentCount,
                        failed_count: failedCount,
                        total_cost: totalCost,
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', campaignId);
            }

            console.log(`📊 Bulk SMS complete: ${sentCount} sent, ${failedCount} failed, $${totalCost.toFixed(4)} total cost`);

            return results;
        } catch (error: any) {
            console.error(`❌ Error sending bulk SMS:`, error);
            throw new Error(`Failed to send bulk SMS: ${error.message}`);
        }
    }

    /**
     * Get message status
     */
    async getMessageStatus(messageId: string): Promise<any> {
        try {
            const response = await this.client.messages.retrieve(messageId);
            return response.data;
        } catch (error: any) {
            console.error(`Error getting message status:`, error);
            throw new Error(`Failed to get message status: ${error.message}`);
        }
    }

    /**
     * Handle delivery webhook from Telnyx
     */
    async handleDeliveryWebhook(event: any): Promise<void> {
        try {
            const { event_type, payload } = event.data;
            const messageId = payload.id;

            console.log(`📬 Webhook received: ${event_type} for message ${messageId}`);

            // Update message status in database
            const updateData: any = {
                status: payload.to?.[0]?.status || 'unknown'
            };

            if (payload.to?.[0]?.status === 'delivered') {
                updateData.delivered_at = new Date().toISOString();
            } else if (payload.to?.[0]?.status === 'failed') {
                updateData.failed_at = new Date().toISOString();
                updateData.error_message = payload.errors?.[0]?.detail || 'Unknown error';
            }

            await supabase
                .from('telnyx_sms')
                .update(updateData)
                .eq('message_id', messageId);

            console.log(`✅ Updated message ${messageId} status to ${updateData.status}`);
        } catch (error: any) {
            console.error(`Error handling delivery webhook:`, error);
        }
    }

    /**
     * Store SMS in database
     */
    private async storeSMS(data: any): Promise<void> {
        try {
            const { error } = await supabase
                .from('telnyx_sms')
                .insert({
                    message_id: data.message_id,
                    to_number: data.to_number,
                    from_number: data.from_number,
                    message: data.message,
                    status: data.status,
                    cost: data.cost,
                    sent_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error storing SMS in database:', error);
            }
        } catch (error) {
            console.error('Error storing SMS:', error);
        }
    }

    /**
     * Get SMS list with pagination
     */
    async listSMS(limit: number = 50, offset: number = 0): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('telnyx_sms')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return data;
        } catch (error: any) {
            console.error('Error listing SMS:', error);
            throw new Error(`Failed to list SMS: ${error.message}`);
        }
    }

    /**
     * Get SMS analytics
     */
    async getAnalytics(): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('telnyx_sms')
                .select('status, cost, created_at');

            if (error) throw error;

            const total = data.length;
            const sent = data.filter(s => s.status === 'sent' || s.status === 'delivered').length;
            const delivered = data.filter(s => s.status === 'delivered').length;
            const failed = data.filter(s => s.status === 'failed').length;
            const totalCost = data.reduce((sum, s) => sum + (s.cost || 0), 0);

            return {
                total_sms: total,
                sent_count: sent,
                delivered_count: delivered,
                failed_count: failed,
                delivery_rate: total > 0 ? ((delivered / total) * 100).toFixed(2) : 0,
                total_cost: totalCost.toFixed(4),
                avg_cost: total > 0 ? (totalCost / total).toFixed(4) : 0
            };
        } catch (error: any) {
            console.error('Error getting analytics:', error);
            throw new Error(`Failed to get analytics: ${error.message}`);
        }
    }
}

// Export singleton instance
export const telnyxSMSService = new TelnyxSMSService();
