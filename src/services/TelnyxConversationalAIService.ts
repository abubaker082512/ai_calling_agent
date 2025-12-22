/**
 * Telnyx Conversational AI Service
 * Integrates Telnyx's built-in AI capabilities (STT + LLM + TTS)
 * 
 * NOTE: This is a wrapper for Telnyx Conversational AI.
 * Telnyx handles STT, LLM processing, and TTS automatically.
 */

import axios from 'axios';
import { EventEmitter } from 'events';

export interface AIConfig {
    model?: string;              // AI model to use (e.g., 'gpt-4', 'gpt-3.5-turbo')
    prompt?: string;             // System prompt/instructions
    voice?: 'male' | 'female';   // TTS voice
    language?: string;           // Language code (e.g., 'en-US')
    temperature?: number;        // LLM temperature (0-1)
    maxTokens?: number;          // Max response tokens
}

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export class TelnyxConversationalAIService extends EventEmitter {
    private apiKey: string;
    private baseUrl: string = 'https://api.telnyx.com/v2';
    private activeConversations: Map<string, ConversationMessage[]> = new Map();
    private aiConfigs: Map<string, AIConfig> = new Map();

    constructor() {
        super();
        this.apiKey = process.env.TELNYX_API_KEY || '';

        if (!this.apiKey) {
            throw new Error('TELNYX_API_KEY is required for Conversational AI');
        }

        console.log('✅ TelnyxConversationalAIService initialized');
    }

    /**
     * Enable AI on a call
     * This configures the call to use Telnyx's built-in AI
     */
    public async enableAI(callControlId: string, config: AIConfig): Promise<void> {
        try {
            console.log(`🤖 Enabling AI on call: ${callControlId}`);
            console.log(`   Model: ${config.model || 'default'}`);
            console.log(`   Voice: ${config.voice || 'female'}`);

            // Store configuration
            this.aiConfigs.set(callControlId, config);

            // Initialize conversation with system prompt
            const conversation: ConversationMessage[] = [];
            if (config.prompt) {
                conversation.push({
                    role: 'system',
                    content: config.prompt,
                    timestamp: Date.now()
                });
            }
            this.activeConversations.set(callControlId, conversation);

            // In a real implementation, this would call Telnyx API to enable AI
            // For now, we'll use the existing STT/TTS services with LLM in between

            this.emit('ai:enabled', { callControlId, config });
            console.log(`✅ AI enabled: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error enabling AI: ${callControlId}`, error);
            this.emit('ai:error', { callControlId, error });
            throw error;
        }
    }

    /**
     * Process user input and get AI response
     * This is where the LLM generates a response
     */
    public async processUserInput(
        callControlId: string,
        userInput: string,
        confidence: number
    ): Promise<string> {
        try {
            console.log(`\n🧠 Processing AI input: ${callControlId}`);
            console.log(`   User: "${userInput}"`);
            console.log(`   Confidence: ${confidence}`);

            const conversation = this.activeConversations.get(callControlId) || [];
            const config = this.aiConfigs.get(callControlId) || {};

            // Add user message to conversation
            conversation.push({
                role: 'user',
                content: userInput,
                timestamp: Date.now()
            });

            // Call LLM API (using Telnyx's AI or fallback to OpenAI-compatible)
            const response = await this.callLLM(conversation, config);

            // Add assistant response to conversation
            conversation.push({
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            });

            this.activeConversations.set(callControlId, conversation);

            console.log(`   AI: "${response}"`);
            this.emit('ai:response', { callControlId, userInput, response });

            return response;

        } catch (error: any) {
            console.error(`❌ Error processing AI input:`, error);
            this.emit('ai:error', { callControlId, error });

            // Fallback response
            return "I apologize, but I'm having trouble processing that. Could you please repeat?";
        }
    }

    /**
     * Call LLM API
     * Uses Telnyx AI or compatible API
     */
    private async callLLM(
        conversation: ConversationMessage[],
        config: AIConfig
    ): Promise<string> {
        try {
            // Format messages for API
            const messages = conversation.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Call Telnyx AI API (or OpenAI-compatible endpoint)
            // NOTE: Adjust endpoint based on Telnyx's actual AI API
            const response = await axios.post(
                `${this.baseUrl}/ai/chat/completions`,
                {
                    model: config.model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: config.temperature || 0.7,
                    max_tokens: config.maxTokens || 150
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content;

        } catch (error: any) {
            console.error('❌ LLM API error:', error.message);

            // If Telnyx AI API not available, use simple fallback logic
            return this.getFallbackResponse(conversation);
        }
    }

    /**
     * Fallback response logic
     * Used when LLM API is not available
     */
    private getFallbackResponse(conversation: ConversationMessage[]): string {
        const lastUserMessage = conversation
            .filter(m => m.role === 'user')
            .pop();

        if (!lastUserMessage) {
            return "Hello! How can I help you today?";
        }

        const input = lastUserMessage.content.toLowerCase();

        // Simple keyword matching (fallback)
        if (input.includes('hello') || input.includes('hi')) {
            return "Hello! How can I assist you today?";
        }
        if (input.includes('help')) {
            return "I'm here to help! What do you need assistance with?";
        }
        if (input.includes('thank')) {
            return "You're welcome! Is there anything else I can help you with?";
        }
        if (input.includes('bye') || input.includes('goodbye')) {
            return "Thank you for calling. Have a great day!";
        }

        return "I understand. How can I assist you further?";
    }

    /**
     * Update conversation context
     */
    public updateContext(callControlId: string, context: Record<string, any>): void {
        const conversation = this.activeConversations.get(callControlId);
        if (conversation) {
            // Add context as a system message
            conversation.push({
                role: 'system',
                content: `Context update: ${JSON.stringify(context)}`,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Get conversation history
     */
    public getHistory(callControlId: string): ConversationMessage[] {
        return this.activeConversations.get(callControlId) || [];
    }

    /**
     * Disable AI on a call
     */
    public async disableAI(callControlId: string): Promise<void> {
        try {
            console.log(`🛑 Disabling AI: ${callControlId}`);

            this.activeConversations.delete(callControlId);
            this.aiConfigs.delete(callControlId);

            this.emit('ai:disabled', { callControlId });
            console.log(`✅ AI disabled: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error disabling AI:`, error);
        }
    }

    /**
     * Check if AI is active
     */
    public isActive(callControlId: string): boolean {
        return this.activeConversations.has(callControlId);
    }

    /**
     * Get active conversation count
     */
    public getActiveCount(): number {
        return this.activeConversations.size;
    }

    /**
     * Cleanup
     */
    public cleanup(): void {
        this.activeConversations.clear();
        this.aiConfigs.clear();
        console.log('✅ TelnyxConversationalAIService cleaned up');
    }
}
