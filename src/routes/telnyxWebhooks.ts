/**
 * Telnyx Webhook Receiver
 * Handles incoming webhooks from Telnyx
 * Validates signatures and logs all events
 * Stores call data in database
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { SupabaseService } from '../services/supabase';

interface TelnyxWebhookPayload {
    data: {
        event_type: string;
        id: string;
        occurred_at: string;
        payload: {
            call_control_id: string;
            call_leg_id?: string;
            call_session_id?: string;
            client_state?: string;
            connection_id?: string;
            direction?: 'incoming' | 'outgoing';
            from?: string;
            to?: string;
            state?: string;
            hangup_cause?: string;
            hangup_source?: string;
            [key: string]: any;
        };
        record_type: string;
    };
    meta?: {
        attempt: number;
        delivered_to: string;
    };
}

export default async function telnyxWebhookRoutes(fastify: FastifyInstance) {
    const supabase = new SupabaseService();

    /**
     * Validate Telnyx webhook signature
     */
    function validateSignature(
        payload: string,
        signature: string,
        timestamp: string
    ): boolean {
        const webhookSecret = process.env.TELNYX_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.warn('⚠️ TELNYX_WEBHOOK_SECRET not set - skipping signature validation');
            return true; // Allow in development
        }

        try {
            const signedPayload = `${timestamp}|${payload}`;
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(signedPayload)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch (error) {
            console.error('❌ Signature validation error:', error);
            return false;
        }
    }

    /**
     * Store call event in database
     */
    async function storeCallEvent(event: TelnyxWebhookPayload): Promise<void> {
        const { event_type, payload, occurred_at } = event.data;

        try {
            // Store in call_events table
            await supabase.client
                .from('call_events')
                .insert({
                    event_type,
                    call_control_id: payload.call_control_id,
                    call_session_id: payload.call_session_id,
                    from_number: payload.from,
                    to_number: payload.to,
                    direction: payload.direction,
                    state: payload.state,
                    hangup_cause: payload.hangup_cause,
                    hangup_source: payload.hangup_source,
                    occurred_at: new Date(occurred_at),
                    payload: payload,
                    created_at: new Date()
                });

            console.log(`✅ Stored event: ${event_type} for call ${payload.call_control_id}`);
        } catch (error) {
            console.error('❌ Error storing call event:', error);
        }
    }

    /**
     * Handle call.initiated event
     */
    async function handleCallInitiated(payload: any): Promise<void> {
        console.log(`📞 Call Initiated: ${payload.call_control_id}`);
        console.log(`   From: ${payload.from}`);
        console.log(`   To: ${payload.to}`);
        console.log(`   Direction: ${payload.direction}`);

        // Store in database
        try {
            await supabase.client
                .from('calls')
                .insert({
                    call_control_id: payload.call_control_id,
                    call_session_id: payload.call_session_id,
                    from_number: payload.from,
                    to_number: payload.to,
                    direction: payload.direction,
                    status: 'initiated',
                    started_at: new Date(),
                    created_at: new Date()
                });

            console.log(`✅ Call record created: ${payload.call_control_id}`);
        } catch (error) {
            console.error('❌ Error creating call record:', error);
        }
    }

    /**
     * Handle call.answered event
     */
    async function handleCallAnswered(payload: any): Promise<void> {
        console.log(`✅ Call Answered: ${payload.call_control_id}`);

        // Update call status
        try {
            await supabase.client
                .from('calls')
                .update({
                    status: 'answered',
                    answered_at: new Date(),
                    updated_at: new Date()
                })
                .eq('call_control_id', payload.call_control_id);

            console.log(`✅ Call status updated: ${payload.call_control_id}`);
        } catch (error) {
            console.error('❌ Error updating call status:', error);
        }
    }

    /**
     * Handle call.hangup event
     */
    async function handleCallHangup(payload: any): Promise<void> {
        console.log(`📴 Call Hangup: ${payload.call_control_id}`);
        console.log(`   Cause: ${payload.hangup_cause}`);
        console.log(`   Source: ${payload.hangup_source}`);

        // Update call status
        try {
            await supabase.client
                .from('calls')
                .update({
                    status: 'ended',
                    hangup_cause: payload.hangup_cause,
                    hangup_source: payload.hangup_source,
                    ended_at: new Date(),
                    updated_at: new Date()
                })
                .eq('call_control_id', payload.call_control_id);

            console.log(`✅ Call ended: ${payload.call_control_id}`);
        } catch (error) {
            console.error('❌ Error updating call end:', error);
        }
    }

    /**
     * POST /telnyx/events
     * Main webhook endpoint
     */
    fastify.post('/telnyx/events', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Get signature headers
            const signature = request.headers['telnyx-signature-ed25519'] as string;
            const timestamp = request.headers['telnyx-timestamp'] as string;

            // Validate signature
            const payload = JSON.stringify(request.body);
            if (signature && timestamp) {
                const isValid = validateSignature(payload, signature, timestamp);
                if (!isValid) {
                    console.error('❌ Invalid webhook signature');
                    return reply.status(401).send({ error: 'Invalid signature' });
                }
            }

            const event = request.body as TelnyxWebhookPayload;
            const { event_type, payload: eventPayload } = event.data;

            console.log(`\n📨 Telnyx Webhook Received`);
            console.log(`   Event: ${event_type}`);
            console.log(`   Call ID: ${eventPayload.call_control_id}`);
            console.log(`   Timestamp: ${event.data.occurred_at}`);

            // Store event
            await storeCallEvent(event);

            // Handle specific events
            switch (event_type) {
                case 'call.initiated':
                    await handleCallInitiated(eventPayload);
                    break;

                case 'call.answered':
                    await handleCallAnswered(eventPayload);
                    break;

                case 'call.hangup':
                    await handleCallHangup(eventPayload);
                    break;

                case 'call.speak.started':
                    console.log(`🗣️ Speak started: ${eventPayload.call_control_id}`);
                    break;

                case 'call.speak.ended':
                    console.log(`🗣️ Speak ended: ${eventPayload.call_control_id}`);
                    break;

                case 'call.recording.saved':
                    console.log(`💾 Recording saved: ${eventPayload.call_control_id}`);
                    break;

                case 'call.streaming.started':
                    console.log(`🎵 Streaming started: ${eventPayload.call_control_id}`);
                    break;

                case 'call.streaming.stopped':
                    console.log(`🎵 Streaming stopped: ${eventPayload.call_control_id}`);
                    break;

                default:
                    console.log(`ℹ️ Unhandled event: ${event_type}`);
            }

            // Return 200 OK
            return reply.status(200).send({ received: true });

        } catch (error) {
            console.error('❌ Webhook processing error:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /telnyx/events/test
     * Test endpoint to verify webhook is working
     */
    fastify.get('/telnyx/events/test', async (request: FastifyRequest, reply: FastifyReply) => {
        return {
            status: 'ok',
            message: 'Telnyx webhook receiver is ready',
            endpoint: '/telnyx/events',
            timestamp: new Date().toISOString()
        };
    });
}
