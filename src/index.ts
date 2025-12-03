import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';
import { StreamManagerTelnyx } from './services/streamManagerTelnyx';
import { TelnyxService } from './services/telnyx';

dotenv.config();

const { PORT = 3000, DOMAIN } = process.env;

// Stats tracking
let stats = {
    activeCalls: 0,
    totalCalls: 0,
    totalDuration: 0,
    totalCost: 0,
    callsOverTime: [] as any[]
};

const telnyxService = new TelnyxService();

const fastify = Fastify({
    logger: {
        transport: {
            target: 'pino-pretty',
        },
    },
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

// Import controllers
import { CallController, CampaignController } from './controllers/callController';

// API: Call Management
fastify.post('/api/calls/start', CallController.startCall);
fastify.get('/api/calls/:call_id', CallController.getCall);
fastify.get('/api/calls', CallController.listCalls);

// API: Campaign Management
fastify.post('/api/campaigns', CampaignController.createCampaign);
fastify.post('/api/campaigns/:campaign_id/start', CampaignController.startCampaign);
fastify.get('/api/campaigns/:campaign_id', CampaignController.getCampaign);

// Twilio Webhook for incoming calls (Legacy/Fallback)
fastify.all('/incoming', async (request, reply) => {
    const twiml = `
    <Response>
      <Say>Connecting you to the AI agent.</Say>
      <Connect>
        <Stream url="wss://${DOMAIN}/media-stream" />
      </Connect>
    </Response>
  `;

    reply.type('text/xml').send(twiml);
});

// WebSocket route for media stream (Legacy/Twilio)
import { StreamManager } from './services/streamManager';
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection: any, req) => {
        console.log('Client connected to media stream');

        stats.activeCalls++;
        const callStartTime = Date.now();

        const streamManager = new StreamManager(connection.socket);

        connection.socket.on('message', (message: any) => {
            try {
                const data = JSON.parse(message);

                if (data.event === 'start') {
                    console.log('Media stream started', data.start.streamSid);
                    streamManager.start(data.start.streamSid);
                } else if (data.event === 'media') {
                    streamManager.handleAudio(data.media.payload);
                } else if (data.event === 'stop') {
                    console.log('Media stream stopped');
                    streamManager.stop();
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        connection.socket.on('close', () => {
            console.log('Client disconnected');
            streamManager.stop();

            // Update stats
            stats.activeCalls = Math.max(0, stats.activeCalls - 1);
            stats.totalCalls++;
            const duration = Math.round((Date.now() - callStartTime) / 1000);
            stats.totalDuration += duration;
            stats.totalCost += duration * 0.001; // Rough estimate
        });
    });
});

// Telnyx Webhook
fastify.post('/telnyx/webhook', async (request, reply) => {
    const event = request.body;
    await telnyxService.handleWebhook(event);
    reply.status(200).send('ok');
});

// WebSocket route for Telnyx media stream
fastify.register(async (fastify) => {
    fastify.get('/media/telnyx', { websocket: true }, (connection: any, req) => {
        console.log('Client connected to Telnyx media stream');

        stats.activeCalls++;
        broadcastStats({ type: 'call_started' });
        const callStartTime = Date.now();

        const streamManager = new StreamManagerTelnyx(connection.socket);

        connection.socket.on('message', (message: any) => {
            try {
                const data = JSON.parse(message);

                // Telnyx Media Protocol
                if (data.event === 'media') {
                    streamManager.handleAudio(data.media.payload);
                } else if (data.event === 'start') {
                    const streamId = data.start?.stream_id || data.stream_id;
                    const callControlId = data.start?.call_control_id || data.call_control_id;

                    console.log(`Telnyx Media Stream Started. StreamID: ${streamId}, CallControlID: ${callControlId}`);

                    if (streamId && callControlId) {
                        streamManager.start(streamId, callControlId);
                    } else {
                        console.error('Missing stream_id or call_control_id in start event', data);
                    }
                } else if (data.event === 'stop') {
                    console.log('Telnyx Media Stream Stopped');
                    streamManager.stop();
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        connection.socket.on('close', () => {
            console.log('Client disconnected');
            streamManager.stop();

            // Update stats
            stats.activeCalls = Math.max(0, stats.activeCalls - 1);
            stats.totalCalls++;
            const duration = Math.round((Date.now() - callStartTime) / 1000);
            stats.totalDuration += duration;
            stats.totalCost += duration * 0.004; // Telnyx streaming cost estimate

            broadcastStats({ type: 'call_ended' });
        });
    });
});

// Dashboard WebSocket
const dashboardClients = new Set<any>();

function broadcastStats(data: any) {
    dashboardClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

fastify.register(async (fastify) => {
    fastify.get('/ws/dashboard', { websocket: true }, (connection: any, req) => {
        console.log('Dashboard client connected');
        dashboardClients.add(connection.socket);

        connection.socket.on('close', () => {
            dashboardClients.delete(connection.socket);
        });
    });
});

// Simulation Mode (for demo purposes)
if (process.env.SIMULATION_MODE === 'true') {
    console.log('Starting Simulation Mode...');
    setInterval(() => {
        // Simulate random call activity
        if (Math.random() > 0.7) {
            stats.activeCalls++;
            stats.totalCalls++;
            broadcastStats({ type: 'call_started' });

            // Simulate call ending after random duration
            setTimeout(() => {
                stats.activeCalls = Math.max(0, stats.activeCalls - 1);
                stats.totalDuration += Math.floor(Math.random() * 300); // 0-5 mins
                stats.totalCost += 0.05 + (Math.random() * 0.5);
                broadcastStats({ type: 'call_ended' });
            }, Math.random() * 10000 + 5000); // 5-15 seconds
        }

        // Update history for chart
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existingEntry = stats.callsOverTime.find(d => d.date === today);
        if (existingEntry) {
            existingEntry.count = stats.totalCalls;
        } else {
            stats.callsOverTime.push({ date: today, count: stats.totalCalls });
        }
    }, 5000);
}

const start = async () => {
    try {
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`Server listening on http://localhost:${PORT}`);
        console.log(`Dashboard available at http://localhost:${PORT}/dashboard/`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
