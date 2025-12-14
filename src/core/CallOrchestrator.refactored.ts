/**
 * Call Orchestrator (Refactored for Phase 1.5)
 * Central coordinator for call lifecycle management
 * Owns: call lifecycle, streaming start/stop, future AI decisions
 */

import { EventEmitter } from 'events';
import { TelnyxCallService } from '../services/TelnyxCallService';
import { CallSessionManager } from '../managers/CallSessionManager';
import { CallSession, CallSessionState } from '../models/CallSession';

export interface InboundCallParams {
    call_control_id: string;
    call_session_id?: string;
    from: string;
    to: string;
}

export interface OutboundCallParams {
    to: string;
    from: string;
    agent_id?: string;
    campaign_id?: string;
}

export class CallOrchestrator extends EventEmitter {
    private telnyxService: TelnyxCallService;
    private sessionManager: CallSessionManager;

    constructor(telnyxService: TelnyxCallService, sessionManager: CallSessionManager) {
        super();
        this.telnyxService = telnyxService;
        this.sessionManager = sessionManager;

        console.log('✅ CallOrchestrator initialized');
    }

    /**
     * Handle inbound call (called from webhook)
     */
    public async handleInboundCall(params: InboundCallParams): Promise<void> {
        console.log(`📞 Handling inbound call: ${params.call_control_id}`);
        console.log(`   From: ${params.from} → To: ${params.to}`);

        try {
            // Create session
            const session = await this.sessionManager.createSession({
                call_control_id: params.call_control_id,
                call_session_id: params.call_session_id,
                from_number: params.from,
                to_number: params.to,
                direction: 'incoming'
            });

            this.emit('call:initiated', { session });

            // Answer the call
            await this.telnyxService.answerCall(params.call_control_id);

            console.log(`✅ Inbound call answered: ${params.call_control_id}`);

        } catch (error: any) {
            console.error(`❌ Error handling inbound call:`, error);
            this.emit('call:error', { call_control_id: params.call_control_id, error });
        }
    }

    /**
     * Handle call answered (called from webhook)
     */
    public async handleCallAnswered(callControlId: string): Promise<void> {
        console.log(`✅ Call answered: ${callControlId}`);

        try {
            // Update session state
            await this.sessionManager.updateState(callControlId, CallSessionState.ANSWERED);

            const session = await this.sessionManager.getSession(callControlId);
            if (!session) {
                console.warn(`⚠️ Session not found: ${callControlId}`);
                return;
            }

            this.emit('call:answered', { session });

            // Start streaming (ownership: CallOrchestrator decides when)
            await this.startStreaming(callControlId);

        } catch (error: any) {
            console.error(`❌ Error handling call answered:`, error);
        }
    }

    /**
     * Start media streaming
     * OWNERSHIP: CallOrchestrator owns when streaming starts
     */
    public async startStreaming(callControlId: string): Promise<void> {
        console.log(`🎵 Starting streaming: ${callControlId}`);

        try {
            const session = await this.sessionManager.getSession(callControlId);
            if (!session) {
                throw new Error(`Session not found: ${callControlId}`);
            }

            // Determine stream URL
            const domain = process.env.DOMAIN || 'http://localhost:3000';
            const streamUrl = `wss://${domain.replace('https://', '').replace('http://', '')}/media/stream`;

            // Start Telnyx streaming
            await this.telnyxService.startStreaming(callControlId, streamUrl);

            // Update session state to AI_ACTIVE (future: will trigger AI)
            await this.sessionManager.updateState(callControlId, CallSessionState.AI_ACTIVE);

            this.emit('streaming:started', { session, streamUrl });

            console.log(`✅ Streaming started: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error starting streaming:`, error);
            this.emit('streaming:error', { call_control_id: callControlId, error });
        }
    }

    /**
     * Stop media streaming
     * OWNERSHIP: CallOrchestrator owns when streaming stops
     */
    public async stopStreaming(callControlId: string): Promise<void> {
        console.log(`🎵 Stopping streaming: ${callControlId}`);

        try {
            await this.telnyxService.stopStreaming(callControlId);

            this.emit('streaming:stopped', { call_control_id: callControlId });

            console.log(`✅ Streaming stopped: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error stopping streaming:`, error);
        }
    }

    /**
     * Handle call hangup (called from webhook)
     */
    public async handleCallHangup(
        callControlId: string,
        hangupCause?: string,
        hangupSource?: string
    ): Promise<void> {
        console.log(`📴 Call hangup: ${callControlId}`);
        console.log(`   Cause: ${hangupCause}`);
        console.log(`   Source: ${hangupSource}`);

        try {
            const session = await this.sessionManager.getSession(callControlId);
            if (!session) {
                console.warn(`⚠️ Session not found: ${callControlId}`);
                return;
            }

            // Stop streaming if active
            if (session.state === CallSessionState.AI_ACTIVE) {
                await this.stopStreaming(callControlId);
            }

            // End session
            await this.sessionManager.endSession(callControlId);

            this.emit('call:ended', { session, hangupCause, hangupSource });

            console.log(`✅ Call ended: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error handling call hangup:`, error);
        }
    }

    /**
     * Handle outbound call
     */
    public async handleOutboundCall(params: OutboundCallParams): Promise<string> {
        console.log(`📞 Making outbound call: ${params.from} → ${params.to}`);

        try {
            // Make call via Telnyx
            const call = await this.telnyxService.makeCall(params.to, params.from);

            // Create session
            const session = await this.sessionManager.createSession({
                call_control_id: call.call_control_id,
                call_session_id: call.call_session_id,
                from_number: params.from,
                to_number: params.to,
                direction: 'outgoing',
                metadata: {
                    agent_id: params.agent_id,
                    campaign_id: params.campaign_id
                }
            });

            this.emit('call:initiated', { session });

            console.log(`✅ Outbound call initiated: ${call.call_control_id}`);

            return call.call_control_id;

        } catch (error: any) {
            console.error(`❌ Error making outbound call:`, error);
            throw error;
        }
    }

    /**
     * Handle ASR failure
     * OWNERSHIP: CallOrchestrator decides what to do on ASR failure
     */
    public async handleASRFailure(callControlId: string): Promise<void> {
        console.log(`⚠️ ASR failure: ${callControlId}`);

        try {
            const session = await this.sessionManager.getSession(callControlId);
            if (!session) {
                return;
            }

            // Increment confidence failure
            await this.sessionManager.incrementConfidenceFailure(callControlId);

            // Get updated session
            const updatedSession = await this.sessionManager.getSession(callControlId);
            if (!updatedSession) {
                return;
            }

            // Check if we should escalate
            if (updatedSession.confidence_failures >= 3) {
                console.log(`🚨 Escalating to human: ${callControlId}`);
                await this.escalateToHuman(callControlId);
            } else {
                // Retry
                console.log(`🔄 Retrying ASR: ${callControlId}`);
                await this.sessionManager.incrementRetry(callControlId);
                this.emit('asr:retry', { session: updatedSession });
            }

        } catch (error: any) {
            console.error(`❌ Error handling ASR failure:`, error);
        }
    }

    /**
     * Escalate to human agent
     */
    public async escalateToHuman(callControlId: string): Promise<void> {
        console.log(`🚨 Escalating to human: ${callControlId}`);

        try {
            // Update session state
            await this.sessionManager.updateState(callControlId, CallSessionState.HUMAN_ESCALATED);

            // Stop AI streaming
            await this.stopStreaming(callControlId);

            const session = await this.sessionManager.getSession(callControlId);
            this.emit('call:escalated', { session });

            // Future: Transfer to human agent queue
            // await this.telnyxService.transferCall(callControlId, humanAgentNumber);

            console.log(`✅ Call escalated: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error escalating call:`, error);
        }
    }

    /**
     * Get session
     */
    public async getSession(callControlId: string): Promise<CallSession | null> {
        return this.sessionManager.getSession(callControlId);
    }

    /**
     * Get all active calls
     */
    public async getActiveCalls(): Promise<CallSession[]> {
        return this.sessionManager.getActiveSessions();
    }
}
