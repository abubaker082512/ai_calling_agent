import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TelnyxTTSConfig {
    voice?: string;
}

/**
 * Telnyx TTS Service using WebSocket API
 * Based on official documentation: https://developers.telnyx.com/docs/voice/programmable-voice/tts-standalone/
 */
export class TelnyxTTSService extends EventEmitter {
    private apiKey: string;
    private voice: string;
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private audioQueue: Buffer[] = [];

    constructor(apiKey: string, config: TelnyxTTSConfig = {}) {
        super();
        this.apiKey = apiKey;
        this.voice = config.voice || 'AWS.Polly.Joanna-Neural';
    }

    async connect(): Promise<void> {
        // Connection is created per synthesis request
        console.log('✅ Telnyx TTS service ready');
    }

    async synthesize(text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`🗣️ Synthesizing: "${text}" with voice: ${this.voice}`);

            // Create WebSocket connection with voice parameter
            const wsUrl = `wss://api.telnyx.com/v2/text-to-speech/speech?voice=${encodeURIComponent(this.voice)}`;

            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            this.audioQueue = [];
            let audioReceived = false;

            this.ws.on('open', () => {
                console.log('🔌 TTS WebSocket connected');
                this.isConnected = true;

                // Message sequence from documentation:
                // 1. Initialization frame
                this.ws!.send(JSON.stringify({ text: ' ' }));
                console.log('📤 Sent initialization frame');

                // 2. Text to synthesize
                this.ws!.send(JSON.stringify({ text: text }));
                console.log('📤 Sent text frame');

                // 3. Stop signal
                setTimeout(() => {
                    this.ws!.send(JSON.stringify({ text: '' }));
                    console.log('📤 Sent stop frame');

                    // Wait for audio chunks to arrive
                    setTimeout(() => {
                        if (this.audioQueue.length > 0) {
                            const completeAudio = Buffer.concat(this.audioQueue);
                            console.log(`🎵 Complete audio: ${completeAudio.length} bytes from ${this.audioQueue.length} chunks`);
                            this.emit('audio', completeAudio);
                            this.emit('done');
                            audioReceived = true;
                        } else {
                            console.warn('⚠️ No audio chunks received');
                            this.emit('done');
                        }

                        this.ws?.close();
                        resolve();
                    }, 1000); // Wait 1 second for all chunks
                }, 100);
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.audio) {
                        const audioBuffer = Buffer.from(message.audio, 'base64');
                        console.log(`🎵 Audio chunk received: ${audioBuffer.length} bytes`);
                        this.audioQueue.push(audioBuffer);
                    } else if (message.error) {
                        console.error('❌ TTS error:', message.error);
                        reject(new Error(message.error));
                    } else {
                        console.log('📨 TTS message:', message);
                    }
                } catch (err) {
                    console.error('Error parsing TTS message:', err);
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ TTS WebSocket error:', error);
                this.emit('error', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('🔌 TTS WebSocket closed');
                this.isConnected = false;

                // If we didn't receive audio yet, emit done anyway
                if (!audioReceived) {
                    this.emit('done');
                }
            });
        });
    }

    async stop(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    changeVoice(voice: string): void {
        this.voice = voice;
        console.log(`🔄 Voice changed to: ${voice}`);
    }
}
