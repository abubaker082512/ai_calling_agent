/**
 * Media Router
 * Routes media streams between Telnyx and AI services
 * Manages WebSocket connections and audio stream routing
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

export interface MediaRoute {
    callId: string;
    callControlId: string;
    telnyxStream?: WebSocket;
    asrStream?: WebSocket;
    createdAt: Date;
}

export class MediaRouter extends EventEmitter {
    private routes: Map<string, MediaRoute> = new Map();

    /**
     * Register a new media route
     */
    public async registerRoute(callId: string, callControlId: string): Promise<MediaRoute> {
        const route: MediaRoute = {
            callId,
            callControlId,
            createdAt: new Date()
        };

        this.routes.set(callId, route);
        console.log(`🎵 Media route registered: ${callId}`);

        return route;
    }

    /**
     * Attach Telnyx WebSocket stream
     */
    public async attachTelnyxStream(callId: string, stream: WebSocket): Promise<void> {
        const route = this.routes.get(callId);
        if (!route) {
            throw new Error(`Media route not found: ${callId}`);
        }

        route.telnyxStream = stream;
        console.log(`🎵 Telnyx stream attached: ${callId}`);

        // Setup stream handlers
        stream.on('message', (data) => {
            this.handleTelnyxMessage(callId, data);
        });

        stream.on('close', () => {
            this.handleTelnyxClose(callId);
        });

        stream.on('error', (error) => {
            this.handleTelnyxError(callId, error);
        });
    }

    /**
     * Attach ASR WebSocket stream
     */
    public async attachASRStream(callId: string, stream: WebSocket): Promise<void> {
        const route = this.routes.get(callId);
        if (!route) {
            throw new Error(`Media route not found: ${callId}`);
        }

        route.asrStream = stream;
        console.log(`🎵 ASR stream attached: ${callId}`);
    }

    /**
     * Route audio from Telnyx to ASR
     */
    private handleTelnyxMessage(callId: string, data: any): void {
        const route = this.routes.get(callId);
        if (!route || !route.asrStream) {
            return;
        }

        // Forward audio data to ASR stream
        if (route.asrStream.readyState === WebSocket.OPEN) {
            route.asrStream.send(data);
        }

        // Emit event for monitoring
        this.emit('audio:received', { callId, size: data.length });
    }

    /**
     * Handle Telnyx stream close
     */
    private handleTelnyxClose(callId: string): void {
        console.log(`🎵 Telnyx stream closed: ${callId}`);
        this.emit('telnyx:closed', { callId });
    }

    /**
     * Handle Telnyx stream error
     */
    private handleTelnyxError(callId: string, error: Error): void {
        console.error(`🎵 Telnyx stream error: ${callId}`, error);
        this.emit('telnyx:error', { callId, error });
    }

    /**
     * Send audio to Telnyx (for TTS playback)
     */
    public async sendToTelnyx(callId: string, audioData: Buffer): Promise<void> {
        const route = this.routes.get(callId);
        if (!route || !route.telnyxStream) {
            throw new Error(`Telnyx stream not available: ${callId}`);
        }

        if (route.telnyxStream.readyState === WebSocket.OPEN) {
            route.telnyxStream.send(audioData);
        }
    }

    /**
     * Unregister media route
     */
    public async unregisterRoute(callId: string): Promise<void> {
        const route = this.routes.get(callId);
        if (!route) {
            return;
        }

        // Close streams
        if (route.telnyxStream) {
            route.telnyxStream.close();
        }
        if (route.asrStream) {
            route.asrStream.close();
        }

        this.routes.delete(callId);
        console.log(`🎵 Media route unregistered: ${callId}`);
    }

    /**
     * Get route
     */
    public getRoute(callId: string): MediaRoute | undefined {
        return this.routes.get(callId);
    }

    /**
     * Get all routes
     */
    public getAllRoutes(): MediaRoute[] {
        return Array.from(this.routes.values());
    }
}
