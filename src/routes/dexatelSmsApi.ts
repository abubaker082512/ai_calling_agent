/**
 * Dexatel SMS API Routes
 * Endpoints for single and bulk SMS operations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DexatelSMSService } from '../services/DexatelSMSService';
import { SupabaseService } from '../services/supabase';

interface SendSMSRequest {
    to: string;
    message: string;
    from?: string;
}

interface BulkSMSRequest {
    to: string[];
    message: string;
    from?: string;
    campaignName?: string;
}

interface MessageIdParams {
    messageId: string;
}

export default async function dexatelSmsApiRoutes(fastify: FastifyInstance) {
    const smsService = new DexatelSMSService();
    const supabase = new SupabaseService();

    console.log('✅ Dexatel SMS API routes initialized');

    /**
     * POST /api/dexatel/sms/send
     * Send single SMS
     */
    fastify.post('/send', async (request: FastifyRequest<{ Body: SendSMSRequest }>, reply: FastifyReply) => {
        try {
            const { to, message, from } = request.body;

            if (!to || !message) {
                return reply.code(400).send({ error: 'Phone number and message required' });
            }

            // Validate phone number
            if (!smsService.validatePhoneNumber(to)) {
                return reply.code(400).send({ error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)' });
            }

            console.log(`📱 Sending SMS to: ${to}`);

            const result = await smsService.sendSMS({ to, text: message, from });

            // Log to database
            await supabase.client.from('dexatel_sms').insert({
                message_id: result.message_id,
                to_number: to,
                from_sender: from || process.env.DEXATEL_FROM_NUMBER,
                message: message,
                status: result.status,
                cost: result.cost || 0,
                sent_at: new Date().toISOString()
            });

            return reply.code(200).send({
                success: true,
                result
            });

        } catch (error: any) {
            console.error('❌ Error sending SMS:', error);
            return reply.code(500).send({
                error: 'Failed to send SMS',
                message: error.message
            });
        }
    });

    /**
     * POST /api/dexatel/sms/bulk
     * Send bulk SMS
     */
    fastify.post('/bulk', async (request: FastifyRequest<{ Body: BulkSMSRequest }>, reply: FastifyReply) => {
        try {
            const { to, message, from, campaignName } = request.body;

            if (!to || !Array.isArray(to) || to.length === 0 || !message) {
                return reply.code(400).send({ error: 'Recipients array and message required' });
            }

            // Validate all phone numbers
            const invalidNumbers = to.filter(num => !smsService.validatePhoneNumber(num));
            if (invalidNumbers.length > 0) {
                return reply.code(400).send({
                    error: 'Invalid phone numbers found',
                    invalidNumbers
                });
            }

            console.log(`📱 Sending bulk SMS to ${to.length} recipients`);

            // Create campaign
            const { data: campaign } = await supabase.client
                .from('dexatel_sms_campaigns')
                .insert({
                    name: campaignName || `Campaign ${new Date().toISOString()}`,
                    message: message,
                    total_recipients: to.length,
                    sent_count: 0,
                    delivered_count: 0,
                    failed_count: 0,
                    status: 'sending'
                })
                .select()
                .single();

            // Send bulk SMS
            const results = await smsService.sendBulkSMS({ to, text: message, from });

            // Log each SMS to database
            const smsRecords = results.map(result => ({
                message_id: result.message_id,
                to_number: result.to,
                from_sender: from || process.env.DEXATEL_FROM_NUMBER,
                message: message,
                status: result.status,
                cost: result.cost || 0,
                campaign_id: campaign?.id,
                sent_at: new Date().toISOString()
            }));

            await supabase.client.from('dexatel_sms').insert(smsRecords);

            // Update campaign
            await supabase.client
                .from('dexatel_sms_campaigns')
                .update({
                    sent_count: to.length,
                    status: 'sent',
                    total_cost: results.reduce((sum, r) => sum + (r.cost || 0), 0)
                })
                .eq('id', campaign?.id);

            return reply.code(200).send({
                success: true,
                campaignId: campaign?.id,
                sent: to.length,
                results
            });

        } catch (error: any) {
            console.error('❌ Error sending bulk SMS:', error);
            return reply.code(500).send({
                error: 'Failed to send bulk SMS',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/sms/list
     * List sent SMS
     */
    fastify.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { data: messages, error } = await supabase.client
                .from('dexatel_sms')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            return reply.code(200).send({
                success: true,
                messages: messages || []
            });

        } catch (error: any) {
            console.error('❌ Error fetching SMS:', error);
            return reply.code(500).send({
                error: 'Failed to fetch SMS',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/sms/:messageId
     * Get SMS details
     */
    fastify.get('/:messageId', async (request: FastifyRequest<{ Params: MessageIdParams }>, reply: FastifyReply) => {
        try {
            const { messageId } = request.params;

            const { data: sms, error } = await supabase.client
                .from('dexatel_sms')
                .select('*')
                .eq('message_id', messageId)
                .single();

            if (error) throw error;

            if (!sms) {
                return reply.code(404).send({ error: 'SMS not found' });
            }

            // Get live status from Dexatel
            try {
                const liveStatus = await smsService.getSMSStatus(messageId);
                return reply.code(200).send({
                    success: true,
                    sms: {
                        ...sms,
                        live_status: liveStatus
                    }
                });
            } catch (err) {
                // Return DB data if API call fails
                return reply.code(200).send({
                    success: true,
                    sms
                });
            }

        } catch (error: any) {
            console.error('❌ Error fetching SMS:', error);
            return reply.code(500).send({
                error: 'Failed to fetch SMS',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/sms/analytics
     * Get SMS analytics
     */
    fastify.get('/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { data: messages } = await supabase.client
                .from('dexatel_sms')
                .select('*');

            const { data: campaigns } = await supabase.client
                .from('dexatel_sms_campaigns')
                .select('*');

            const analytics = {
                total_sms: messages?.length || 0,
                total_campaigns: campaigns?.length || 0,
                total_cost: messages?.reduce((sum, m) => sum + (m.cost || 0), 0) || 0,
                avg_cost: messages?.length ?
                    (messages.reduce((sum, m) => sum + (m.cost || 0), 0) / messages.length) : 0,
                by_status: {
                    sent: messages?.filter(m => m.status === 'sent').length || 0,
                    delivered: messages?.filter(m => m.status === 'delivered').length || 0,
                    failed: messages?.filter(m => m.status === 'failed').length || 0
                }
            };

            return reply.code(200).send({
                success: true,
                analytics
            });

        } catch (error: any) {
            console.error('❌ Error fetching analytics:', error);
            return reply.code(500).send({
                error: 'Failed to fetch analytics',
                message: error.message
            });
        }
    });

    /**
     * POST /api/dexatel/sms/estimate
     * Estimate SMS cost
     */
    fastify.post('/estimate', async (request: FastifyRequest<{ Body: { recipients: number; message: string } }>, reply: FastifyReply) => {
        try {
            const { recipients, message } = request.body;

            const estimate = smsService.estimateCost(recipients, message.length);

            return reply.code(200).send({
                success: true,
                estimate: {
                    recipients,
                    messageLength: message.length,
                    smsCount: Math.ceil(message.length / 160),
                    estimatedCost: estimate
                }
            });

        } catch (error: any) {
            return reply.code(500).send({
                error: 'Failed to estimate cost',
                message: error.message
            });
        }
    });
}
