/**
 * Dexatel Webhook Routes
 * Handles incoming webhooks from Dexatel Voice API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { SupabaseService } from '../services/supabase';
import { CallOrchestratorWithAI } from '../core/CallOrchestratorWithAI';
import { DexatelCallService } from '../services/DexatelCallService';
import { CallSessionManager } from '../managers/CallSessionManager';
import { TelnyxSTTService } from '../services/TelnyxSTTService';
import { TelnyxTTSService } from '../services/TelnyxTTSService';
import { TelnyxConversationalAIService } from '../services/TelnyxConversationalAIService';

interface DexatelWebhookPayload {
    event: string;
    call_id: string;
    timestamp: string;
    data: {
        from?: string;
        to?: string;
        status?: string;
        direction?: 'inbound' | 'outbound';
        [key: string]: any;
    };
}

export default async function dexatelWebhookRoutes(fastify: FastifyInstance) {
    const supabase = new SupabaseService();

    // Initialize services for AI voice loop
    const dexatelService = new DexatelCallService();
    const sessionManager = new CallSessionManager();
    const sttService = new TelnyxSTTService(); // Reuse existing STT
    const ttsService = new TelnyxTTSService(); // Reuse existing TTS
    const conversationalAI = new TelnyxConversationalAIService();

    const callOrchestrator = new CallOrchestratorWithAI(
        dexatelService as any, // Type cast for now
        sessionManager,
        sttService,
        ttsService,
        conversationalAI
    );

    console.log('✅ Dexatel webhook routes initialized with AI Voice Loop');

    /**
     * POST /dexatel/events
     * Main webhook endpoint for Dexatel events
     */
    fastify.post('/dexatel/events', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const payload = request.body as DexatelWebhookPayload;

            console.log(`\n📨 Dexatel Webhook: ${payload.event}`);
            console.log(`   Call ID: ${payload.call_id}`);

            // Verify webhook signature (if Dexatel provides one)
            const webhookSecret = process.env.DEXATEL_WEBHOOK_SECRET;
            if (webhookSecret) {
                // TODO: Implement signature verification when we have Dexatel docs
            }

            // Store event in database
            await supabase.client.from('call_events').insert({
                call_id: payload.call_id,
                event_type: payload.event,
                event_data: payload.data,
                occurred_at: payload.timestamp || new Date().toISOString()
            });

            // Route to appropriate handler
            await handleDexatelEvent(payload);

            return reply.code(200).send({ received: true });

        } catch (error: any) {
            console.error('❌ Error processing Dexatel webhook:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * Handle Dexatel events
     */
    async function handleDexatelEvent(payload: DexatelWebhookPayload): Promise<void> {
        const { event, call_id, data } = payload;

        switch (event) {
            case 'call.initiated':
            case 'call.ringing':
                await handleCallInitiated(call_id, data);
                break;

            case 'call.answered':
                await handleCallAnswered(call_id);
                break;

            case 'call.ended':
            case 'call.hangup':
                await handleCallHangup(call_id, data);
                break;

            case 'call.speak.started':
                console.log(`🗣️ Speech started: ${call_id}`);
                break;

            case 'call.speak.ended':
                console.log(`✅ Speech ended: ${call_id}`);
                break;

            case 'call.streaming.started':
                console.log(`🎵 Streaming started: ${call_id}`);
                break;

            case 'call.streaming.stopped':
                console.log(`🎵 Streaming stopped: ${call_id}`);
                break;

            default:
                console.log(`ℹ️ Unhandled event: ${event}`);
        }
    }

    /**
     * Handle call initiated
     */
    async function handleCallInitiated(callId: string, data: any): Promise<void> {
        console.log(`📞 Call Initiated: ${callId}`);

        if (data.direction === 'inbound') {
            await callOrchestrator.handleInboundCall({
                call_control_id: callId,
                from: data.from,
                to: data.to
            });
        }
    }

    /**
     * Handle call answered
     */
    async function handleCallAnswered(callId: string): Promise<void> {
        console.log(`✅ Call Answered: ${callId}`);
        await callOrchestrator.handleCallAnswered(callId);
    }

    /**
     * Handle call hangup
     */
    async function handleCallHangup(callId: string, data: any): Promise<void> {
        console.log(`📴 Call Hangup: ${callId}`);
        await callOrchestrator.handleCallHangup(
            callId,
            data.hangup_cause,
            data.hangup_source
        );
    }

    /**
     * GET /dexatel/events/test
     * Test endpoint to verify webhook is working
     */
    fastify.get('/dexatel/events/test', async (request: FastifyRequest, reply: FastifyReply) => {
        return {
            status: 'ok',
            message: 'Dexatel webhook receiver is ready (AI Voice Loop)',
            endpoint: '/dexatel/events',
            orchestrator: 'CallOrchestratorWithAI',
            provider: 'Dexatel',
            features: ['STT', 'LLM (Conversational AI)', 'TTS', 'Voice Loop'],
            timestamp: new Date().toISOString()
        };
    });
}
