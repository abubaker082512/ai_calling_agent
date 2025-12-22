/**
 * Telnyx Webhook Receiver (Refactored for Phase 1.5)
 * Handles incoming webhooks from Telnyx
 * Delegates to CallOrchestrator for all call lifecycle management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { SupabaseService } from '../services/supabase';
import { CallOrchestrator } from '../core/CallOrchestrator.refactored';
import { TelnyxCallService } from '../services/TelnyxCallService';
import { CallSessionManager } from '../managers/CallSessionManager';

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

    // Initialize services
    const telnyxService = new TelnyxCallService();
    const sessionManager = new CallSessionManager();
    const callOrchestrator = new CallOrchestrator(telnyxService, sessionManager);

    console.log('✅ Telnyx webhook routes initialized with CallOrchestrator');

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
     * POST /telnyx/events
     * Main webhook endpoint - delegates to CallOrchestrator
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

            // Store event in database
            await storeCallEvent(event);

            // Delegate to CallOrchestrator
            switch (event_type) {
                case 'call.initiated':
                    console.log(`📞 Call Initiated → CallOrchestrator`);
                    await callOrchestrator.handleInboundCall({
                        call_control_id: eventPayload.call_control_id,
                        call_session_id: eventPayload.call_session_id,
                        from: eventPayload.from || '',
                        to: eventPayload.to || ''
                    });
                    break;

                case 'call.answered':
                    console.log(`✅ Call Answered → CallOrchestrator`);
                    await callOrchestrator.handleCallAnswered(eventPayload.call_control_id);
                    break;

                case 'call.hangup':
                    console.log(`📴 Call Hangup → CallOrchestrator`);
                    await callOrchestrator.handleCallHangup(
                        eventPayload.call_control_id,
                        eventPayload.hangup_cause,
                        eventPayload.hangup_source
                    );
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
            message: 'Telnyx webhook receiver is ready (Phase 3 - AI with LLM)',
            endpoint: '/telnyx/events',
            orchestrator: 'CallOrchestratorWithAI',
            features: ['STT', 'LLM (Conversational AI)', 'TTS', 'Voice Loop'],
            timestamp: new Date().toISOString()
        };
    });
}
