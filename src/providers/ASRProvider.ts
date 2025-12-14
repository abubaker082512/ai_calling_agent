/**
 * ASR Provider Interface
 * Abstract interface for speech-to-text providers
 * Allows easy swapping between Deepgram, Google, AWS, etc.
 */

import { EventEmitter } from 'events';

export interface ASRConfig {
    apiKey: string;
    language?: string;
    model?: string;
    sampleRate?: number;
    encoding?: string;
    channels?: number;
}

export interface TranscriptResult {
    text: string;
    confidence: number;
    isFinal: boolean;
    language?: string;
    timestamp?: number;
    words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
    }>;
}

export interface ASRStream {
    send(audioData: Buffer): void;
    close(): void;
}

/**
 * Abstract ASR Provider
 */
export abstract class ASRProvider extends EventEmitter {
    protected config: ASRConfig;

    constructor(config: ASRConfig) {
        super();
        this.config = config;
    }

    /**
     * Start a new transcription stream
     */
    abstract startStream(sessionId: string): Promise<ASRStream>;

    /**
     * Stop transcription stream
     */
    abstract stopStream(sessionId: string): Promise<void>;

    /**
     * Get provider name
     */
    abstract getProviderName(): string;

    /**
     * Health check
     */
    abstract healthCheck(): Promise<boolean>;

    /**
     * Events emitted:
     * - 'transcript' (result: TranscriptResult)
     * - 'speech_start' ()
     * - 'speech_end' ()
     * - 'error' (error: Error)
     */
}
