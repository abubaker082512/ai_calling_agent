/**
 * Audio Stream Handler
 * Handles WebSocket media streams from Telnyx
 * Forwards audio to STT service
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { TelnyxSTTService } from '../services/TelnyxSTTService';

export interface MediaStreamMessage {
    event: string;
    stream_id?: string;
    media?: {
        track: string;
        chunk: string;
        timestamp: string;
    };
}

export class AudioStreamHandler extends EventEmitter {
    private sttService: TelnyxSTTService;
    private activeStreams: Map<string, WebSocket> = new Map();
    private streamToCallMap: Map<string, string> = new Map();

    constructor(sttService: TelnyxSTTService) {
        super();
        this.sttService = sttService;
        console.log('✅ AudioStreamHandler initialized');
    }

    /**
     * Handle incoming media stream WebSocket
     */
    public handleMediaStream(ws: WebSocket, callControlId: string): void {
        console.log(`🎵 Media stream connected: ${callControlId}`);

        ws.on('message', async (data: Buffer) => {
            try {
                const message: MediaStreamMessage = JSON.parse(data.toString());

                switch (message.event) {
                    case 'start':
                        await this.handleStreamStart(ws, message, callControlId);
                        break;

                    case 'media':
                        await this.handleMediaPacket(message, callControlId);
                        break;

                    case 'stop':
                        await this.handleStreamStop(message, callControlId);
                        break;

                    default:
                        console.log(`ℹ️ Unknown stream event: ${message.event}`);
                }

            } catch (error) {
                console.error('❌ Error processing stream message:', error);
            }
        });

        ws.on('close', () => {
            console.log(`🔌 Media stream closed: ${callControlId}`);
            this.cleanup(callControlId);
        });

        ws.on('error', (error) => {
            console.error(`❌ Media stream error: ${callControlId}`, error);
            this.cleanup(callControlId);
        });
    }

    /**
     * Handle stream start event
     */
    private async handleStreamStart(
        ws: WebSocket,
        message: MediaStreamMessage,
        callControlId: string
    ): Promise<void> {
        console.log(`▶️ Stream started: ${callControlId}`);
        console.log(`   Stream ID: ${message.stream_id}`);

        if (message.stream_id) {
            this.activeStreams.set(callControlId, ws);
            this.streamToCallMap.set(message.stream_id, callControlId);

            // Start STT transcription
            await this.sttService.startTranscription(callControlId);

            this.emit('stream:started', { callControlId, streamId: message.stream_id });
        }
    }

    /**
     * Handle media packet (audio data)
     */
    private async handleMediaPacket(
        message: MediaStreamMessage,
        callControlId: string
    ): Promise<void> {
        if (!message.media || !message.media.chunk) {
            return;
        }

        try {
            // Decode base64 audio chunk
            const audioBuffer = Buffer.from(message.media.chunk, 'base64');

            // Forward to STT service
            await this.sttService.processAudioChunk(callControlId, audioBuffer);

            // Emit for monitoring
            this.emit('audio:packet', {
                callControlId,
                size: audioBuffer.length,
                timestamp: message.media.timestamp
            });

        } catch (error) {
            console.error('❌ Error processing media packet:', error);
        }
    }

    /**
     * Handle stream stop event
     */
    private async handleStreamStop(
        message: MediaStreamMessage,
        callControlId: string
    ): Promise<void> {
        console.log(`⏹️ Stream stopped: ${callControlId}`);

        await this.cleanup(callControlId);

        this.emit('stream:stopped', { callControlId });
    }

    /**
     * Cleanup stream resources
     */
    private async cleanup(callControlId: string): Promise<void> {
        // Stop STT transcription
        if (this.sttService.isActive(callControlId)) {
            await this.sttService.stopTranscription(callControlId);
        }

        // Remove from maps
        this.activeStreams.delete(callControlId);

        // Remove stream ID mapping
        for (const [streamId, ccId] of this.streamToCallMap.entries()) {
            if (ccId === callControlId) {
                this.streamToCallMap.delete(streamId);
            }
        }

        console.log(`🗑️ Stream cleanup complete: ${callControlId}`);
    }

    /**
     * Get active stream count
     */
    public getActiveStreamCount(): number {
        return this.activeStreams.size;
    }

    /**
     * Check if stream is active
     */
    public isStreamActive(callControlId: string): boolean {
        return this.activeStreams.has(callControlId);
    }

    /**
     * Cleanup all streams
     */
    public async cleanupAll(): Promise<void> {
        const callControlIds = Array.from(this.activeStreams.keys());

        for (const callControlId of callControlIds) {
            await this.cleanup(callControlId);
        }

        console.log('✅ All streams cleaned up');
    }
}
