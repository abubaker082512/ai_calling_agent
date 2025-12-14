/**
 * CallSessionManager
 * Manages call session lifecycle in Redis
 * Handles state transitions, retries, and TTL-based expiration
 */

import Redis from 'ioredis';
import { CallSession, CallSessionState, CallSessionUpdate } from '../models/CallSession';
import { v4 as uuidv4 } from 'uuid';

export class CallSessionManager {
    private redis: Redis;
    private keyPrefix: string = 'call:session:';
    private indexPrefix: string = 'call:index:';
    private defaultTTL: number = 3600; // 1 hour

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

        this.redis.on('connect', () => {
            console.log('✅ CallSessionManager connected to Redis');
        });

        this.redis.on('error', (error) => {
            console.error('❌ CallSessionManager Redis error:', error);
        });
    }

    /**
     * Create a new call session
     */
    public async createSession(params: {
        call_control_id: string;
        call_session_id?: string;
        from_number: string;
        to_number: string;
        direction: 'incoming' | 'outgoing';
        metadata?: Record<string, any>;
    }): Promise<CallSession> {
        const session: CallSession = {
            session_id: uuidv4(),
            call_control_id: params.call_control_id,
            call_session_id: params.call_session_id,
            from_number: params.from_number,
            to_number: params.to_number,
            direction: params.direction,
            state: CallSessionState.INIT,
            retry_count: 0,
            confidence_failures: 0,
            created_at: new Date(),
            last_activity_at: new Date(),
            metadata: params.metadata || {}
        };

        // Store session
        const sessionKey = this.keyPrefix + session.session_id;
        await this.redis.setex(
            sessionKey,
            this.defaultTTL,
            JSON.stringify(session)
        );

        // Create index for call_control_id lookup
        const indexKey = this.indexPrefix + params.call_control_id;
        await this.redis.setex(indexKey, this.defaultTTL, session.session_id);

        console.log(`✅ CallSession created: ${session.session_id} (${params.call_control_id})`);
        console.log(`   State: ${session.state}`);
        console.log(`   Direction: ${session.direction}`);

        return session;
    }

    /**
     * Get session by call_control_id
     */
    public async getSession(callControlId: string): Promise<CallSession | null> {
        // Lookup session_id from index
        const indexKey = this.indexPrefix + callControlId;
        const sessionId = await this.redis.get(indexKey);

        if (!sessionId) {
            return null;
        }

        // Get session data
        const sessionKey = this.keyPrefix + sessionId;
        const data = await this.redis.get(sessionKey);

        if (!data) {
            return null;
        }

        const session = JSON.parse(data);

        // Convert date strings back to Date objects
        session.created_at = new Date(session.created_at);
        session.last_activity_at = new Date(session.last_activity_at);

        return session;
    }

    /**
     * Get session by session_id
     */
    public async getSessionById(sessionId: string): Promise<CallSession | null> {
        const sessionKey = this.keyPrefix + sessionId;
        const data = await this.redis.get(sessionKey);

        if (!data) {
            return null;
        }

        const session = JSON.parse(data);
        session.created_at = new Date(session.created_at);
        session.last_activity_at = new Date(session.last_activity_at);

        return session;
    }

    /**
     * Update session state
     */
    public async updateState(
        callControlId: string,
        newState: CallSessionState
    ): Promise<CallSession | null> {
        const session = await this.getSession(callControlId);
        if (!session) {
            console.warn(`⚠️ Session not found for updateState: ${callControlId}`);
            return null;
        }

        // Validate state transition
        if (!this.isValidStateTransition(session.state, newState)) {
            console.warn(`⚠️ Invalid state transition: ${session.state} → ${newState}`);
            return null;
        }

        session.state = newState;
        session.last_activity_at = new Date();

        await this.saveSession(session);

        console.log(`✅ Session state updated: ${callControlId}`);
        console.log(`   ${session.state} → ${newState}`);

        return session;
    }

    /**
     * Increment retry count
     */
    public async incrementRetry(callControlId: string): Promise<CallSession | null> {
        const session = await this.getSession(callControlId);
        if (!session) {
            return null;
        }

        session.retry_count++;
        session.last_activity_at = new Date();

        await this.saveSession(session);

        console.log(`🔄 Retry count incremented: ${callControlId} (${session.retry_count})`);

        return session;
    }

    /**
     * Increment confidence failure count
     */
    public async incrementConfidenceFailure(callControlId: string): Promise<CallSession | null> {
        const session = await this.getSession(callControlId);
        if (!session) {
            return null;
        }

        session.confidence_failures++;
        session.last_activity_at = new Date();

        await this.saveSession(session);

        console.log(`⚠️ Confidence failure incremented: ${callControlId} (${session.confidence_failures})`);

        return session;
    }

    /**
     * Update session with partial data
     */
    public async updateSession(
        callControlId: string,
        updates: CallSessionUpdate
    ): Promise<CallSession | null> {
        const session = await this.getSession(callControlId);
        if (!session) {
            return null;
        }

        // Apply updates
        if (updates.state !== undefined) {
            if (!this.isValidStateTransition(session.state, updates.state)) {
                console.warn(`⚠️ Invalid state transition: ${session.state} → ${updates.state}`);
                return null;
            }
            session.state = updates.state;
        }

        if (updates.retry_count !== undefined) {
            session.retry_count = updates.retry_count;
        }

        if (updates.confidence_failures !== undefined) {
            session.confidence_failures = updates.confidence_failures;
        }

        if (updates.metadata) {
            session.metadata = { ...session.metadata, ...updates.metadata };
        }

        session.last_activity_at = updates.last_activity_at || new Date();

        await this.saveSession(session);

        return session;
    }

    /**
     * End session
     */
    public async endSession(callControlId: string): Promise<void> {
        const session = await this.getSession(callControlId);
        if (!session) {
            return;
        }

        session.state = CallSessionState.ENDED;
        session.last_activity_at = new Date();

        await this.saveSession(session);

        console.log(`✅ Session ended: ${callControlId}`);

        // Optionally delete session after a short TTL
        const sessionKey = this.keyPrefix + session.session_id;
        await this.redis.expire(sessionKey, 300); // 5 minutes
    }

    /**
     * Delete session immediately
     */
    public async deleteSession(callControlId: string): Promise<void> {
        const session = await this.getSession(callControlId);
        if (!session) {
            return;
        }

        const sessionKey = this.keyPrefix + session.session_id;
        const indexKey = this.indexPrefix + callControlId;

        await this.redis.del(sessionKey);
        await this.redis.del(indexKey);

        console.log(`🗑️ Session deleted: ${callControlId}`);
    }

    /**
     * Save session to Redis
     */
    private async saveSession(session: CallSession): Promise<void> {
        const sessionKey = this.keyPrefix + session.session_id;
        await this.redis.setex(
            sessionKey,
            this.defaultTTL,
            JSON.stringify(session)
        );

        // Update index TTL
        const indexKey = this.indexPrefix + session.call_control_id;
        await this.redis.expire(indexKey, this.defaultTTL);
    }

    /**
     * Validate state transition
     */
    private isValidStateTransition(
        currentState: CallSessionState,
        newState: CallSessionState
    ): boolean {
        const validTransitions: Record<CallSessionState, CallSessionState[]> = {
            [CallSessionState.INIT]: [
                CallSessionState.ANSWERED,
                CallSessionState.ENDED
            ],
            [CallSessionState.ANSWERED]: [
                CallSessionState.AI_ACTIVE,
                CallSessionState.HUMAN_ESCALATED,
                CallSessionState.ENDED
            ],
            [CallSessionState.AI_ACTIVE]: [
                CallSessionState.HUMAN_ESCALATED,
                CallSessionState.ENDED
            ],
            [CallSessionState.HUMAN_ESCALATED]: [
                CallSessionState.ENDED
            ],
            [CallSessionState.ENDED]: []
        };

        return validTransitions[currentState]?.includes(newState) || false;
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
                session.created_at = new Date(session.created_at);
                session.last_activity_at = new Date(session.last_activity_at);

                if (session.state !== CallSessionState.ENDED) {
                    sessions.push(session);
                }
            }
        }

        return sessions;
    }

    /**
     * Close Redis connection
     */
    public async close(): Promise<void> {
        await this.redis.quit();
    }
}
