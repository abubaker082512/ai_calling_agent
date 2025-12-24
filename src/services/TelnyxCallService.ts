/**
 * Telnyx Call Service
 * Abstraction layer for Telnyx call control operations
 * Pure telephony operations - no business logic
 */

import telnyx from 'telnyx';

export interface CallControlOptions {
    clientState?: string;
    commandId?: string;
}

export interface SpeakOptions {
    voice?: string;
    language?: string;
    payload_type?: 'text' | 'ssml';
}

export interface StreamingOptions {
    stream_track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
}

export class TelnyxCallService {
    private client: any;
    private apiKey: string;
    private connectionId: string;

    constructor() {
        this.apiKey = process.env.TELNYX_API_KEY || '';
        this.connectionId = process.env.TELNYX_CONNECTION_ID || '';

        if (!this.apiKey) {
            console.warn('⚠️ TELNYX_API_KEY not set - Telnyx service will not work');
            console.warn('   Using Dexatel as primary provider');
            return;
        }

        if (!this.connectionId) {
            console.warn('⚠️ TELNYX_CONNECTION_ID not set - Telnyx service will not work');
            console.warn('   Using Dexatel as primary provider');
            return;
        }

        // Initialize Telnyx client
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const telnyxClient = require('telnyx');
        this.client = telnyxClient(this.apiKey);

        console.log('✅ TelnyxCallService initialized');
    }

    /**
     * Answer an incoming call
     */
    async answerCall(
        callControlId: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`📞 Answering call: ${callControlId}`);

            await this.client.calls.answer({
                call_control_id: callControlId,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Call answered: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error answering call: ${callControlId}`, error);
            throw new Error(`Failed to answer call: ${error.message}`);
        }
    }

    /**
     * Hangup a call
     */
    async hangupCall(
        callControlId: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`📴 Hanging up call: ${callControlId}`);

            await this.client.calls.hangup({
                call_control_id: callControlId,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Call hung up: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error hanging up call: ${callControlId}`, error);
            throw new Error(`Failed to hangup call: ${error.message}`);
        }
    }

    /**
     * Speak text on a call (TTS)
     */
    async speak(
        callControlId: string,
        text: string,
        options?: SpeakOptions & CallControlOptions
    ): Promise<void> {
        try {
            console.log(`🗣️ Speaking on call: ${callControlId}`);
            console.log(`   Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

            await this.client.calls.speak({
                call_control_id: callControlId,
                payload: text,
                voice: options?.voice || 'female',
                language: options?.language || 'en-US',
                payload_type: options?.payload_type || 'text',
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Speak command sent: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error speaking on call: ${callControlId}`, error);
            throw new Error(`Failed to speak: ${error.message}`);
        }
    }

    /**
     * Start media streaming
     */
    async startStreaming(
        callControlId: string,
        streamUrl: string,
        options?: StreamingOptions & CallControlOptions
    ): Promise<void> {
        try {
            console.log(`🎵 Starting streaming: ${callControlId}`);
            console.log(`   Stream URL: ${streamUrl}`);

            await this.client.calls.streaming_start({
                call_control_id: callControlId,
                stream_url: streamUrl,
                stream_track: options?.stream_track || 'inbound_track',
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Streaming started: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error starting streaming: ${callControlId}`, error);
            throw new Error(`Failed to start streaming: ${error.message}`);
        }
    }

    /**
     * Stop media streaming
     */
    async stopStreaming(
        callControlId: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`🎵 Stopping streaming: ${callControlId}`);

            await this.client.calls.streaming_stop({
                call_control_id: callControlId,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Streaming stopped: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error stopping streaming: ${callControlId}`, error);
            throw new Error(`Failed to stop streaming: ${error.message}`);
        }
    }

    /**
     * Transfer call to another number
     */
    async transferCall(
        callControlId: string,
        toNumber: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`📞 Transferring call: ${callControlId} → ${toNumber}`);

            await this.client.calls.transfer({
                call_control_id: callControlId,
                to: toNumber,
                from: process.env.TELNYX_FROM_NUMBER,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Call transferred: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error transferring call: ${callControlId}`, error);
            throw new Error(`Failed to transfer call: ${error.message}`);
        }
    }

    /**
     * Mute call
     */
    async muteCall(
        callControlId: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`🔇 Muting call: ${callControlId}`);

            await this.client.calls.mute({
                call_control_id: callControlId,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Call muted: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error muting call: ${callControlId}`, error);
            throw new Error(`Failed to mute call: ${error.message}`);
        }
    }

    /**
     * Unmute call
     */
    async unmuteCall(
        callControlId: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`🔊 Unmuting call: ${callControlId}`);

            await this.client.calls.unmute({
                call_control_id: callControlId,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Call unmuted: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error unmuting call: ${callControlId}`, error);
            throw new Error(`Failed to unmute call: ${error.message}`);
        }
    }

    /**
     * Start call recording
     */
    async startRecording(
        callControlId: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`🔴 Starting recording: ${callControlId}`);

            await this.client.calls.record_start({
                call_control_id: callControlId,
                format: 'mp3',
                channels: 'dual',
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Recording started: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error starting recording: ${callControlId}`, error);
            throw new Error(`Failed to start recording: ${error.message}`);
        }
    }

    /**
     * Stop call recording
     */
    async stopRecording(
        callControlId: string,
        options?: CallControlOptions
    ): Promise<void> {
        try {
            console.log(`⏹️ Stopping recording: ${callControlId}`);

            await this.client.calls.record_stop({
                call_control_id: callControlId,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Recording stopped: ${callControlId}`);
        } catch (error: any) {
            console.error(`❌ Error stopping recording: ${callControlId}`, error);
            throw new Error(`Failed to stop recording: ${error.message}`);
        }
    }

    /**
     * Make an outbound call
     */
    async makeCall(
        toNumber: string,
        fromNumber: string,
        options?: CallControlOptions
    ): Promise<{ call_control_id: string; call_session_id: string }> {
        try {
            console.log(`📞 Making outbound call: ${fromNumber} → ${toNumber}`);

            const { data: call } = await this.client.calls.create({
                connection_id: this.connectionId,
                to: toNumber,
                from: fromNumber,
                webhook_url: `${process.env.DOMAIN}/telnyx/events`,
                client_state: options?.clientState,
                command_id: options?.commandId
            });

            console.log(`✅ Outbound call created: ${call.call_control_id}`);

            return {
                call_control_id: call.call_control_id,
                call_session_id: call.call_session_id
            };
        } catch (error: any) {
            console.error(`❌ Error making outbound call`, error);
            throw new Error(`Failed to make call: ${error.message}`);
        }
    }

    /**
     * Get call status
     */
    async getCallStatus(callControlId: string): Promise<any> {
        try {
            const { data: call } = await this.client.calls.retrieve(callControlId);
            return call;
        } catch (error: any) {
            console.error(`❌ Error getting call status: ${callControlId}`, error);
            throw new Error(`Failed to get call status: ${error.message}`);
        }
    }
}
