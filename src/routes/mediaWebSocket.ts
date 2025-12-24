/**
 * Media WebSocket Route
 * Handles Telnyx media streaming WebSocket connections
 */

import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { AudioStreamHandler } from '../managers/AudioStreamHandler';
import { TelnyxSTTService } from '../services/TelnyxSTTService';

export default async function mediaWebSocketRoutes(fastify: FastifyInstance) {
    // Initialize services
    const sttService = new TelnyxSTTService();
    const audioHandler = new AudioStreamHandler(sttService);

    console.log('✅ Media WebSocket routes initialized');

    /**
     * WebSocket endpoint for media streaming
     * URL: wss://domain.com/media/stream
     */
    fastify.get('/media/stream', { websocket: true }, (connection, request) => {
        // Type cast the connection to WebSocket
        const ws = connection as any as WebSocket;

        // Extract call_control_id from query params
        const callControlId = (request.query as any).call_control_id;

        if (!callControlId) {
            console.error('❌ No call_control_id provided in WebSocket connection');
            ws.close(1008, 'Missing call_control_id');
            return;
        }

        console.log(`🔌 WebSocket connected: ${callControlId}`);

        // Handle media stream
        audioHandler.handleMediaStream(ws, callControlId);

        // Forward STT events (for orchestrator to listen)
        sttService.on('partial_transcript', (event) => {
            if (event.callControlId === callControlId) {
                fastify.log.info(`Partial: ${event.text}`);
            }
        });

        sttService.on('final_transcript', (event) => {
            if (event.callControlId === callControlId) {
                fastify.log.info(`Final: ${event.text} (${event.confidence})`);
            }
        });
    });

    /**
     * Health check for WebSocket
     */
    fastify.get('/media/health', async (request, reply) => {
        return {
            status: 'ok',
            service: 'Media WebSocket',
            activeStreams: audioHandler.getActiveStreamCount(),
            activeTranscriptions: sttService.getActiveCount(),
            timestamp: new Date().toISOString()
        };
    });
}
