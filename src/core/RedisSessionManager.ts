/**
 * Redis Session Manager
 * Replaces in-memory SessionManager with Redis-backed storage
 * Provides persistent, scalable session management
 */

import Redis from 'ioredis';
import { CallSession } from './SessionManager';

export class RedisSessionManager {
    private redis: Redis;
    private keyPrefix: string = 'session:';
    private indexPrefix: string = 'index:controlId:';

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

        this.redis.on('connect', () => {
            console.log('✅ Redis Session Manager connected');
        });

        this.redis.on('error', (error) => {
            console.error('❌ Redis Session Manager error:', error);
        });
    }

    /**
     * Create a new call session
     */
    public async createSession(session: CallSession): Promise<CallSession> {
        const key = this.keyPrefix + session.callId;
        const indexKey = this.indexPrefix + session.callControlId;

        // Store session
        await this.redis.setex(
            key,
            3600 * 24, // 24 hour TTL
            JSON.stringify(session)
        );

        // Create index for callControlId lookup
        await this.redis.setex(indexKey, 3600 * 24, session.callId);

        console.log(`📝 Redis session created: ${session.callId}`);
        return session;
    }

    /**
     * Get session by call ID
     */
    public async getSession(callId: string): Promise<CallSession | null> {
        const key = this.keyPrefix + callId;
        const data = await this.redis.get(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data);
    }

    /**
     * Get session by call control ID
     */
    public async getSessionByControlId(callControlId: string): Promise<CallSession | null> {
        const indexKey = this.indexPrefix + callControlId;
        const callId = await this.redis.get(indexKey);

        if (!callId) {
            return null;
        }

        return this.getSession(callId);
    }

    /**
     * Update session
     */
    public async updateSession(callId: string, updates: Partial<CallSession>): Promise<CallSession | null> {
        const session = await this.getSession(callId);
        if (!session) {
            return null;
        }

        const updated = { ...session, ...updates };
        const key = this.keyPrefix + callId;

        await this.redis.setex(
            key,
            3600 * 24,
            JSON.stringify(updated)
        );

        console.log(`📝 Redis session updated: ${callId}`);
        return updated;
    }

    /**
     * Delete session
     */
    public async deleteSession(callId: string): Promise<void> {
        const session = await this.getSession(callId);
        if (session) {
            const key = this.keyPrefix + callId;
            const indexKey = this.indexPrefix + session.callControlId;

            await this.redis.del(key);
            await this.redis.del(indexKey);

            console.log(`🗑️ Redis session deleted: ${callId}`);
        }
    }

    /**
     * Get all active sessions
     */
    public async getActiveSessions(): Promise<CallSession[]> {
        const pattern = this.keyPrefix + '*';
        const keys = await this.redis.keys(pattern);

        const sessions: CallSession[] = [];
        for (const key of keys) {
            const data = await this.redis.get(key);
            if (data) {
                const session = JSON.parse(data);
                if (session.status === 'active') {
                    sessions.push(session);
                }
            }
        }

        return sessions;
    }

    /**
     * Get all sessions
     */
    public async getAllSessions(): Promise<CallSession[]> {
        const pattern = this.keyPrefix + '*';
        const keys = await this.redis.keys(pattern);

        const sessions: CallSession[] = [];
        for (const key of keys) {
            const data = await this.redis.get(key);
            if (data) {
                sessions.push(JSON.parse(data));
            }
        }

        return sessions;
    }

    /**
     * Clear all sessions (for testing)
     */
    public async clearAll(): Promise<void> {
        const pattern = this.keyPrefix + '*';
        const keys = await this.redis.keys(pattern);

        if (keys.length > 0) {
            await this.redis.del(...keys);
        }

        const indexPattern = this.indexPrefix + '*';
        const indexKeys = await this.redis.keys(indexPattern);

        if (indexKeys.length > 0) {
            await this.redis.del(...indexKeys);
        }

        console.log(`🗑️ All Redis sessions cleared`);
    }

    /**
     * Close Redis connection
     */
    public async close(): Promise<void> {
        await this.redis.quit();
    }
}
