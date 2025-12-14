/**
 * Telnyx TTS Service
 * Text-to-Speech using Telnyx Speak API
 * NO external TTS providers
 */

import axios from 'axios';

export interface TTSOptions {
    voice?: 'male' | 'female';
    language?: string;
    rate?: number; // 0.5 - 2.0
}

export class TelnyxTTSService {
    private apiKey: string;
    private baseUrl: string = 'https://api.telnyx.com/v2';
    private activeSpeech: Map<string, boolean> = new Map();

    constructor() {
        this.apiKey = process.env.TELNYX_API_KEY || '';

        if (!this.apiKey) {
            throw new Error('TELNYX_API_KEY is required for TTS service');
        }

        console.log('✅ TelnyxTTSService initialized');
    }

    /**
     * Speak text on a call
     */
    public async speak(
        callControlId: string,
        text: string,
        options?: TTSOptions
    ): Promise<void> {
        try {
            // Check if already speaking (prevent overlaps)
            if (this.activeSpeech.get(callControlId)) {
                console.warn(`⚠️ Already speaking on call: ${callControlId}`);
                await this.stopSpeaking(callControlId);
            }

            console.log(`🗣️ Speaking: ${callControlId}`);
            console.log(`   Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

            this.activeSpeech.set(callControlId, true);

            // Call Telnyx Speak API
            await axios.post(
                `${this.baseUrl}/calls/${callControlId}/actions/speak`,
                {
                    payload: text,
                    voice: options?.voice || 'female',
                    language: options?.language || 'en-US',
                    payload_type: 'text'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Speak command sent: ${callControlId}`);

            // Clear active speech flag after a delay
            // (Telnyx will send speak.ended webhook, but this is a safety)
            setTimeout(() => {
                this.activeSpeech.delete(callControlId);
            }, 5000);

        } catch (error: any) {
            console.error(`❌ Error speaking: ${callControlId}`, error.message);
            this.activeSpeech.delete(callControlId);
            throw error;
        }
    }

    /**
     * Stop current speech
     */
    public async stopSpeaking(callControlId: string): Promise<void> {
        try {
            console.log(`🛑 Stopping speech: ${callControlId}`);

            // Call Telnyx Stop Speak API
            await axios.post(
                `${this.baseUrl}/calls/${callControlId}/actions/speak_stop`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            this.activeSpeech.delete(callControlId);

            console.log(`✅ Speech stopped: ${callControlId}`);

        } catch (error: any) {
            // Ignore errors if not speaking
            if (error.response?.status !== 404) {
                console.error(`❌ Error stopping speech: ${callControlId}`, error.message);
            }
            this.activeSpeech.delete(callControlId);
        }
    }

    /**
     * Check if currently speaking
     */
    public isSpeaking(callControlId: string): boolean {
        return this.activeSpeech.get(callControlId) || false;
    }

    /**
     * Mark speech as ended (called from webhook)
     */
    public markSpeechEnded(callControlId: string): void {
        this.activeSpeech.delete(callControlId);
        console.log(`✅ Speech ended: ${callControlId}`);
    }

    /**
     * Cleanup
     */
    public cleanup(): void {
        this.activeSpeech.clear();
        console.log('✅ TelnyxTTSService cleaned up');
    }
}
