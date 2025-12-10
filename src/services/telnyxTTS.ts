import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TelnyxTTSConfig {
    voice?: string;
    sampleRate?: number;
    encoding?: 'mp3' | 'pcm';
}

export class TelnyxTTSService extends EventEmitter {
    private apiKey: string;
    private config: TelnyxTTSConfig;

    constructor(apiKey: string, config: TelnyxTTSConfig = {}) {
        super();
        this.apiKey = apiKey;
        this.config = {
            voice: config.voice || 'AWS.Polly.Joanna-Neural',
            sampleRate: config.sampleRate || 24000,
            encoding: config.encoding || 'mp3'
        };
    }

    // No persistent connection - create new one for each synthesis
    async connect(): Promise<void> {
        console.log('✅ TTS service initialized (connections created per synthesis)');
        // No-op - we create connections on-demand
    }

    async synthesize(text: string): Promise<void> {
        console.log(`🗣️ Synthesizing with ${this.config.voice}: "${text}"`);

        return new Promise((resolve, reject) => {
            const wsUrl = `wss://api.telnyx.com/v2/text-to-speech/speech?voice=${encodeURIComponent(this.config.voice!)}`;
            const ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            const audioQueue: Buffer[] = [];
            let isConnected = false;

            ws.on('open', () => {
                console.log(`🔌 TTS WebSocket opened for synthesis`);
                isConnected = true;

                // Send text frame
                ws.send(JSON.stringify({ text: text }));

                // Send stop frame
                setTimeout(() => {
                    ws.send(JSON.stringify({ text: "" }));
                    console.log('✅ TTS stop frame sent');

                    // Wait for audio chunks
                    setTimeout(() => {
                        if (audioQueue.length > 0) {
                            const completeAudio = Buffer.concat(audioQueue);
                            console.log(`🎵 Complete MP3: ${completeAudio.length} bytes from ${audioQueue.length} chunks`);

                            this.emit('audio', completeAudio);
                            this.emit('done');
                        } else {
                            console.warn('⚠️ No audio chunks received');
                            this.emit('done');
                        }

                        // Close connection after synthesis
                        ws.close();
                        resolve();
                    }, 500);
                }, 50);
            });

            ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.audio) {
                        const audioBuffer = Buffer.from(message.audio, 'base64');
                        console.log(`🎵 TTS audio chunk: ${audioBuffer.length} bytes`);
                        audioQueue.push(audioBuffer);
                    } else if (message.error) {
                        console.error('❌ TTS error:', message.error);
                        this.emit('error', new Error(message.error));
                        ws.close();
                        reject(new Error(message.error));
                    }
                } catch (err) {
                    console.error('Error parsing TTS message:', err);
                }
            });

            ws.on('error', (error) => {
                console.error('❌ TTS WebSocket error:', error);
                this.emit('error', error);
                reject(error);
            });

            ws.on('close', () => {
                console.log('🔌 TTS WebSocket closed');
            });
        });
    }

    async stop(): Promise<void> {
        console.log('🛑 TTS service stopped');
        // No persistent connection to close
    }

    changeVoice(voice: string): void {
        this.config.voice = voice;
        console.log(`🔄 Voice changed to: ${voice}`);
    }
}
