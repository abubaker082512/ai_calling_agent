/**
 * Telnyx Service (Refactored)
 * Pure telephony operations - no AI logic
 * Handles call control, media streaming, and TTS
 */

import telnyx from 'telnyx';
import EventEmitter from 'events';

export interface TelnyxCallParams {
    to: string;
    from: string;
    connectionId?: string;
    clientState?: any;
}

export class TelnyxService extends EventEmitter {
    private client: any;
    private apiKey: string;
    private connectionId: string;

    constructor() {
        super();
        this.apiKey = process.env.TELNYX_API_KEY || '';
        this.connectionId = process.env.TELNYX_CONNECTION_ID || '';

        if (!this.apiKey) {
            throw new Error('TELNYX_API_KEY is required');
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const telnyxClient = require('telnyx');
        this.client = telnyxClient(this.apiKey);

        console.log('✅ TelnyxService initialized');
    }

    /**
     * Handle webhook events from Telnyx
     */
    public async handleWebhook(event: any): Promise<void> {
        try {
            const { event_type, payload } = event.data;
            const callControlId = payload.call_control_id;

            console.log(`📞 Telnyx Event: ${event_type} | Call ID: ${callControlId}`);

            // Emit event for CallOrchestrator to handle
            this.emit(event_type, payload);

        } catch (error) {
            console.error('❌ Error handling Telnyx webhook:', error);
            throw error;
        }
    }

    /**
     * Answer an incoming call
     */
    public async answerCall(callControlId: string): Promise<void> {
        try {
            console.log(`📞 Answering call: ${callControlId}`);
            await this.client.calls.answer({
                call_control_id: callControlId
            });
        } catch (error) {
            console.error('❌ Error answering call:', error);
            throw error;
        }
    }

    /**
     * Start media streaming for a call
     */
    public async startMediaStream(callControlId: string): Promise<void> {
        try {
            const domain = process.env.DOMAIN || 'localhost:3000';
            const streamUrl = `wss://${domain}/media/stream`;

            console.log(`🎵 Starting media stream: ${streamUrl}`);

            await this.client.calls.streaming_start({
                call_control_id: callControlId,
                stream_url: streamUrl,
                stream_track: 'inbound_track'
            });
        } catch (error) {
            console.error('❌ Error starting media stream:', error);
            throw error;
        }
    }

    /**
     * Stop media streaming
     */
    public async stopMediaStream(callControlId: string): Promise<void> {
        try {
            console.log(`🎵 Stopping media stream: ${callControlId}`);
            await this.client.calls.streaming_stop({
                call_control_id: callControlId
            });
        } catch (error) {
            console.error('❌ Error stopping media stream:', error);
            throw error;
        }
    }

    /**
     * Speak text on a call (TTS)
     */
    public async speak(
        callControlId: string,
        text: string,
        options?: {
            voice?: string;
            language?: string;
        }
    ): Promise<void> {
        try {
            const voice = options?.voice || 'female';
            const language = options?.language || 'en-US';

            console.log(`🗣️ Speaking on call ${callControlId}: "${text.substring(0, 50)}..."`);

            await this.client.calls.speak({
                call_control_id: callControlId,
                payload: text,
                voice: voice,
                language: language
            });
        } catch (error) {
            console.error('❌ Error speaking on call:', error);
            throw error;
        }
    }

    /**
     * Make an outbound call
     */
    public async makeCall(to: string, from: string, clientState?: any): Promise<any> {
        try {
            console.log(`📞 Making outbound call: ${from} → ${to}`);

            const callParams: any = {
                connection_id: this.connectionId,
                to: to,
                from: from,
                webhook_url: `${process.env.DOMAIN}/webhooks/telnyx`,
            };

            if (clientState) {
                callParams.client_state = Buffer.from(
                    JSON.stringify(clientState)
                ).toString('base64');
            }

            const { data: call } = await this.client.calls.create(callParams);

            console.log(`✅ Outbound call created: ${call.call_control_id}`);
            return call;

        } catch (error) {
            console.error('❌ Error making outbound call:', error);
            throw error;
        }
    }

    /**
     * Hangup a call
     */
    public async hangupCall(callControlId: string): Promise<void> {
        try {
            console.log(`📞 Hanging up call: ${callControlId}`);
            await this.client.calls.hangup({
                call_control_id: callControlId
            });
        } catch (error) {
            console.error('❌ Error hanging up call:', error);
            throw error;
        }
    }

    /**
     * Transfer a call
     */
    public async transferCall(callControlId: string, to: string): Promise<void> {
        try {
            console.log(`📞 Transferring call ${callControlId} to ${to}`);
            await this.client.calls.transfer({
                call_control_id: callControlId,
                to: to
            });
        } catch (error) {
            console.error('❌ Error transferring call:', error);
            throw error;
        }
    }

    /**
     * Put call on hold
     */
    public async holdCall(callControlId: string): Promise<void> {
        try {
            console.log(`⏸️ Putting call on hold: ${callControlId}`);
            // Telnyx doesn't have a direct hold API, use mute instead
            await this.client.calls.mute({
                call_control_id: callControlId
            });
        } catch (error) {
            console.error('❌ Error holding call:', error);
            throw error;
        }
    }

    /**
     * Resume call from hold
     */
    public async resumeCall(callControlId: string): Promise<void> {
        try {
            console.log(`▶️ Resuming call: ${callControlId}`);
            await this.client.calls.unmute({
                call_control_id: callControlId
            });
        } catch (error) {
            console.error('❌ Error resuming call:', error);
            throw error;
        }
    }

    /**
     * Start call recording
     */
    public async startRecording(callControlId: string): Promise<void> {
        try {
            console.log(`🔴 Starting recording: ${callControlId}`);
            await this.client.calls.record_start({
                call_control_id: callControlId,
                format: 'mp3',
                channels: 'dual'
            });
        } catch (error) {
            console.error('❌ Error starting recording:', error);
            throw error;
        }
    }

    /**
     * Stop call recording
     */
    public async stopRecording(callControlId: string): Promise<void> {
        try {
            console.log(`⏹️ Stopping recording: ${callControlId}`);
            await this.client.calls.record_stop({
                call_control_id: callControlId
            });
        } catch (error) {
            console.error('❌ Error stopping recording:', error);
            throw error;
        }
    }
}
