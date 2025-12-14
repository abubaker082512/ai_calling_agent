/**
 * Provider Factory
 * Creates provider instances based on configuration
 */

import { ASRProvider } from './ASRProvider';
import { LLMProvider } from './LLMProvider';
import { StorageProvider } from './StorageProvider';
import { DeepgramAdapter } from './adapters/DeepgramAdapter';
import { GeminiAdapter } from './adapters/GeminiAdapter';
import { SupabaseStorageAdapter } from './adapters/SupabaseStorageAdapter';

export class ProviderFactory {
    /**
     * Create ASR provider
     */
    static createASR(provider: 'deepgram' | string = 'deepgram'): ASRProvider {
        const apiKey = process.env.DEEPGRAM_API_KEY || '';

        switch (provider.toLowerCase()) {
            case 'deepgram':
                return new DeepgramAdapter({
                    apiKey,
                    language: 'en-US',
                    model: 'nova-2'
                });
            default:
                throw new Error(`Unknown ASR provider: ${provider}`);
        }
    }

    /**
     * Create LLM provider
     */
    static createLLM(provider: 'gemini' | 'openai' | string = 'gemini'): LLMProvider {
        switch (provider.toLowerCase()) {
            case 'gemini':
                return new GeminiAdapter({
                    apiKey: process.env.GEMINI_API_KEY || '',
                    model: 'gemini-1.5-flash',
                    temperature: 0.7,
                    maxTokens: 1000
                });
            case 'openai':
                // TODO: Implement OpenAI adapter
                throw new Error('OpenAI adapter not yet implemented');
            default:
                throw new Error(`Unknown LLM provider: ${provider}`);
        }
    }

    /**
     * Create Storage provider
     */
    static createStorage(provider: 'supabase' | 's3' | string = 'supabase'): StorageProvider {
        switch (provider.toLowerCase()) {
            case 'supabase':
                return new SupabaseStorageAdapter({
                    bucket: 'recordings',
                    region: 'us-east-1'
                });
            case 's3':
                // TODO: Implement S3 adapter
                throw new Error('S3 adapter not yet implemented');
            default:
                throw new Error(`Unknown storage provider: ${provider}`);
        }
    }
}

// Export all providers
export * from './ASRProvider';
export * from './LLMProvider';
export * from './StorageProvider';
export * from './adapters/DeepgramAdapter';
export * from './adapters/GeminiAdapter';
export * from './adapters/SupabaseStorageAdapter';
