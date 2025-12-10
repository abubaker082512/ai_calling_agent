import axios from 'axios';
import { EventEmitter } from 'events';

export interface ElevenLabsTTSConfig {
    voice?: string;
    apiKey: string;
}

export class ElevenLabsTTSService extends EventEmitter {
    private apiKey: string;
    private voiceId: string;

    constructor(config: ElevenLabsTTSConfig) {
        super();
        this.apiKey = config.apiKey;
        // Default to a good voice - you can change this
        this.voiceId = config.voice || 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice
    }

    async connect(): Promise<void> {
        console.log('✅ ElevenLabs TTS service initialized');
        // No persistent connection needed
    }

    async synthesize(text: string): Promise<void> {
        console.log(`🗣️ Synthesizing with ElevenLabs: "${text}"`);

        try {
            const response = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
                {
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                },
                {
                    headers: {
                        'Accept': 'audio/mpeg',
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer'
                }
            );

            const audioBuffer = Buffer.from(response.data);
            console.log(`🎵 ElevenLabs audio received: ${audioBuffer.length} bytes`);

            // Emit the complete audio
            this.emit('audio', audioBuffer);
            this.emit('done');

        } catch (error) {
            console.error('❌ ElevenLabs TTS error:', error);
            this.emit('error', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        console.log('🛑 ElevenLabs TTS service stopped');
    }

    changeVoice(voiceId: string): void {
        this.voiceId = voiceId;
        console.log(`🔄 Voice changed to: ${voiceId}`);
    }
}
