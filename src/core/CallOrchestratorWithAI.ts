/**
 * Call Orchestrator with Full AI Voice Loop (Phase 2)
 * Integrates: STT → DialogueManager → TTS
 * Complete AI conversation flow
 */

import { EventEmitter } from 'events';
import { TelnyxCallService } from '../services/TelnyxCallService';
import { CallSessionManager } from '../managers/CallSessionManager';
import { TelnyxSTTService } from '../services/TelnyxSTTService';
import { TelnyxTTSService } from '../services/TelnyxTTSService';
import { DialogueManager, DialogueInput } from '../managers/DialogueManager';
import { CallSession, CallSessionState } from '../models/CallSession';
import { TranscriptEvent } from '../services/TelnyxSTTService';

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

const VOICE_LOOP_CONFIG = {
    MAX_SILENCE_MS: 5000,
    MAX_RETRIES: 2,
    CONFIDENCE_THRESHOLD: 0.6,
    GREETING_TEXT: "Hello! Thank you for calling. How can I help you today?"
};

export class CallOrchestratorWithAI extends EventEmitter {
    private telnyxService: TelnyxCallService;
    private sessionManager: CallSessionManager;
    private sttService: TelnyxSTTService;
    private ttsService: TelnyxTTSService;
    private dialogueManager: DialogueManager;

    private silenceTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        telnyxService: TelnyxCallService,
        sessionManager: CallSessionManager,
        sttService: TelnyxSTTService,
        ttsService: TelnyxTTSService
    ) {
        super();
        this.telnyxService = telnyxService;
        this.sessionManager = sessionManager;
        this.sttService = sttService;
        this.ttsService = ttsService;
        this.dialogueManager = new DialogueManager();

        // Listen to STT events
        this.setupSTTListeners();

        console.log('✅ CallOrchestratorWithAI initialized');
    }

    /**
     * Setup STT event listeners
     */
    private setupSTTListeners(): void {
        // Handle final transcripts
        this.sttService.on('final_transcript', async (event: TranscriptEvent) => {
            await this.handleTranscript(event);
        });

        // Handle partial transcripts (for silence detection)
        this.sttService.on('partial_transcript', (event: TranscriptEvent) => {
            this.resetSilenceTimer(event.callControlId);
        });
    }

    /**
     * Handle inbound call
     */
    public async handleInboundCall(params: InboundCallParams): Promise<void> {
        console.log(`📞 Handling inbound call: ${params.call_control_id}`);

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
     * Handle call answered - START AI VOICE LOOP
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

            // Start streaming
            await this.startStreaming(callControlId);

            // Start AI voice loop
            await this.startAIVoiceLoop(callControlId);

        } catch (error: any) {
            console.error(`❌ Error handling call answered:`, error);
        }
    }

    /**
     * Start AI Voice Loop
     */
    private async startAIVoiceLoop(callControlId: string): Promise<void> {
        console.log(`🤖 Starting AI voice loop: ${callControlId}`);

        try {
            // Speak greeting
            await this.ttsService.speak(
                callControlId,
                VOICE_LOOP_CONFIG.GREETING_TEXT
            );

            // Start silence timer
            this.startSilenceTimer(callControlId);

            console.log(`✅ AI voice loop started: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error starting AI voice loop:`, error);
        }
    }

    /**
     * Handle transcript from STT
     */
    private async handleTranscript(event: TranscriptEvent): Promise<void> {
        console.log(`\n📝 Transcript received: ${event.callControlId}`);
        console.log(`   Text: "${event.text}"`);
        console.log(`   Confidence: ${event.confidence}`);

        try {
            const session = await this.sessionManager.getSession(event.callControlId);
            if (!session) {
                console.warn(`⚠️ Session not found: ${event.callControlId}`);
                return;
            }

            // Reset silence timer
            this.resetSilenceTimer(event.callControlId);

            // Prepare dialogue input
            const dialogueInput: DialogueInput = {
                transcript: event.text,
                confidence: event.confidence,
                sessionState: session.state,
                retryCount: session.retry_count,
                confidenceFailures: session.confidence_failures
            };

            // Get dialogue decision
            const dialogueOutput = this.dialogueManager.processInput(dialogueInput);

            // Execute action
            await this.executeDialogueAction(event.callControlId, dialogueOutput, session);

        } catch (error: any) {
            console.error(`❌ Error handling transcript:`, error);
        }
    }

    /**
     * Execute dialogue action
     */
    private async executeDialogueAction(
        callControlId: string,
        output: any,
        session: CallSession
    ): Promise<void> {
        console.log(`\n🎬 Executing action: ${output.action}`);

        switch (output.action) {
            case 'SPEAK':
                await this.ttsService.speak(callControlId, output.responseText);
                this.startSilenceTimer(callControlId);
                break;

            case 'REPEAT':
                if (output.incrementRetry) {
                    await this.sessionManager.incrementRetry(callControlId);
                }
                await this.ttsService.speak(callControlId, output.responseText);
                this.startSilenceTimer(callControlId);
                break;

            case 'ESCALATE':
                await this.escalateToHuman(callControlId);
                break;

            case 'END':
                await this.ttsService.speak(callControlId, output.responseText);
                // Wait for speech to finish, then hangup
                setTimeout(async () => {
                    await this.telnyxService.hangupCall(callControlId);
                }, 3000);
                break;
        }

        // Update state if needed
        if (output.shouldUpdateState) {
            await this.sessionManager.updateState(callControlId, output.shouldUpdateState);
        }
    }

    /**
     * Start silence timer
     */
    private startSilenceTimer(callControlId: string): void {
        // Clear existing timer
        this.clearSilenceTimer(callControlId);

        // Start new timer
        const timer = setTimeout(async () => {
            console.log(`⏰ Silence timeout: ${callControlId}`);
            await this.handleSilenceTimeout(callControlId);
        }, VOICE_LOOP_CONFIG.MAX_SILENCE_MS);

        this.silenceTimers.set(callControlId, timer);
    }

    /**
     * Reset silence timer
     */
    private resetSilenceTimer(callControlId: string): void {
        this.clearSilenceTimer(callControlId);
        this.startSilenceTimer(callControlId);
    }

    /**
     * Clear silence timer
     */
    private clearSilenceTimer(callControlId: string): void {
        const timer = this.silenceTimers.get(callControlId);
        if (timer) {
            clearTimeout(timer);
            this.silenceTimers.delete(callControlId);
        }
    }

    /**
     * Handle silence timeout
     */
    private async handleSilenceTimeout(callControlId: string): Promise<void> {
        console.log(`🔇 Handling silence timeout: ${callControlId}`);

        try {
            await this.ttsService.speak(
                callControlId,
                "Are you still there? Please let me know if you need any assistance."
            );

            // Restart timer
            this.startSilenceTimer(callControlId);

        } catch (error: any) {
            console.error(`❌ Error handling silence timeout:`, error);
        }
    }

    /**
     * Start media streaming
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
            const streamUrl = `wss://${domain.replace('https://', '').replace('http://', '')}/media/stream?call_control_id=${callControlId}`;

            // Start Telnyx streaming
            await this.telnyxService.startStreaming(callControlId, streamUrl);

            // Update session state to AI_ACTIVE
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
     */
    public async stopStreaming(callControlId: string): Promise<void> {
        console.log(`🎵 Stopping streaming: ${callControlId}`);

        try {
            await this.telnyxService.stopStreaming(callControlId);

            // Stop STT
            if (this.sttService.isActive(callControlId)) {
                await this.sttService.stopTranscription(callControlId);
            }

            // Clear silence timer
            this.clearSilenceTimer(callControlId);

            this.emit('streaming:stopped', { call_control_id: callControlId });

            console.log(`✅ Streaming stopped: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error stopping streaming:`, error);
        }
    }

    /**
     * Handle call hangup
     */
    public async handleCallHangup(
        callControlId: string,
        hangupCause?: string,
        hangupSource?: string
    ): Promise<void> {
        console.log(`📴 Call hangup: ${callControlId}`);

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

            // Speak escalation message
            await this.ttsService.speak(
                callControlId,
                DialogueManager.getErrorMessage()
            );

            console.log(`✅ Call escalated: ${callControlId}`);

        } catch (error: any) {
            console.error(`❌ Error escalating call:`, error);
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
