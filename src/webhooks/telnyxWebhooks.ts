import { FastifyRequest, FastifyReply } from 'fastify';
import { TelnyxVoiceService, TelnyxWebhookPayload } from '../services/telnyxVoice';
import { ConversationLoop } from '../services/conversationLoop';

// Store active conversations
const activeConversations = new Map<string, ConversationLoop>();

/**
 * Telnyx Webhook Handler
 * Processes all webhook events from Telnyx Voice API
 */
export async function handleTelnyxWebhook(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        const payload = request.body as TelnyxWebhookPayload;
        const { event_type, payload: eventPayload } = payload;

        console.log(`📨 Telnyx Webhook: ${event_type}`);
        console.log(`   Call Control ID: ${eventPayload.call_control_id}`);

        // Handle different webhook events
        switch (event_type) {
            case 'call.initiated':
                await handleCallInitiated(payload);
                break;

            case 'call.answered':
                await handleCallAnswered(payload);
                break;

            case 'call.hangup':
                await handleCallHangup(payload);
                break;

            case 'call.speak.ended':
                await handleSpeakEnded(payload);
                break;

            case 'call.recording.saved':
                await handleRecordingSaved(payload);
                break;

            case 'streaming.started':
                console.log('🎙️ Media streaming started');
                break;

            case 'streaming.stopped':
                console.log('🛑 Media streaming stopped');
                break;

            default:
                console.log(`⚠️ Unhandled webhook event: ${event_type}`);
        }

        // Send 200 OK response
        reply.code(200).send({ received: true });
    } catch (error) {
        console.error('❌ Error handling Telnyx webhook:', error);
        reply.code(500).send({ error: 'Internal server error' });
    }
}

/**
 * Handle call.initiated event
 */
async function handleCallInitiated(payload: TelnyxWebhookPayload): Promise<void> {
    const { call_control_id, direction, from, to } = payload.payload;

    console.log(`📞 Call initiated: ${direction} call from ${from} to ${to}`);

    // For inbound calls, answer automatically
    if (direction === 'incoming') {
        const telnyxVoice = new TelnyxVoiceService();

        // Answer with media streaming
        const streamUrl = `wss://${process.env.DOMAIN || 'localhost'}/media-stream`;
        await telnyxVoice.answerCall(call_control_id, streamUrl);

        console.log(`✅ Answered inbound call: ${call_control_id}`);
    }
}

/**
 * Handle call.answered event
 */
async function handleCallAnswered(payload: TelnyxWebhookPayload): Promise<void> {
    const { call_control_id, from, to } = payload.payload;

    console.log(`✅ Call answered: ${call_control_id}`);

    // Start conversation loop
    const conversationLoop = new ConversationLoop({
        callId: call_control_id,
        callControlId: call_control_id,
        callerPhone: from || 'unknown',
        callType: 'phone',
        voice: process.env.DEFAULT_VOICE || 'AWS.Polly.Joanna-Neural'
    });

    // Store conversation
    activeConversations.set(call_control_id, conversationLoop);

    // Start the conversation
    try {
        await conversationLoop.start();

        // Greet the caller
        const telnyxVoice = new TelnyxVoiceService();
        await telnyxVoice.speak(
            call_control_id,
            "Hello! I'm an AI assistant. How can I help you today?"
        );
    } catch (error) {
        console.error('❌ Error starting conversation:', error);
    }
}

/**
 * Handle call.hangup event
 */
async function handleCallHangup(payload: TelnyxWebhookPayload): Promise<void> {
    const { call_control_id, hangup_cause, hangup_source } = payload.payload;

    console.log(`📴 Call ended: ${call_control_id}`);
    console.log(`   Hangup cause: ${hangup_cause}`);
    console.log(`   Hangup source: ${hangup_source}`);

    // Stop conversation loop
    const conversation = activeConversations.get(call_control_id);
    if (conversation) {
        try {
            await conversation.stop();
        } catch (error) {
            console.error('❌ Error stopping conversation:', error);
        }
        activeConversations.delete(call_control_id);
    }
}

/**
 * Handle call.speak.ended event
 */
async function handleSpeakEnded(payload: TelnyxWebhookPayload): Promise<void> {
    const { call_control_id } = payload.payload;
    console.log(`🗣️ TTS finished for call: ${call_control_id}`);
}

/**
 * Handle call.recording.saved event
 */
async function handleRecordingSaved(payload: TelnyxWebhookPayload): Promise<void> {
    const { call_control_id } = payload.payload;
    console.log(`💾 Recording saved for call: ${call_control_id}`);

    // TODO: Download and store recording
}

/**
 * Get active conversation by call control ID
 */
export function getActiveConversation(callControlId: string): ConversationLoop | undefined {
    return activeConversations.get(callControlId);
}

/**
 * Get all active conversations
 */
export function getAllActiveConversations(): Map<string, ConversationLoop> {
    return activeConversations;
}
