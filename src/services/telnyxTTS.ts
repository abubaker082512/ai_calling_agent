import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TelnyxTTSConfig {
    voice?: string;
    sampleRate?: number;
    encoding?: 'mp3' | 'pcm';
}

export class TelnyxTTSService extends EventEmitter {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private config: TelnyxTTSConfig;
    private isConnected: boolean = false;
    private audioQueue: Buffer[] = [];

    constructor(apiKey: string, config: TelnyxTTSConfig = {}) {
        super();
        this.apiKey = apiKey;
        this.config = {
            voice: config.voice || 'AWS.Polly.Joanna-Neural',
            sampleRate: config.sampleRate || 24000,
            encoding: config.encoding || 'mp3'
        };
    }

    async connect(): Promise<void> {
        const wsUrl = `wss://api.telnyx.com/v2/text-to-speech/speech?voice=${encodeURIComponent(this.config.voice!)}`;

        this.ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        return new Promise((resolve, reject) => {
            this.ws!.on('open', () => {
                console.log(`✅ Telnyx TTS connected with voice: ${this.config.voice}`);
                this.isConnected = true;
                // Don't send initialization frame - it might cause auto-close
                resolve();
            });

            this.ws!.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.audio) {
                        // Buffer audio chunks (don't emit yet)
                        const audioBuffer = Buffer.from(message.audio, 'base64');
                        console.log(`🎵 TTS audio chunk buffered: ${audioBuffer.length} bytes`);
                        this.audioQueue.push(audioBuffer);
                    } else if (message.error) {
                        console.error('❌ TTS error:', message.error);
                        this.emit('error', new Error(message.error));
                    } else {
                        console.log('📨 TTS message:', message);
                    }
                } catch (err) {
                    console.error('Error parsing TTS message:', err);
                }
            });

            this.ws!.on('error', (error) => {
                console.error('❌ Telnyx TTS WebSocket error:', error);
                this.emit('error', error);
                reject(error);
            });

            this.ws!.on('close', () => {
                console.log('🔌 Telnyx TTS disconnected');
                this.isConnected = false;
                // Don't emit close during conversation - only when explicitly stopped
                // this.emit('close');
            });
        });
    }

    async synthesize(text: string): Promise<void> {
        if (!this.isConnected || !this.ws) {
            console.error('❌ TTS not connected - connection state:', this.isConnected);
            throw new Error('TTS not connected');
        }

        console.log(`🗣️ Synthesizing with ${this.config.voice}: "${text}"`);

        // Clear previous audio queue
        this.audioQueue = [];

        // Send text frame
        this.ws!.send(JSON.stringify({
            text: text
        }));

        // Send stop frame to signal end of text
        setTimeout(() => {
            if (this.ws && this.isConnected) {
                this.ws.send(JSON.stringify({
                    text: ""
                }));
                console.log('✅ TTS stop frame sent');

                // Wait for all chunks to arrive, then concatenate and emit
                setTimeout(() => {
                    if (this.audioQueue.length > 0) {
                        // Concatenate all chunks into one MP3 file
                        const completeAudio = Buffer.concat(this.audioQueue);
                        console.log(`🎵 Complete MP3 created: ${completeAudio.length} bytes from ${this.audioQueue.length} chunks`);

                        // Emit the complete audio
                        this.emit('audio', completeAudio);
                        this.emit('done');

                        // Clear queue
                        this.audioQueue = [];
                    } else {
                        console.warn('⚠️ No audio chunks received');
                        this.emit('done');
                    }
                }, 500); // Wait 500ms for all chunks to arrive
            }
        }, 50);
    }

    async stop(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.audioQueue = [];
        }
    }

    changeVoice(voice: string): void {
        this.config.voice = voice;
        console.log(`🔄 Voice will change to: ${voice} on next connection`);
    }

    getAudioQueue(): Buffer[] {
        return this.audioQueue;
    }

    clearAudioQueue(): void {
        this.audioQueue = [];
    }
}
