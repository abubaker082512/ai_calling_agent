/**
 * LLM Provider Interface
 * Abstract interface for language model providers
 * Supports OpenAI-compatible APIs (OpenAI, Anthropic, Gemini, etc.)
 */

export interface LLMConfig {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    stop?: string[];
}

export interface ChatResponse {
    text: string;
    finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export type StreamCallback = (chunk: string, done: boolean) => void;

/**
 * Abstract LLM Provider
 */
export abstract class LLMProvider {
    protected config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    /**
     * Send chat completion request
     */
    abstract chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;

    /**
     * Stream chat completion
     */
    abstract stream(messages: Message[], callback: StreamCallback, options?: ChatOptions): Promise<void>;

    /**
     * Get provider name
     */
    abstract getProviderName(): string;

    /**
     * Health check
     */
    abstract healthCheck(): Promise<boolean>;

    /**
     * Count tokens (optional, provider-specific)
     */
    async countTokens(text: string): Promise<number> {
        // Simple approximation: ~4 chars per token
        return Math.ceil(text.length / 4);
    }
}
