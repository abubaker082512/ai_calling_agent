import WebSocket from 'ws';
import EventEmitter from 'events';

export interface TranscriptResult {
    text: string;
    isFinal: boolean;
    confidence: number;
    speaker?: string;
}

export class TelnyxAIService extends EventEmitter {
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private apiKey: string;
    private streamUrl: string = 'wss://rtc.telnyx.com/v2/calls/stream';

    constructor() {
        super();
        this.apiKey = process.env.TELNYX_API_KEY || '';

        if (!this.apiKey) {
            console.error('❌ TELNYX_API_KEY is missing');
            throw new Error('TELNYX_API_KEY is required');
        }
    }

    /**
     * Start live transcription stream using Telnyx Media Streaming
     */
    async startStream(options?: { encoding?: string; sampleRate?: number }): Promise<void> {
        try {
            console.log('🎤 Starting Telnyx AI live transcription...');

            const encoding = options?.encoding || 'mulaw';
            const sampleRate = options?.sampleRate || 8000;

            console.log(`📊 Telnyx config: encoding=${encoding}, sampleRate=${sampleRate}`);

            // Create WebSocket connection to Telnyx
            this.ws = new WebSocket(this.streamUrl, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            // Handle connection open
            this.ws.on('open', () => {
                console.log('✅ Telnyx AI connection opened');
                this.isConnected = true;

                // Send configuration
                if (this.ws) {
                    this.ws.send(JSON.stringify({
                        event: 'start',
                        start: {
                            streamSid: `stream_${Date.now()}`,
                            customParameters: {
                                transcription: {
                                    enabled: true,
                                    engine: 'telnyx', // Use Telnyx's in-house STT
                                    language: 'en-US',
                                    interim_results: true
                                }
                            },
                            mediaFormat: {
                                encoding: encoding,
                                sampleRate: sampleRate,
                                channels: 1
                            }
                        }
                    }));
                }

                this.emit('ready');
            });

            // Handle incoming messages (transcriptions)
            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.event === 'transcription') {
                        const transcript = message.transcription;

                        if (transcript && transcript.text) {
                            const result: TranscriptResult = {
                                text: transcript.text,
                                isFinal: transcript.is_final || false,
                                confidence: transcript.confidence || 0.9,
                                speaker: 'human'
                            };

                            // Emit transcript event
                            if (result.isFinal) {
                                console.log(`📝 Final transcript: "${result.text}"`);
                                this.emit('transcript', result);
                            } else {
                                console.log(`📝 Interim: "${result.text}"`);
                                this.emit('interim', result);
                            }
                        }
                    } else if (message.event === 'speech_started') {
                        console.log('🎤 Speech started');
                        this.emit('speech_start');
                    }
                } catch (error) {
                    console.error('❌ Error parsing Telnyx message:', error);
                }
            });

            // Handle errors
            this.ws.on('error', (error: Error) => {
                console.error('❌ Telnyx AI error:', error);
                this.emit('error', error);
            });

            // Handle connection close
            this.ws.on('close', () => {
                console.log('🔌 Telnyx AI connection closed');
                this.isConnected = false;
                this.emit('close');
            });

        } catch (error) {
            console.error('❌ Failed to start Telnyx AI stream:', error);
            throw error;
        }
    }

    /**
     * Send audio data to Telnyx for transcription
     */
    sendAudio(audioData: Buffer): void {
        if (!this.isConnected || !this.ws) {
            console.warn('⚠️ Cannot send audio - Telnyx AI not connected');
            return;
        }

        try {
            // Send audio as media message
            this.ws.send(JSON.stringify({
                event: 'media',
                media: {
                    payload: audioData.toString('base64')
                }
            }));
        } catch (error) {
            console.error('❌ Error sending audio to Telnyx AI:', error);
            this.emit('error', error);
        }
    }

    /**
     * Finish the transcription stream
     */
    async finish(): Promise<void> {
        if (this.ws) {
            console.log('🛑 Finishing Telnyx AI stream...');
            this.ws.send(JSON.stringify({ event: 'stop' }));
        }
    }

    /**
     * Close the connection
     */
    async close(): Promise<void> {
        if (this.ws) {
            console.log('🔌 Closing Telnyx AI connection...');
            await this.finish();
            this.ws.close();
            this.isConnected = false;
        }
    }

    /**
     * Check if connected
     */
    isReady(): boolean {
        return this.isConnected;
    }
}
