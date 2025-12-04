import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';
import { TelnyxService } from './services/telnyx';
import axios from 'axios';

dotenv.config();

const { PORT = 3000 } = process.env;
const telnyxService = new TelnyxService();

// Stats tracking
let stats = {
    activeCalls: 0,
    totalCalls: 0,
    totalDuration: 0,
    totalCost: 0,
    callsOverTime: [] as any[]
};

const fastify = Fastify({
    logger: true
});

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Serve dashboard
fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../dashboard/public'),
    prefix: '/dashboard/',
});

// Redirect root to dashboard
fastify.get('/', async (request, reply) => {
    reply.redirect('/dashboard/');
});

// API: Get stats
fastify.get('/api/stats', async (request, reply) => {
    return {
        activeCalls: stats.activeCalls,
        totalCalls: stats.totalCalls,
        avgDuration: stats.totalCalls > 0 ? Math.round(stats.totalDuration / stats.totalCalls) : 0,
        totalCost: stats.totalCost,
        avgCost: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
        llmCost: stats.totalCost * 0.25,
        avgLlmCost: stats.totalCalls > 0 ? (stats.totalCost * 0.25) / stats.totalCalls : 0,
        callsOverTime: stats.callsOverTime
    };
});

// API: Test Voice (Browser-based TTS using Telnyx)
fastify.post('/api/test/voice', async (request, reply) => {
    try {
        const { text, voice } = request.body as any;

        if (!text) {
            return reply.status(400).send({ error: 'Missing required field: text' });
        }

        console.log(`🧪 Generating voice sample with Telnyx: ${voice}`);

        // Use Telnyx Text-to-Speech API
        const response = await axios.post(
            'https://api.telnyx.com/v2/ai/generate/text_to_speech',
            {
                text: text,
                voice: voice || 'en-US-Neural2-A',
                language: 'en-US'
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        reply.header('Content-Type', 'audio/mpeg');
        return reply.send(Buffer.from(response.data));
    } catch (error: any) {
        console.error('Error generating voice:', error.response?.data || error.message);
        return reply.status(500).send({
            error: error.response?.data?.errors?.[0]?.detail || error.message
        });
    }
});

// API: Start Test Call
fastify.post('/api/test-call/start', async (request, reply) => {
    try {
        const { to, from, agentConfig } = request.body as any;

        if (!to || !from) {
            return reply.status(400).send({ error: 'Missing required fields: to, from' });
        }

        console.log(`🧪 Starting test call to ${to}`);

        // Make call with agent config in client state
        await telnyxService.makeCall(to, from, {
            type: 'test_call',
            agentConfig: agentConfig || {}
        });

        return reply.send({
            success: true,
            message: 'Test call initiated'
        });
    } catch (error: any) {
        console.error('Error starting test call:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// API: Hangup Test Call
fastify.post('/api/test-call/hangup', async (request, reply) => {
    try {
        const { callControlId } = request.body as any;

        if (!callControlId) {
            return reply.status(400).send({ error: 'Missing callControlId' });
        }

        console.log(`🛑 Hanging up test call: ${callControlId}`);

        await telnyxService.hangupCall(callControlId);

        return reply.send({
            success: true,
            message: 'Call ended'
        });
    } catch (error: any) {
        console.error('Error hanging up call:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// API: Get Call Transcript
fastify.get('/api/test-call/:callId/transcript', async (request, reply) => {
    try {
        const { callId } = request.params as any;
        const { SupabaseService } = await import('./services/supabase');
        const supabase = new SupabaseService();

        const transcripts = await supabase.client
            .from('call_transcripts')
            .select('*')
            .eq('call_id', callId)
            .order('timestamp', { ascending: true });

        return reply.send({
            success: true,
            messages: transcripts.data || []
        });
    } catch (error: any) {
        console.error('Error fetching transcript:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// Store active conversation loops
const activeConversations = new Map<string, any>();

// TeXML Inbound Webhook Handler (for conversational AI)
fastify.post('/telnyx/inbound', async (request, reply) => {
    try {
        const event = request.body as any;
        const { event_type, payload } = event.data;

        console.log(`📞 TeXML Inbound Event: ${event_type}`);

        switch (event_type) {
            case 'call.initiated':
                console.log(`📞 Incoming call from ${payload.from}`);
                stats.totalCalls++;
                stats.activeCalls++;
                break;

            case 'call.answered':
                console.log(`✅ Call answered: ${payload.call_control_id}`);

                // Start conversation loop
                const { ConversationLoop } = await import('./services/conversationLoop');
                const { v4: uuidv4 } = await import('uuid');

                const callId = uuidv4();
                const conversationLoop = new ConversationLoop({
                    callId,
                    callControlId: payload.call_control_id,
                    callerPhone: payload.from,
                    purpose: 'customer support'
                });

                // Store the conversation loop
                activeConversations.set(payload.call_control_id, conversationLoop);

                // Start the conversation
                await conversationLoop.start("Hello! I'm an AI assistant. How can I help you today?");

                // Listen for conversation events
                conversationLoop.on('error', (error) => {
                    console.error(`❌ Conversation error for ${payload.call_control_id}:`, error);
                });

                conversationLoop.on('stopped', () => {
                    console.log(`🛑 Conversation stopped for ${payload.call_control_id}`);
                    activeConversations.delete(payload.call_control_id);
                    stats.activeCalls = Math.max(0, stats.activeCalls - 1);
                });

                break;

            case 'call.hangup':
                console.log(`📴 Call ended: ${payload.call_control_id}`);

                // Stop conversation loop
                const conversation = activeConversations.get(payload.call_control_id);
                if (conversation) {
                    await conversation.stop();
                    activeConversations.delete(payload.call_control_id);
                }

                stats.activeCalls = Math.max(0, stats.activeCalls - 1);
                break;

            case 'call.speak.ended':
                console.log(`🗣️ Speech ended for ${payload.call_control_id}`);
                break;

            default:
                console.log(`📨 Unhandled event: ${event_type}`);
        }

        return reply.send({ received: true });
    } catch (error: any) {
        console.error('❌ TeXML webhook error:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// Webhook: Telnyx
fastify.post('/webhooks/telnyx', async (request, reply) => {
    try {
        const event = request.body as any;
        const { event_type, payload } = event.data;

        console.log(`📨 Webhook: ${event_type}`);

        // Check for client state to identify test calls
        let clientState: any = null;
        if (payload.client_state) {
            try {
                const json = Buffer.from(payload.client_state, 'base64').toString('utf-8');
                clientState = JSON.parse(json);
            } catch (e) {
                console.error('Error parsing client_state:', e);
            }
        }

        if (clientState && clientState.type === 'voice_test') {
            console.log('🎤 Handling Voice Test Event');

            if (event_type === 'call.answered') {
                // Speak the text when answered
                await telnyxService.speak(
                    payload.call_control_id,
                    clientState.text,
                    clientState.voice
                );
            } else if (event_type === 'call.speak.ended') {
                // Hangup after speaking
                console.log('✅ Voice Test Complete. Hanging up.');
                await telnyxService.hangupCall(payload.call_control_id);
            }
        } else {
            // Normal call handling
            telnyxService.handleWebhook(event);
        }

        return reply.send({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return reply.status(500).send({ error: 'Internal Server Error' });
    }
});

// API: Start Call (Simplified)
fastify.post('/api/calls/start', async (request, reply) => {
    try {
        const { to, from } = request.body as any;

        if (!to || !from) {
            return reply.status(400).send({ error: 'Missing required fields: to, from' });
        }

        // Use real Telnyx service if available, else simulate
        if (process.env.TELNYX_API_KEY) {
            await telnyxService.makeCall(to, from);
            return reply.send({ success: true, status: 'initiated', message: 'Call initiated via Telnyx' });
        } else {
            // Simulate
            const callId = `call_${Date.now()}`;
            stats.totalCalls++;
            console.log(`📞 Simulated call from ${from} to ${to}`);
            return reply.send({ success: true, call_id: callId, status: 'initiated', message: 'Simulated call' });
        }
    } catch (error: any) {
        console.error('Error starting call:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// API: List Calls
fastify.get('/api/calls', async (request, reply) => {
    return {
        calls: [],
        count: 0,
        message: 'Database integration pending'
    };
});

// API: Create Campaign
fastify.post('/api/campaigns', async (request, reply) => {
    try {
        const { name, contacts } = request.body as any;

        if (!name || !contacts) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        const campaignId = `campaign_${Date.now()}`;

        return reply.send({
            success: true,
            campaign: {
                id: campaignId,
                name,
                total_contacts: contacts.length,
                status: 'created'
            }
        });
    } catch (error: any) {
        return reply.status(500).send({ error: error.message });
    }
});

// Dashboard WebSocket
const dashboardClients = new Set<any>();

function broadcastStats(data: any) {
    dashboardClients.forEach(client => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        } catch (err) {
            console.error('Error broadcasting to client:', err);
        }
    });
}

fastify.register(async (fastify) => {
    fastify.get('/ws/dashboard', { websocket: true }, (connection: any, req) => {
        console.log('📊 Dashboard client connected');
        dashboardClients.add(connection.socket);

        connection.socket.on('close', () => {
            dashboardClients.delete(connection.socket);
            console.log('📊 Dashboard client disconnected');
        });
    });
});

// Live Call WebSocket (for real-time transcription)
const liveCallClients = new Map<string, Set<any>>();

export function broadcastToLiveCall(callId: string, data: any) {
    const clients = liveCallClients.get(callId);
    if (clients) {
        clients.forEach(client => {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            } catch (err) {
                console.error('Error broadcasting to live call client:', err);
            }
        });
    }
}

fastify.register(async (fastify) => {
    fastify.get('/ws/live-call/:callId', { websocket: true }, (connection: any, req) => {
        const callId = (req.params as any).callId;
        console.log(`📞 Live call client connected for call: ${callId}`);

        // Add client to call-specific set
        if (!liveCallClients.has(callId)) {
            liveCallClients.set(callId, new Set());
        }
        liveCallClients.get(callId)!.add(connection.socket);

        connection.socket.on('close', () => {
            const clients = liveCallClients.get(callId);
            if (clients) {
                clients.delete(connection.socket);
                if (clients.size === 0) {
                    liveCallClients.delete(callId);
                }
            }
            console.log(`📞 Live call client disconnected for call: ${callId}`);
        });

        // Send initial connection confirmation
        connection.socket.send(JSON.stringify({
            type: 'connected',
            callId: callId
        }));
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`✅ Server running at http://localhost:${PORT}`);
        console.log(`✅ Dashboard: http://localhost:${PORT}/dashboard/`);
        console.log(`📡 WebSocket: ws://localhost:${PORT}/ws/dashboard`);

        // Start simulation mode AFTER server is ready
        if (process.env.SIMULATION_MODE === 'true') {
            console.log('🎭 Starting Simulation Mode...');
            setInterval(() => {
                if (Math.random() > 0.7) {
                    stats.activeCalls++;
                    stats.totalCalls++;
                    broadcastStats({ type: 'call_started' });

                    setTimeout(() => {
                        stats.activeCalls = Math.max(0, stats.activeCalls - 1);
                        stats.totalDuration += Math.floor(Math.random() * 300);
                        stats.totalCost += 0.05 + (Math.random() * 0.5);
                        broadcastStats({ type: 'call_ended' });
                    }, Math.random() * 10000 + 5000);
                }

                const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const existingEntry = stats.callsOverTime.find(d => d.date === today);
                if (existingEntry) {
                    existingEntry.count = stats.totalCalls;
                } else {
                    stats.callsOverTime.push({ date: today, count: stats.totalCalls });
                }
            }, 5000);
        }
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
