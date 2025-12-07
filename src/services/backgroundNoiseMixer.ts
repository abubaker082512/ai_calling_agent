import { PassThrough } from 'stream';
import { createReadStream, existsSync } from 'fs';
import path from 'path';

export type BackgroundNoiseType = 'none' | 'office' | 'callcenter' | 'coffeeshop' | 'outdoor' | 'home' | 'car';

export interface BackgroundNoiseConfig {
    type: BackgroundNoiseType;
    level: number; // 0-100
}

/**
 * Background Noise Mixer Service
 * Mixes background ambient sounds with AI voice to make calls sound more realistic
 */
export class BackgroundNoiseMixer {
    private noiseType: BackgroundNoiseType;
    private noiseLevel: number;
    private backgroundAudio: Buffer | null = null;
    private backgroundPosition: number = 0;

    constructor(config: BackgroundNoiseConfig) {
        this.noiseType = config.type;
        this.noiseLevel = Math.max(0, Math.min(100, config.level)) / 100; // Normalize to 0-1

        if (this.noiseType !== 'none') {
            this.loadBackgroundAudio();
        }

        console.log(`🔊 Background noise mixer initialized: ${this.noiseType} at ${config.level}%`);
    }

    /**
     * Load background audio file
     */
    private loadBackgroundAudio(): void {
        try {
            const audioPath = this.getAudioPath(this.noiseType);

            if (!existsSync(audioPath)) {
                console.warn(`⚠️ Background audio not found: ${audioPath}`);
                console.warn(`   Generating synthetic noise instead`);
                this.generateSyntheticNoise();
                return;
            }

            // For now, generate synthetic noise
            // TODO: Load actual audio files when available
            this.generateSyntheticNoise();

        } catch (error) {
            console.error('❌ Error loading background audio:', error);
            this.noiseType = 'none';
        }
    }

    /**
     * Get path to background audio file
     */
    private getAudioPath(type: BackgroundNoiseType): string {
        const audioDir = path.join(__dirname, '../../public/audio/backgrounds');
        return path.join(audioDir, `${type}.wav`);
    }

    /**
     * Generate synthetic background noise
     */
    private generateSyntheticNoise(): void {
        // Generate 10 seconds of noise (16kHz, mono, 16-bit PCM)
        const sampleRate = 16000;
        const duration = 10; // seconds
        const numSamples = sampleRate * duration;

        this.backgroundAudio = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample

        for (let i = 0; i < numSamples; i++) {
            let sample = 0;

            switch (this.noiseType) {
                case 'office':
                    // Low-frequency hum + occasional clicks
                    sample = (Math.random() - 0.5) * 0.1;
                    if (Math.random() < 0.001) sample += (Math.random() - 0.5) * 0.3;
                    break;

                case 'callcenter':
                    // Multiple voices + keyboard typing
                    sample = (Math.random() - 0.5) * 0.15;
                    if (Math.random() < 0.002) sample += (Math.random() - 0.5) * 0.4;
                    break;

                case 'coffeeshop':
                    // Ambient chatter + coffee machine
                    sample = (Math.random() - 0.5) * 0.12;
                    if (Math.random() < 0.0015) sample += (Math.random() - 0.5) * 0.35;
                    break;

                case 'outdoor':
                    // Wind + birds + traffic
                    sample = (Math.random() - 0.5) * 0.08;
                    sample += Math.sin(i / 100) * 0.05; // Wind variation
                    break;

                case 'home':
                    // TV in background + occasional movement
                    sample = (Math.random() - 0.5) * 0.08;
                    if (Math.random() < 0.0005) sample += (Math.random() - 0.5) * 0.2;
                    break;

                case 'car':
                    // Engine hum + road noise
                    sample = Math.sin(i / 50) * 0.1; // Engine
                    sample += (Math.random() - 0.5) * 0.05; // Road noise
                    break;

                default:
                    sample = 0;
            }

            // Convert to 16-bit PCM
            const int16Sample = Math.max(-32768, Math.min(32767, sample * 32767));
            this.backgroundAudio.writeInt16LE(int16Sample, i * 2);
        }

        console.log(`✅ Generated ${duration}s of synthetic ${this.noiseType} noise`);
    }

    /**
     * Mix AI audio with background noise
     */
    mixAudio(aiAudio: Buffer): Buffer {
        if (this.noiseType === 'none' || this.noiseLevel === 0 || !this.backgroundAudio) {
            return aiAudio;
        }

        const mixed = Buffer.alloc(aiAudio.length);
        const numSamples = aiAudio.length / 2; // 16-bit = 2 bytes per sample

        for (let i = 0; i < numSamples; i++) {
            // Read AI sample
            const aiSample = aiAudio.readInt16LE(i * 2);

            // Read background sample (loop if needed)
            const bgIndex = (this.backgroundPosition + i) % (this.backgroundAudio.length / 2);
            const bgSample = this.backgroundAudio.readInt16LE(bgIndex * 2);

            // Mix: AI at (1 - noiseLevel), background at noiseLevel
            const mixedSample = Math.round(
                aiSample * (1 - this.noiseLevel) +
                bgSample * this.noiseLevel
            );

            // Clamp to 16-bit range
            const clampedSample = Math.max(-32768, Math.min(32767, mixedSample));
            mixed.writeInt16LE(clampedSample, i * 2);
        }

        // Update background position for next chunk
        this.backgroundPosition = (this.backgroundPosition + numSamples) % (this.backgroundAudio.length / 2);

        return mixed;
    }

    /**
     * Update noise configuration
     */
    updateConfig(config: Partial<BackgroundNoiseConfig>): void {
        if (config.type !== undefined && config.type !== this.noiseType) {
            this.noiseType = config.type;
            this.backgroundPosition = 0;
            if (this.noiseType !== 'none') {
                this.loadBackgroundAudio();
            }
        }

        if (config.level !== undefined) {
            this.noiseLevel = Math.max(0, Math.min(100, config.level)) / 100;
        }

        console.log(`🔊 Background noise updated: ${this.noiseType} at ${this.noiseLevel * 100}%`);
    }

    /**
     * Get current configuration
     */
    getConfig(): BackgroundNoiseConfig {
        return {
            type: this.noiseType,
            level: Math.round(this.noiseLevel * 100)
        };
    }

    /**
     * Reset background position
     */
    reset(): void {
        this.backgroundPosition = 0;
    }
}
