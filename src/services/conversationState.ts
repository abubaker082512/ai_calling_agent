import { RedisService } from './redis';
import { ConversationContext, Message } from './conversationEngine';

export class ConversationStateManager {
    private redis: RedisService;
    private readonly TTL = 3600; // 1 hour session timeout
    private memoryStore: Map<string, ConversationContext> = new Map();

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
    async getContext(callId: string): Promise<ConversationContext | null> {
        try {
            const data = await this.redis.get(`conversation:${callId}`);

            if (!data) {
                // Fallback to memory store
                return this.memoryStore.get(callId) || null;
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
            console.warn(`⚠️ Redis error getting context for ${callId}, using memory store:`, error);
            return this.memoryStore.get(callId) || null;
        }
    }

    /**
     * Save conversation context
     */
    async saveContext(callId: string, context: ConversationContext): Promise<void> {
        // Always save to memory store as backup
        this.memoryStore.set(callId, context);

        try {
            await this.redis.set(
                `conversation:${callId}`,
                JSON.stringify(context),
                this.TTL
            );
        } catch (error) {
            console.warn(`⚠️ Redis error saving context for ${callId}, using memory store:`, error);
        }
    }

    /**
     * Add message to conversation
     */
    async addMessage(callId: string, role: 'user' | 'assistant', content: string): Promise<void> {
        const context = await this.getContext(callId);

        if (!context) {
            console.error(`❌ No conversation context found for ${callId}`);
            return;
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
            try {
                await this.redis.del(`conversation:${callId}`);
            } catch (error) {
                console.warn(`⚠️ Redis error deleting context for ${callId}:`, error);
            }

            // Delete from memory
            this.memoryStore.delete(callId);

            console.log(`✅ Ended conversation session: ${callId}`);
        }

        return context;
    }

    /**
     * Get active sessions count
     */
    async getActiveSessionsCount(): Promise<number> {
        try {
            const keys = await this.redis.keys('conversation:*');
            return keys.length;
        } catch (error) {
            console.warn('⚠️ Redis error getting keys, returning memory store size:', error);
            return this.memoryStore.size;
        }
    }

    /**
     * Clean up expired sessions (called periodically)
     */
    async cleanup(): Promise<void> {
        // Redis TTL handles this automatically for Redis
        // For memory store, we could implement cleanup logic here if needed
        // For now, we'll rely on server restarts or manual cleanup
        const now = new Date().getTime();
        for (const [key, context] of this.memoryStore.entries()) {
            if (now - context.metadata.startTime.getTime() > this.TTL * 1000) {
                this.memoryStore.delete(key);
            }
        }
        console.log('🧹 Conversation cleanup completed');
    }
}
