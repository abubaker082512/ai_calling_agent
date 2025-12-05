import { RedisService } from './redis';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

export interface ConversationContext {
    callId: string;
    messages: Message[];
    systemPrompt: string;
    metadata: {
        startTime: Date;
        callerPhone?: string;
        callPurpose?: string;
        [key: string]: any;
    };
}

export class ConversationStateManager {
    private redis: RedisService;
    private readonly TTL = 3600; // 1 hour session timeout
    private memoryCache: Map<string, ConversationContext> = new Map(); // In-memory fallback
    private useMemoryFallback: boolean = false;

    constructor() {
        this.redis = new RedisService();
    }

    /**
     * Initialize a new conversation session
     */
    async createSession(callId: string, systemPrompt: string, metadata: any): Promise<ConversationContext> {
        const context: ConversationContext = {
            callId,
            messages: [],
            systemPrompt,
            metadata: {
                ...metadata,
                startTime: new Date()
            }
        };

        await this.saveContext(callId, context);
        console.log(`✅ Created conversation session: ${callId}`);

        return context;
    }

    /**
     * Get conversation context
     */
    /**
     * Get conversation context
     */
    async getContext(callId: string): Promise<ConversationContext | null> {
        // Try memory cache first if Redis is discouraged or unavailable
        if (this.useMemoryFallback) {
            return this.memoryCache.get(callId) || null;
        }

        try {
            const data = await this.redis.get(`conversation:${callId}`);

            if (!data) {
                // Not in Redis, check memory just in case
                return this.memoryCache.get(callId) || null;
            }

            const context = JSON.parse(data);

            // Convert date strings back to Date objects
            context.metadata.startTime = new Date(context.metadata.startTime);
            context.messages.forEach((m: Message) => {
                if (m.timestamp) {
                    m.timestamp = new Date(m.timestamp);
                }
            });

            return context;
        } catch (error) {
            console.warn(`⚠️ Redis error (switching to memory): ${error instanceof Error ? error.message : String(error)}`);
            this.useMemoryFallback = true;
            return this.memoryCache.get(callId) || null;
        }
    }

    /**
     * Save conversation context
     */
    async saveContext(callId: string, context: ConversationContext): Promise<void> {
        // Always save to memory cache
        this.memoryCache.set(callId, context);

        // Try to save to Redis if available
        if (!this.useMemoryFallback) {
            try {
                await this.redis.set(
                    `conversation:${callId}`,
                    JSON.stringify(context),
                    this.TTL
                );
            } catch (error) {
                console.warn(`⚠️ Redis save failed (switching to memory): ${error instanceof Error ? error.message : String(error)}`);
                this.useMemoryFallback = true;
            }
        }
    }

    /**
     * Add message to conversation
     */
    async addMessage(callId: string, role: 'user' | 'assistant', content: string): Promise<void> {
        let context = await this.getContext(callId);

        if (!context) {
            console.warn(`⚠️ No conversation context found for ${callId}, creating new context`);
            // Create a minimal context on-the-fly
            context = {
                callId,
                messages: [],
                systemPrompt: "You are a helpful AI assistant.",
                metadata: {
                    startTime: new Date(),
                    callerPhone: 'unknown',
                    callPurpose: 'browser-test'
                }
            };
        }

        const message: Message = {
            role,
            content,
            timestamp: new Date()
        };

        context.messages.push(message);

        // Keep only last 20 messages to manage memory
        if (context.messages.length > 20) {
            context.messages = context.messages.slice(-20);
        }

        await this.saveContext(callId, context);
    }

    /**
     * Get conversation history
     */
    async getHistory(callId: string): Promise<Message[]> {
        const context = await this.getContext(callId);
        return context?.messages || [];
    }

    /**
     * Update metadata
     */
    async updateMetadata(callId: string, metadata: Partial<any>): Promise<void> {
        const context = await this.getContext(callId);

        if (!context) {
            console.error(`❌ No conversation context found for ${callId}`);
            return;
        }

        context.metadata = {
            ...context.metadata,
            ...metadata
        };

        await this.saveContext(callId, context);
    }

    /**
     * End conversation session
     */
    async endSession(callId: string): Promise<ConversationContext | null> {
        const context = await this.getContext(callId);

        if (context) {
            // Delete from Redis
            await this.redis.del(`conversation:${callId}`);
            console.log(`✅ Ended conversation session: ${callId}`);
        }

        return context;
    }

    /**
     * Get active sessions count
     */
    async getActiveSessionsCount(): Promise<number> {
        const keys = await this.redis.keys('conversation:*');
        return keys.length;
    }

    /**
     * Clean up expired sessions (called periodically)
     */
    async cleanup(): Promise<void> {
        // Redis TTL handles this automatically
        console.log('🧹 Conversation cleanup completed (handled by Redis TTL)');
    }
}
