/**
 * Call Orchestrator
 * Central coordinator for all call-related operations
 * Separates Telnyx telephony logic from AI conversation logic
 */

import { EventEmitter } from 'events';
import { SessionManager } from './SessionManager';
import { MediaRouter } from './MediaRouter';
import { TelnyxService } from '../services/telnyx.refactored';

export interface CallConfig {
    callId: string;
    callControlId: string;
    direction: 'inbound' | 'outbound';
    from: string;
    to: string;
    agentId?: string;
    knowledgeBaseId?: string;
}

export class CallOrchestrator extends EventEmitter {
    private sessionManager: SessionManager;
    private mediaRouter: MediaRouter;
    private telnyxService: TelnyxService;

    constructor(telnyxService: TelnyxService) {
        super();
        this.telnyxService = telnyxService;
        this.sessionManager = new SessionManager();
        this.mediaRouter = new MediaRouter();

        this.setupEventHandlers();
    }

    /**
     * Initialize a new call session
     */
    public async initializeCall(config: CallConfig): Promise<void> {
        console.log(`📞 Initializing call: ${config.callId}`);

        // Create session
        const session = await this.sessionManager.createSession({
            callId: config.callId,
            callControlId: config.callControlId,
            direction: config.direction,
            from: config.from,
            to: config.to,
            agentId: config.agentId,
            knowledgeBaseId: config.knowledgeBaseId,
            status: 'initializing',
            startedAt: new Date()
        });

        // Emit session created event
        this.emit('session:created', session);

        console.log(`✅ Call session created: ${config.callId}`);
    }

    /**
     * Handle inbound call
     */
    public async handleInboundCall(callControlId: string, from: string, to: string): Promise<void> {
        const callId = `call_${Date.now()}`;

        await this.initializeCall({
            callId,
            callControlId,
            direction: 'inbound',
            from,
            to
        });

        // Answer the call via Telnyx
        await this.telnyxService.answerCall(callControlId);

        // Update session status
        await this.sessionManager.updateSession(callId, { status: 'active' });

        this.emit('call:answered', { callId, callControlId });
    }

    /**
     * Handle outbound call
     */
    public async handleOutboundCall(to: string, from: string, agentId?: string): Promise<string> {
        const callId = `call_${Date.now()}`;

        // Make call via Telnyx
        const call = await this.telnyxService.makeCall(to, from);
        const callControlId = call.call_control_id;

        await this.initializeCall({
            callId,
            callControlId,
            direction: 'outbound',
            from,
            to,
            agentId
        });

        this.emit('call:initiated', { callId, callControlId });

        return callId;
    }

    /**
     * Start media streaming for a call
     */
    public async startMediaStreaming(callId: string): Promise<void> {
        const session = await this.sessionManager.getSession(callId);
        if (!session) {
            throw new Error(`Session not found: ${callId}`);
        }

        // Register media route
        await this.mediaRouter.registerRoute(callId, session.callControlId);

        // Start Telnyx media stream
        await this.telnyxService.startMediaStream(session.callControlId);

        this.emit('media:started', { callId });
    }

    /**
     * Start AI conversation for a call
     */
    public async startConversation(callId: string): Promise<void> {
        const session = await this.sessionManager.getSession(callId);
        if (!session) {
            throw new Error(`Session not found: ${callId}`);
        }

        // This will be handled by ConversationLoop
        // For now, just emit event
        this.emit('conversation:started', { callId });
    }

    /**
     * End a call
     */
    public async endCall(callId: string, reason?: string): Promise<void> {
        const session = await this.sessionManager.getSession(callId);
        if (!session) {
            console.warn(`Session not found for endCall: ${callId}`);
            return;
        }

        // Hangup via Telnyx
        await this.telnyxService.hangupCall(session.callControlId);

        // Cleanup media route
        await this.mediaRouter.unregisterRoute(callId);

        // Update session
        await this.sessionManager.updateSession(callId, {
            status: 'ended',
            endedAt: new Date(),
            endReason: reason
        });

        this.emit('call:ended', { callId, reason });
    }

    /**
     * Get call session
     */
    public async getSession(callId: string) {
        return this.sessionManager.getSession(callId);
    }

    /**
     * Get all active calls
     */
    public async getActiveCalls() {
        return this.sessionManager.getActiveSessions();
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        // Telnyx events
        this.telnyxService.on('call.initiated', async (payload: any) => {
            await this.handleInboundCall(
                payload.call_control_id,
                payload.from,
                payload.to
            );
        });

        this.telnyxService.on('call.answered', async (payload: any) => {
            const session = await this.sessionManager.getSessionByControlId(payload.call_control_id);
            if (session) {
                await this.startMediaStreaming(session.callId);
                await this.startConversation(session.callId);
            }
        });

        this.telnyxService.on('call.hangup', async (payload: any) => {
            const session = await this.sessionManager.getSessionByControlId(payload.call_control_id);
            if (session) {
                await this.endCall(session.callId, payload.hangup_cause);
            }
        });
    }
}
