/**
 * Telnyx STT Service
 * Speech-to-Text using Telnyx AI Transcription
 * NO external ASR providers (Deepgram, etc.)
 */

import { EventEmitter } from 'events';
import axios from 'axios';

export interface TranscriptEvent {
    callControlId: string;
    text: string;
    confidence: number;
    isFinal: boolean;
    timestamp: number;
}

export interface STTConfig {
    language?: string;
    model?: string;
    interimResults?: boolean;
}

export class TelnyxSTTService extends EventEmitter {
    private apiKey: string;
    private baseUrl: string = 'https://api.telnyx.com/v2';
    private activeTranscriptions: Map<string, any> = new Map();

    constructor() {
        super();
        this.apiKey = process.env.TELNYX_API_KEY || '';

        if (!this.apiKey) {
            throw new Error('TELNYX_API_KEY is required for STT service');
        }

        console.log('✅ TelnyxSTTService initialized');
    }

    /**
     * Start transcription for a call
     */
    public async startTranscription(
        callControlId: string,
        config?: STTConfig
    ): Promise<void> {
        try {
            console.log(`🎤 Starting transcription: ${callControlId}`);

            const transcriptionConfig = {
                language: config?.language || 'en',
                model: config?.model || 'nova-2',
                interimResults: config?.interimResults !== false
            };

            this.activeTranscriptions.set(callControlId, transcriptionConfig);

            console.log(`✅ Transcription started: ${callControlId}`);
            this.emit('transcription:started', { callControlId });

        } catch (error: any) {
            console.error(`❌ Error starting transcription: ${callControlId}`, error);
            this.emit('error', { callControlId, error });
            throw error;
        }
    }

    /**
     * Process audio chunk and get transcription
     * This is called for each audio packet from the media stream
     */
    public async processAudioChunk(
        callControlId: string,
        audioData: Buffer
    ): Promise<void> {
        const config = this.activeTranscriptions.get(callControlId);
        if (!config) {
            console.warn(`⚠️ No active transcription for: ${callControlId}`);
            return;
        }

        try {
            // Convert audio buffer to base64
            const audioBase64 = audioData.toString('base64');

            // Call Telnyx STT API
            const response = await axios.post(
                `${this.baseUrl}/ai/transcribe`,
                {
                    audio: audioBase64,
                    language: config.language,
                    model: config.model,
                    encoding: 'linear16',
                    sample_rate: 8000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const { transcript, confidence, is_final } = response.data.data;

            if (transcript && transcript.trim().length > 0) {
                const event: TranscriptEvent = {
                    callControlId,
                    text: transcript,
                    confidence: confidence || 1.0,
                    isFinal: is_final || false,
                    timestamp: Date.now()
                };

                // Emit appropriate event
                if (event.isFinal) {
                    console.log(`📝 Final transcript: "${event.text}" (${event.confidence})`);
                    this.emit('final_transcript', event);
                } else {
                    console.log(`📝 Partial transcript: "${event.text}"`);
                    this.emit('partial_transcript', event);
                }
            }

        } catch (error: any) {
            // Don't log every error (too noisy), just emit
            if (error.response?.status !== 429) { // Ignore rate limits
                console.error(`❌ STT processing error: ${callControlId}`, error.message);
            }
            this.emit('error', { callControlId, error });
        }
    }

    /**
     * Stop transcription for a call
     */
    public async stopTranscription(callControlId: string): Promise<void> {
        try {
            console.log(`🛑 Stopping transcription: ${callControlId}`);

            this.activeTranscriptions.delete(callControlId);

            this.emit('transcription:stopped', { callControlId });
            console.log(`✅ Transcription stopped: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error stopping transcription: ${callControlId}`, error);
            this.emit('error', { callControlId, error });
        }
    }

    /**
     * Check if transcription is active
     */
    public isActive(callControlId: string): boolean {
        return this.activeTranscriptions.has(callControlId);
    }

    /**
     * Get active transcription count
     */
    public getActiveCount(): number {
        return this.activeTranscriptions.size;
    }

    /**
     * Clean up all transcriptions
     */
    public async cleanup(): Promise<void> {
        const callControlIds = Array.from(this.activeTranscriptions.keys());

        for (const callControlId of callControlIds) {
            await this.stopTranscription(callControlId);
        }

        console.log('✅ TelnyxSTTService cleaned up');
    }
}
