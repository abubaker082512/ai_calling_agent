/**
 * CallSession Model
 * Redis-backed session state for call lifecycle management
 * Tracks call state, retries, and confidence failures
 */

export enum CallSessionState {
    INIT = 'INIT',
    ANSWERED = 'ANSWERED',
    AI_ACTIVE = 'AI_ACTIVE',
    HUMAN_ESCALATED = 'HUMAN_ESCALATED',
    ENDED = 'ENDED'
}

export interface CallSession {
    session_id: string;
    call_control_id: string;
    call_session_id?: string;
    from_number: string;
    to_number: string;
    direction: 'incoming' | 'outgoing';
    state: CallSessionState;
    retry_count: number;
    confidence_failures: number;
    created_at: Date;
    last_activity_at: Date;
    metadata?: {
        agent_id?: string;
        campaign_id?: string;
        [key: string]: any;
    };
}

export interface CallSessionUpdate {
    state?: CallSessionState;
    retry_count?: number;
    confidence_failures?: number;
    last_activity_at?: Date;
    metadata?: Record<string, any>;
}
