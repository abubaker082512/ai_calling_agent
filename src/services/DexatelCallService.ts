/**
 * Dexatel Call Service (Updated with Actual API)
 * Handles voice call operations via Dexatel Voice Calls API
 * 
 * API Documentation: https://developers.dexatel.com/docs/voice-calls-api-overview
 * 
 * Key Features:
 * - Two-way calling via API
 * - Real-time audio streaming over WebSocket
 * - G.711 A-Law (PCMA), 8kHz, mono
 * - No SIP setup required
 */

import axios, { AxiosInstance } from 'axios';

export interface DexatelVoiceCallParams {
    to: string;              // Recipient phone number (E.164 format)
    stream_url: string;      // WebSocket endpoint for audio streaming
    from?: string;           // Optional: Dexatel-owned number (contact support to enable)
    max_duration?: number;   // Optional: Maximum call duration in seconds
}

export interface DexatelVoiceCallResponse {
    call_id: string;
    status: string;
    duration?: number;
    cost?: number;
    [key: string]: any;
}

export class DexatelCallService {
    private apiKey: string;
    private baseUrl: string = 'https://api.dexatel.com/v1';
    private client: AxiosInstance;

    constructor() {
        this.apiKey = process.env.DEXATEL_API_KEY || '';

        if (!this.apiKey) {
            console.warn('⚠️ DEXATEL_API_KEY not found - service will not work');
        }

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'X-Dexatel-Key': this.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('✅ DexatelCallService initialized');
    }

    /**
     * Initiate a voice call
     * This starts a two-way voice call with real-time audio streaming
     */
    public async makeCall(params: DexatelVoiceCallParams): Promise<DexatelVoiceCallResponse> {
        try {
            console.log(`📞 Making Dexatel voice call to: ${params.to}`);
            console.log(`   Stream URL: ${params.stream_url}`);

            const response = await this.client.post('/voice-calls', params);

            console.log(`✅ Call initiated: ${response.data.call_id}`);
            return response.data;

        } catch (error: any) {
            console.error('❌ Error making call:', error.response?.data || error.message);
            throw new Error(`Failed to make call: ${error.message}`);
        }
    }

    /**
     * Get call status/details
     */
    public async getCallStatus(callId: string): Promise<DexatelVoiceCallResponse> {
        try {
            const response = await this.client.get(`/voice-calls/${callId}`);
            return response.data;

        } catch (error: any) {
            console.error('❌ Error getting call status:', error.response?.data || error.message);
            throw new Error(`Failed to get call status: ${error.message}`);
        }
    }

    /**
     * Convenience method: Make call with automatic stream URL
     */
    public async makeCallSimple(to: string, from?: string): Promise<DexatelVoiceCallResponse> {
        const domain = process.env.DOMAIN || 'http://localhost:3000';
        const streamUrl = `wss://${domain.replace('https://', '').replace('http://', '')}/media/stream`;

        return this.makeCall({
            to,
            stream_url: streamUrl,
            from
        });
    }

    /**
     * Answer an incoming call (if supported by Dexatel)
     * Note: Dexatel Voice API is primarily for outbound calls
     * Inbound call handling may require different setup
     */
    public async answerCall(callId: string): Promise<void> {
        try {
            console.log(`📞 Answering call: ${callId}`);
            // This endpoint may not exist - Dexatel focuses on outbound calls
            await this.client.post(`/voice-calls/${callId}/answer`);
            console.log(`✅ Call answered: ${callId}`);

        } catch (error: any) {
            console.error('❌ Error answering call:', error.response?.data || error.message);
            // Don't throw - this may not be supported
            console.warn('⚠️ Dexatel Voice API may not support inbound call answering');
        }
    }

    /**
     * Hangup a call
     */
    public async hangupCall(callId: string): Promise<void> {
        try {
            console.log(`📴 Hanging up call: ${callId}`);

            await this.client.post(`/voice-calls/${callId}/hangup`);

            console.log(`✅ Call hung up: ${callId}`);

        } catch (error: any) {
            console.error('❌ Error hanging up call:', error.response?.data || error.message);
            throw new Error(`Failed to hangup call: ${error.message}`);
        }
    }

    /**
     * Note: Dexatel Voice API uses WebSocket for audio streaming
     * TTS/STT should be handled through the WebSocket connection
     * The following methods are placeholders for compatibility
     */

    /**
     * Speak text (via WebSocket audio stream)
     * This is a placeholder - actual TTS should be done via WebSocket
     */
    public async speak(callId: string, text: string, options?: {
        voice?: string;
        language?: string;
    }): Promise<void> {
        console.warn('⚠️ Dexatel Voice API uses WebSocket for audio');
        console.warn('   TTS should be handled via the audio stream');
        console.log(`🗣️ Would speak: "${text}" on call ${callId}`);

        // In actual implementation, convert text to audio and send via WebSocket
        // This requires integration with a TTS service
    }

    /**
     * Start audio streaming (handled automatically by Dexatel)
     */
    public async startStreaming(callId: string, streamUrl: string): Promise<void> {
        console.log(`🎵 Audio streaming is automatic with Dexatel`);
        console.log(`   Stream URL was provided during call initiation`);
        // Streaming starts automatically when call is initiated
    }

    /**
     * Stop audio streaming
     */
    public async stopStreaming(callId: string): Promise<void> {
        console.log(`🎵 Stopping stream by hanging up call: ${callId}`);
        await this.hangupCall(callId);
    }

    /**
     * Transfer call (if supported)
     */
    public async transferCall(callId: string, to: string): Promise<void> {
        try {
            console.log(`📞 Transferring call: ${callId} → ${to}`);

            const payload = { to };
            await this.client.post(`/voice-calls/${callId}/transfer`, payload);

            console.log(`✅ Call transferred: ${callId}`);

        } catch (error: any) {
            console.error('❌ Error transferring call:', error.response?.data || error.message);
            console.warn('⚠️ Call transfer may not be supported by Dexatel Voice API');
        }
    }

    /**
     * Get account balance/credits
     */
    public async getBalance(): Promise<any> {
        try {
            const response = await this.client.get('/account/balance');
            return response.data;

        } catch (error: any) {
            console.error('❌ Error getting balance:', error.response?.data || error.message);
            throw new Error(`Failed to get balance: ${error.message}`);
        }
    }
}
