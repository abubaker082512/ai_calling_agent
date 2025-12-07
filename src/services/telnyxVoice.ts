import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface TelnyxCallConfig {
    to: string;
    from: string;
    streamUrl?: string;
    streamTrack?: 'inbound_track' | 'outbound_track' | 'both_tracks';
    voice?: string;
}

export interface TelnyxWebhookPayload {
    event_type: string;
    payload: {
        call_control_id: string;
        call_leg_id: string;
        call_session_id: string;
        connection_id: string;
        direction?: string;
        from?: string;
        to?: string;
        state?: string;
        start_time?: string;
        end_time?: string;
        hangup_cause?: string;
        hangup_source?: string;
    };
}

/**
 * Telnyx Voice API Service
 * Handles all voice-related operations including:
 * - Outbound/inbound call management
 * - Call control (answer, hangup, transfer)
 * - TTS (Text-to-Speech)
 * - Media streaming
 * - Call recording
 */
export class TelnyxVoiceService extends EventEmitter {
    private apiKey: string;
    private connectionId: string;
    private baseURL: string = 'https://api.telnyx.com/v2';
    private client: AxiosInstance;

    constructor() {
        super();

        this.apiKey = process.env.TELNYX_API_KEY || '';
        this.connectionId = process.env.TELNYX_CONNECTION_ID || '';

        if (!this.apiKey) {
            throw new Error('TELNYX_API_KEY is required');
        }

        if (!this.connectionId) {
            throw new Error('TELNYX_CONNECTION_ID is required');
        }

        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });

        console.log('📞 Telnyx Voice API initialized');
    }

    /**
     * Make an outbound call
     */
    async makeCall(config: TelnyxCallConfig): Promise<string> {
        try {
            console.log(`📞 Making outbound call to ${config.to}`);

            const response = await this.client.post('/calls', {
                to: config.to,
                from: config.from,
                connection_id: this.connectionId,
                stream_url: config.streamUrl,
                stream_track: config.streamTrack || 'both_tracks',
                command_id: this.generateCommandId()
            });

            const callControlId = response.data.data.call_control_id;
            console.log(`✅ Call initiated: ${callControlId}`);

            return callControlId;
        } catch (error: any) {
            console.error('❌ Error making call:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Answer an incoming call
     */
    async answerCall(callControlId: string, streamUrl?: string): Promise<void> {
        try {
            console.log(`📞 Answering call: ${callControlId}`);

            await this.client.post(`/calls/${callControlId}/actions/answer`, {
                command_id: this.generateCommandId(),
                stream_url: streamUrl,
                stream_track: streamUrl ? 'both_tracks' : undefined
            });

            console.log(`✅ Call answered: ${callControlId}`);
        } catch (error: any) {
            console.error('❌ Error answering call:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Speak text using TTS
     */
    async speak(
        callControlId: string,
        text: string,
        voice: string = 'AWS.Polly.Joanna-Neural',
        language: string = 'en-US'
    ): Promise<void> {
        try {
            console.log(`🗣️ Speaking on call ${callControlId}: "${text}"`);

            await this.client.post(`/calls/${callControlId}/actions/speak`, {
                payload: text,
                voice,
                language,
                command_id: this.generateCommandId()
            });

            console.log(`✅ TTS command sent`);
        } catch (error: any) {
            console.error('❌ Error speaking:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Start recording a call
     */
    async startRecording(
        callControlId: string,
        format: 'mp3' | 'wav' = 'mp3',
        channels: 'single' | 'dual' = 'dual'
    ): Promise<void> {
        try {
            console.log(`🎙️ Starting recording: ${callControlId}`);

            await this.client.post(`/calls/${callControlId}/actions/record_start`, {
                format,
                channels,
                command_id: this.generateCommandId()
            });

            console.log(`✅ Recording started`);
        } catch (error: any) {
            console.error('❌ Error starting recording:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Stop recording a call
     */
    async stopRecording(callControlId: string): Promise<void> {
        try {
            console.log(`🛑 Stopping recording: ${callControlId}`);

            await this.client.post(`/calls/${callControlId}/actions/record_stop`, {
                command_id: this.generateCommandId()
            });

            console.log(`✅ Recording stopped`);
        } catch (error: any) {
            console.error('❌ Error stopping recording:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Hangup a call
     */
    async hangup(callControlId: string): Promise<void> {
        try {
            console.log(`📴 Hanging up call: ${callControlId}`);

            await this.client.post(`/calls/${callControlId}/actions/hangup`, {
                command_id: this.generateCommandId()
            });

            console.log(`✅ Call hung up`);
        } catch (error: any) {
            console.error('❌ Error hanging up:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Bridge two calls together
     */
    async bridge(callControlId: string, targetCallControlId: string): Promise<void> {
        try {
            console.log(`🌉 Bridging calls: ${callControlId} -> ${targetCallControlId}`);

            await this.client.post(`/calls/${callControlId}/actions/bridge`, {
                call_control_id: targetCallControlId,
                command_id: this.generateCommandId()
            });

            console.log(`✅ Calls bridged`);
        } catch (error: any) {
            console.error('❌ Error bridging calls:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Transfer a call
     */
    async transfer(callControlId: string, to: string): Promise<void> {
        try {
            console.log(`📞 Transferring call ${callControlId} to ${to}`);

            await this.client.post(`/calls/${callControlId}/actions/transfer`, {
                to,
                command_id: this.generateCommandId()
            });

            console.log(`✅ Call transferred`);
        } catch (error: any) {
            console.error('❌ Error transferring call:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get call information
     */
    async getCallInfo(callControlId: string): Promise<any> {
        try {
            const response = await this.client.get(`/calls/${callControlId}`);
            return response.data.data;
        } catch (error: any) {
            console.error('❌ Error getting call info:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Generate unique command ID
     */
    private generateCommandId(): string {
        return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Handle webhook event
     */
    handleWebhook(payload: TelnyxWebhookPayload): void {
        const { event_type } = payload;

        console.log(`📨 Webhook received: ${event_type}`);

        // Emit event for listeners
        this.emit(event_type, payload);
        this.emit('webhook', payload);
    }
}
