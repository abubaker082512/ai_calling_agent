/**
 * Session Manager
 * Manages call session state and lifecycle
 * Stores session data in memory (will be migrated to Redis in STEP 3)
 */

export interface CallSession {
    callId: string;
    callControlId: string;
    direction: 'inbound' | 'outbound';
    from: string;
    to: string;
    agentId?: string;
    knowledgeBaseId?: string;
    status: 'initializing' | 'active' | 'on-hold' | 'ended';
    startedAt: Date;
    endedAt?: Date;
    endReason?: string;
    metadata?: Record<string, any>;
}

export class SessionManager {
    private sessions: Map<string, CallSession> = new Map();

    /**
     * Create a new call session
     */
    public async createSession(session: CallSession): Promise<CallSession> {
        this.sessions.set(session.callId, session);
        console.log(`📝 Session created: ${session.callId}`);
        return session;
    }

    /**
     * Get session by call ID
     */
    public async getSession(callId: string): Promise<CallSession | null> {
        return this.sessions.get(callId) || null;
    }

    /**
     * Get session by call control ID
     */
    public async getSessionByControlId(callControlId: string): Promise<CallSession | null> {
        for (const session of this.sessions.values()) {
            if (session.callControlId === callControlId) {
                return session;
            }
        }
        return null;
    }

    /**
     * Update session
     */
    public async updateSession(callId: string, updates: Partial<CallSession>): Promise<CallSession | null> {
        const session = this.sessions.get(callId);
        if (!session) {
            return null;
        }

        const updated = { ...session, ...updates };
        this.sessions.set(callId, updated);
        console.log(`📝 Session updated: ${callId}`);
        return updated;
    }

    /**
     * Delete session
     */
    public async deleteSession(callId: string): Promise<void> {
        this.sessions.delete(callId);
        console.log(`🗑️ Session deleted: ${callId}`);
    }

    /**
     * Get all active sessions
     */
    public async getActiveSessions(): Promise<CallSession[]> {
        const active: CallSession[] = [];
        for (const session of this.sessions.values()) {
            if (session.status === 'active') {
                active.push(session);
            }
        }
        return active;
    }

    /**
     * Get all sessions
     */
    public async getAllSessions(): Promise<CallSession[]> {
        return Array.from(this.sessions.values());
    }

    /**
     * Clear all sessions (for testing)
     */
    public async clearAll(): Promise<void> {
        this.sessions.clear();
        console.log(`🗑️ All sessions cleared`);
    }
}
