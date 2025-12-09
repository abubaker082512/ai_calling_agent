import axios from 'axios';
import { EventEmitter } from 'events';

export interface TelnyxTTSConfig {
    voice?: string;
}

/**
 * Telnyx TTS Service using REST API
 * Returns complete MP3 files instead of streaming chunks
 */
export class TelnyxTTSRestService extends EventEmitter {
    private apiKey: string;
    private config: TelnyxTTSConfig;

    constructor(apiKey: string, config: TelnyxTTSConfig = {}) {
        super();
        this.apiKey = apiKey;
        this.config = {
            voice: config.voice || 'AWS.Polly.Joanna-Neural'
        };
    }

    async connect(): Promise<void> {
        // No connection needed for REST API
        console.log(`✅ Telnyx TTS REST ready with voice: ${this.config.voice}`);
    }

    async synthesize(text: string): Promise<void> {
        try {
            console.log(`🗣️ Synthesizing with ${this.config.voice}: "${text}"`);

            // Call Telnyx REST API
            const response = await axios.post(
                'https://api.telnyx.com/v2/ai/generate/text_to_speech',
                {
                    text: text,
                    voice: this.config.voice,
                    output_format: 'mp3'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer'
                }
            );

            // Emit the complete MP3 audio
            const audioBuffer = Buffer.from(response.data);
            console.log(`🎵 TTS audio received: ${audioBuffer.length} bytes`);
            this.emit('audio', audioBuffer);
            this.emit('done');

        } catch (error: any) {
            console.error('❌ TTS REST API error:', error.response?.data || error.message);
            this.emit('error', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        // No cleanup needed for REST API
    }

    changeVoice(voice: string): void {
        this.config.voice = voice;
        console.log(`🔄 Voice changed to: ${voice}`);
    }
}
