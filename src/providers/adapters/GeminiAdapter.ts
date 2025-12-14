/**
 * Gemini LLM Adapter
 * Implementation of LLMProvider for Google Gemini
 */

import { LLMProvider, LLMConfig, Message, ChatOptions, ChatResponse, StreamCallback } from '../LLMProvider';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiAdapter extends LLMProvider {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(config: LLMConfig) {
        super(config);
        this.genAI = new GoogleGenerativeAI(config.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config.model || 'gemini-1.5-flash'
        });
    }

    async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
        try {
            // Convert messages to Gemini format
            const contents = this.convertMessages(messages);

            // Generate content
            const result = await this.model.generateContent({
                contents,
                generationConfig: {
                    temperature: options?.temperature ?? this.config.temperature ?? 0.7,
                    maxOutputTokens: options?.maxTokens ?? this.config.maxTokens ?? 1000,
                    topP: options?.topP ?? this.config.topP ?? 0.95,
                }
            });

            const response = result.response;
            const text = response.text();

            return {
                text,
                finishReason: 'stop',
                usage: {
                    promptTokens: 0, // Gemini doesn't provide this
                    completionTokens: 0,
                    totalTokens: 0
                }
            };
        } catch (error: any) {
            console.error('Gemini chat error:', error);
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }

    async stream(messages: Message[], callback: StreamCallback, options?: ChatOptions): Promise<void> {
        try {
            const contents = this.convertMessages(messages);

            const result = await this.model.generateContentStream({
                contents,
                generationConfig: {
                    temperature: options?.temperature ?? this.config.temperature ?? 0.7,
                    maxOutputTokens: options?.maxTokens ?? this.config.maxTokens ?? 1000,
                    topP: options?.topP ?? this.config.topP ?? 0.95,
                }
            });

            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    callback(text, false);
                }
            }

            callback('', true); // Signal completion
        } catch (error: any) {
            console.error('Gemini stream error:', error);
            throw new Error(`Gemini streaming error: ${error.message}`);
        }
    }

    private convertMessages(messages: Message[]): any[] {
        // Gemini format: { role: 'user' | 'model', parts: [{ text: string }] }
        return messages
            .filter(m => m.role !== 'system') // System messages handled separately
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
    }

    getProviderName(): string {
        return 'Google Gemini';
    }

    async healthCheck(): Promise<boolean> {
        try {
            const result = await this.model.generateContent('test');
            return !!result;
        } catch (error) {
            return false;
        }
    }

    async countTokens(text: string): Promise<number> {
        try {
            const result = await this.model.countTokens(text);
            return result.totalTokens;
        } catch (error) {
            // Fallback to approximation
            return super.countTokens(text);
        }
    }
}
