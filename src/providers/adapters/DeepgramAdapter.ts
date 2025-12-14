/**
 * Deepgram ASR Adapter
 * Implementation of ASRProvider for Deepgram
 */

import { ASRProvider, ASRConfig, ASRStream, TranscriptResult } from '../ASRProvider';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export class DeepgramAdapter extends ASRProvider {
    private deepgram: any;
    private activeStreams: Map<string, any> = new Map();

    constructor(config: ASRConfig) {
        super(config);
        this.deepgram = createClient(config.apiKey);
    }

    async startStream(sessionId: string): Promise<ASRStream> {
        const connection = this.deepgram.listen.live({
            model: this.config.model || 'nova-2',
            language: this.config.language || 'en-US',
            smart_format: true,
            interim_results: true,
            utterance_end_ms: 1000,
            vad_events: true,
        });

        // Handle transcript events
        connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
            const transcript = data.channel.alternatives[0];
            if (transcript && transcript.transcript) {
                const result: TranscriptResult = {
                    text: transcript.transcript,
                    confidence: transcript.confidence,
                    isFinal: data.is_final,
                    timestamp: Date.now(),
                    words: transcript.words?.map((w: any) => ({
                        word: w.word,
                        start: w.start,
                        end: w.end,
                        confidence: w.confidence
                    }))
                };
                this.emit('transcript', result);
            }
        });

        // Handle speech start
        connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
            this.emit('speech_start');
        });

        // Handle errors
        connection.on(LiveTranscriptionEvents.Error, (error: any) => {
            console.error('Deepgram error:', error);
            this.emit('error', error);
        });

        // Handle close
        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log('Deepgram connection closed');
            this.activeStreams.delete(sessionId);
        });

        // Store connection
        this.activeStreams.set(sessionId, connection);

        // Return stream interface
        return {
            send: (audioData: Buffer) => {
                if (connection) {
                    connection.send(audioData);
                }
            },
            close: () => {
                if (connection) {
                    connection.finish();
                }
            }
        };
    }

    async stopStream(sessionId: string): Promise<void> {
        const connection = this.activeStreams.get(sessionId);
        if (connection) {
            connection.finish();
            this.activeStreams.delete(sessionId);
        }
    }

    getProviderName(): string {
        return 'Deepgram';
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Simple check - verify API key is set
            return !!this.config.apiKey;
        } catch (error) {
            return false;
        }
    }
}
