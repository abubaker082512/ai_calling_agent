import { FastifyInstance } from 'fastify';
import { telnyxSMSService } from '../services/TelnyxSMSService';

export default async function telnyxSmsApiRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/telnyx/sms/send
     * Send a single SMS message
     */
    fastify.post('/send', async (request, reply) => {
        try {
            const { to, message, from } = request.body as any;

            if (!to || !message) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: to, message'
                });
            }

            const result = await telnyxSMSService.sendSMS({
                to,
                text: message,
                from
            });

            return {
                success: true,
                sms: result
            };
        } catch (error: any) {
            console.error('Error sending SMS:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to send SMS',
                message: error.message
            });
        }
    });

    /**
     * POST /api/telnyx/sms/bulk
     * Send bulk SMS to multiple recipients
     */
    fastify.post('/bulk', async (request, reply) => {
        try {
            const { to, message, from, campaignName } = request.body as any;

            if (!to || !Array.isArray(to) || to.length === 0 || !message) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: to (array), message'
                });
            }

            const results = await telnyxSMSService.sendBulkSMS({
                to,
                text: message,
                from,
                campaignName
            });

            const successCount = results.filter(r => r.status !== 'failed').length;
            const failedCount = results.length - successCount;
            const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);

            return {
                success: true,
                results,
                summary: {
                    total: results.length,
                    successful: successCount,
                    failed: failedCount,
                    total_cost: totalCost.toFixed(4)
                }
            };
        } catch (error: any) {
            console.error('Error sending bulk SMS:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to send bulk SMS',
                message: error.message
            });
        }
    });

    /**
     * GET /api/telnyx/sms/list
     * List sent SMS messages
     */
    fastify.get('/list', async (request, reply) => {
        try {
            const query = request.query as any;
            const limit = parseInt(query.limit) || 50;
            const offset = parseInt(query.offset) || 0;

            const messages = await telnyxSMSService.listSMS(limit, offset);

            return {
                success: true,
                messages,
                pagination: {
                    limit,
                    offset,
                    count: messages.length
                }
            };
        } catch (error: any) {
            console.error('Error listing SMS:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to list SMS',
                message: error.message
            });
        }
    });

    /**
     * GET /api/telnyx/sms/:id
     * Get SMS details by message ID
     */
    fastify.get('/:id', async (request, reply) => {
        try {
            const { id } = request.params as any;

            const status = await telnyxSMSService.getMessageStatus(id);

            return {
                success: true,
                message: status
            };
        } catch (error: any) {
            console.error('Error getting SMS status:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get SMS status',
                message: error.message
            });
        }
    });

    /**
     * GET /api/telnyx/sms/analytics
     * Get SMS analytics
     */
    fastify.get('/analytics', async (request, reply) => {
        try {
            const analytics = await telnyxSMSService.getAnalytics();

            return {
                success: true,
                analytics
            };
        } catch (error: any) {
            console.error('Error getting SMS analytics:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get analytics',
                message: error.message
            });
        }
    });

    /**
     * POST /webhook
     * Handle Telnyx SMS delivery webhooks
     */
    fastify.post('/webhook', async (request, reply) => {
        try {
            console.log('📬 Received Telnyx SMS webhook');

            await telnyxSMSService.handleDeliveryWebhook(request.body);

            return { received: true };
        } catch (error: any) {
            console.error('Error handling webhook:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to handle webhook',
                message: error.message
            });
        }
    });
}
