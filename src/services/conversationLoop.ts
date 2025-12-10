import { DeepgramService, TranscriptResult } from './deepgramService';
import { ConversationEngine, ConversationContext } from './conversationEngine';
import { ConversationStateManager } from './conversationState';
import { TelnyxService } from './telnyx';
import { TelnyxTTSService } from './telnyxTTS';
import { SupabaseService } from './supabase';
import { BackgroundNoiseMixer, BackgroundNoiseType } from './backgroundNoiseMixer';
import EventEmitter from 'events';

export interface ConversationLoopConfig {
    callId: string;
    callControlId: string;
    callerPhone: string;
    purpose?: string;
    greeting?: string;
    callType?: 'phone' | 'browser';
    voice?: string; // TTS voice selection (e.g., 'AWS.Polly.Joanna-Neural')
    backgroundNoise?: BackgroundNoiseType; // Background noise environment
    noiseLevel?: number; // Noise level 0-100
    onSpeak?: (text: string) => Promise<void>;
}

export class ConversationLoop extends EventEmitter {
    private deepgram: DeepgramService;
    private conversationEngine: ConversationEngine;
    private stateManager: ConversationStateManager;
    private telnyx: TelnyxService;
    private tts: TelnyxTTSService;
    private supabase: SupabaseService;
    private noiseMixer?: BackgroundNoiseMixer;

    private callId: string;
    private callControlId: string;
    private callType: 'phone' | 'browser';
    private voice: string;
    private isActive: boolean = false;
    private isAISpeaking: boolean = false;
    private interruptBuffer: string = '';
    private onSpeak?: (text: string) => Promise<void>;

    constructor(config: ConversationLoopConfig) {
        super();

        this.callId = config.callId;
        this.callControlId = config.callControlId;
        this.callType = config.callType || 'phone';
        this.voice = config.voice || 'AWS.Polly.Joanna-Neural';
        this.onSpeak = config.onSpeak;

        // Initialize services
        this.deepgram = new DeepgramService();
        this.conversationEngine = new ConversationEngine();
        this.stateManager = new ConversationStateManager();
        this.telnyx = new TelnyxService();
        this.supabase = new SupabaseService();

        // Initialize TTS with Telnyx WebSocket (properly implemented)
        this.tts = new TelnyxTTSService(process.env.TELNYX_API_KEY!, {
            voice: this.voice
        });

        console.log(`🎙️ Telnyx WebSocket TTS initialized with voice: ${this.voice}`);

        // Initialize background noise mixer if enabled
        if (config.backgroundNoise && config.backgroundNoise !== 'none') {
            this.noiseMixer = new BackgroundNoiseMixer({
                type: config.backgroundNoise,
                level: config.noiseLevel || 10
            });
            console.log(`🔊 Background noise enabled: ${config.backgroundNoise}`);
        }

        this.setupEventHandlers();
    }

    /**
     * Set up event handlers for all services
     */
    private setupEventHandlers(): void {
        // Deepgram events
        this.deepgram.on('transcript', async (result: TranscriptResult) => {
            await this.handleTranscript(result);
        });

        this.deepgram.on('speech_start', () => {
            this.handleSpeechStart();
        });

        this.deepgram.on('error', (error) => {
            console.error('❌ Deepgram error in conversation loop:', error);
            this.emit('error', error);
        });

        // Conversation engine events
        this.conversationEngine.on('response', (data) => {
            console.log(`📊 AI response generated (${data.tokens} tokens)`);
        });

        this.conversationEngine.on('error', (error) => {
            console.error('❌ Conversation engine error:', error);
        });

        // TTS events
        this.tts.on('audio', (audioChunk: Buffer) => {
            console.log(`🎵 TTS audio received in ConversationLoop: ${audioChunk.length} bytes`);
            // Mix background noise if enabled
            let finalAudio = audioChunk;
            if (this.noiseMixer) {
                finalAudio = this.noiseMixer.mixAudio(audioChunk);
                console.log(`🔊 Audio mixed with background noise: ${finalAudio.length} bytes`);
            }

            // Emit audio for browser calls or send to phone
            if (this.callType === 'browser') {
                console.log(`📡 Emitting tts-audio event for browser: ${finalAudio.length} bytes`);
                this.emit('tts-audio', finalAudio);
            } else {
                // For phone calls, send audio to Telnyx
                // TODO: Implement phone audio streaming
            }
        });

        this.tts.on('done', () => {
            console.log('✅ TTS synthesis complete');
            this.isAISpeaking = false;
        });

        this.tts.on('error', (error) => {
            console.error('❌ TTS error:', error);
            this.isAISpeaking = false;
        });
    }

    /**
     * Start the conversation loop
     */
    async start(greeting?: string): Promise<void> {
        try {
            console.log(`🚀 Starting conversation loop for call ${this.callId}`);
            this.isActive = true;

            // Create conversation session
            const systemPrompt = ConversationEngine.createSystemPrompt('customer support');
            await this.stateManager.createSession(this.callId, systemPrompt, {
                callerPhone: this.callControlId,
                callPurpose: 'support'
            });

            // Start Deepgram stream with appropriate encoding
            // Browser calls use linear16 PCM, phone calls use mulaw
            if (this.callType === 'browser') {
                console.log('🌐 Browser call detected - using linear16 PCM encoding');
                await this.deepgram.startStream({
                    encoding: 'linear16',
                    sampleRate: 16000 // 16kHz PCM from browser AudioContext
                });
            } else {
                console.log('📞 Phone call detected - using mulaw encoding');
                await this.deepgram.startStream();
            }

            // Connect TTS for all calls (including browser)
            console.log(`🎤 Connecting Telnyx TTS with voice: ${this.voice || 'default'}`);
            await this.tts.connect();

            // Play greeting
            const greetingText = greeting || "Hello! I'm an AI assistant. How can I help you today?";
            await this.speak(greetingText);

            // Save greeting to conversation
            await this.stateManager.addMessage(this.callId, 'assistant', greetingText);

            console.log('✅ Conversation loop started successfully');
            this.emit('started');

        } catch (error) {
            console.error('❌ Failed to start conversation loop:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Handle incoming transcript from Deepgram
     */
    private async handleTranscript(result: TranscriptResult): Promise<void> {
        try {
            if (!result.isFinal || !result.text.trim()) {
                return;
            }

            const userText = result.text.trim();
            console.log(`👤 User said: "${userText}"`);

            // Broadcast user message to WebSocket clients
            this.broadcastMessage('human', userText, result.confidence);

            // Save user message
            await this.stateManager.addMessage(this.callId, 'user', userText);

            // Save to database
            await this.supabase.saveTranscript(this.callId, 'human', userText, result.confidence);

            // Get conversation context
            let context = await this.stateManager.getContext(this.callId);
            if (!context) {
                console.warn('⚠️ No conversation context found, creating new one');
                const systemPrompt = 'You are a helpful AI assistant speaking with a customer. Be concise and natural.';
                context = {
                    callId: this.callId,
                    systemPrompt: systemPrompt,
                    messages: [],
                    metadata: {
                        startTime: new Date(),
                        callerPhone: this.callControlId,
                        callPurpose: 'support'
                    }
                };
            }

            console.log(`🤖 Generating AI response for: "${userText}"`);
            const aiResponse = await this.conversationEngine.generateResponse(context, userText);
            console.log(`✅ AI response generated: "${aiResponse}"`);

            // Broadcast AI message to WebSocket clients
            this.broadcastMessage('ai', aiResponse, 1.0);

            // Save AI response
            await this.stateManager.addMessage(this.callId, 'assistant', aiResponse);
            await this.supabase.saveTranscript(this.callId, 'ai', aiResponse, 1.0);

            // Speak AI response
            await this.speak(aiResponse);

        } catch (error) {
            console.error('❌ Error in handleTranscript:', error);
            // Don't crash - try to respond with error message
            try {
                const errorMessage = "I apologize, I'm having trouble processing that. Could you please repeat?";
                this.broadcastMessage('ai', errorMessage, 1.0);
                await this.speak(errorMessage);
            } catch (fallbackError) {
                console.error('❌ Error in fallback response:', fallbackError);
            }
        }
    }

    /**
     * Broadcast message to WebSocket clients
     */
    private broadcastMessage(speaker: 'human' | 'ai', text: string, confidence: number): void {
        try {
            // Dynamically import to avoid circular dependency
            import('../index').then(module => {
                // Check if this is a browser call
                if (this.callId.startsWith('browser_')) {
                    if (module.broadcastToBrowserCall) {
                        module.broadcastToBrowserCall(this.callId, {
                            type: 'transcript',
                            data: {
                                speaker,
                                text,
                                timestamp: new Date().toISOString(),
                                confidence
                            }
                        });
                    }
                } else {
                    // Regular phone call
                    if (module.broadcastToLiveCall) {
                        module.broadcastToLiveCall(this.callId, {
                            type: 'transcript',
                            data: {
                                speaker,
                                text,
                                timestamp: new Date().toISOString(),
                                confidence
                            }
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Error broadcasting message:', error);
        }
    }

    /**
     * Handle speech start (for interrupt detection)
     */
    private handleSpeechStart(): void {
        if (this.isAISpeaking) {
            console.log('🛑 User interrupted AI - stopping playback');
            // TODO: Implement stop playback when Telnyx supports it
            this.isAISpeaking = false;
            this.emit('interrupted');
        }
    }

    /**
     * Speak text using Telnyx TTS
     */
    private async speak(text: string): Promise<void> {
        try {
            this.isAISpeaking = true;
            console.log(`🗣️ AI speaking: "${text}"`);
            console.log(`🔌 TTS connection status: ${this.tts ? 'connected' : 'not connected'}`);

            // Send text to browser/phone for display
            if (this.onSpeak) {
                console.log(`🗣️ Sending AI response text: "${text}"`);
                await this.onSpeak(text);
            }

            // Use Telnyx TTS for audio synthesis (all call types)
            console.log(`🎤 Calling TTS synthesize with voice: ${this.voice}`);
            await this.tts.synthesize(text);
            console.log(`✅ TTS synthesize call completed`);

            // Note: isAISpeaking will be set to false by TTS 'done' event

        } catch (error) {
            console.error('❌ Error speaking:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
            this.isAISpeaking = false;
            // Don't throw - just log and continue
        }
    }

    /**
     * Process incoming audio from call
     */
    async processAudio(audioData: Buffer): Promise<void> {
        if (!this.isActive) {
            return;
        }

        // Send audio to Deepgram for transcription
        this.deepgram.sendAudio(audioData);
    }

    /**
     * Stop the conversation loop
     */
    async stop(): Promise<void> {
        try {
            console.log(`🛑 Stopping conversation loop for call ${this.callId}`);
            this.isActive = false;

            // Close all connections
            console.log('🔌 Closing Deepgram connection...');
            await this.deepgram.close().catch(err => console.error('Error closing Deepgram:', err));

            console.log('🔌 Closing TTS connection...');
            await this.tts.stop().catch(err => console.error('Error closing TTS:', err));

            // Get final conversation context
            console.log('📝 Ending session...');
            const context = await this.stateManager.endSession(this.callId).catch(err => {
                console.error('Error ending session:', err);
                return null;
            });

            // Save final conversation summary
            if (context) {
                await this.saveFinalSummary(context);
            }

            // Remove all event listeners to prevent memory leaks
            this.deepgram.removeAllListeners();
            this.tts.removeAllListeners();
            this.conversationEngine.removeAllListeners();

            console.log('✅ Conversation loop stopped');
            this.emit('stopped');

        } catch (error) {
            console.error('❌ Error stopping conversation loop:', error);
            // Force cleanup even on error
            try {
                await this.deepgram.close().catch(() => { });
                await this.tts.stop().catch(() => { });
                this.deepgram.removeAllListeners();
                this.tts.removeAllListeners();
                this.conversationEngine.removeAllListeners();
            } catch (cleanupError) {
                console.error('❌ Error during force cleanup:', cleanupError);
            }
            this.emit('error', error);
        }
    }

    /**
     * Save final conversation summary
     */
    private async saveFinalSummary(context: ConversationContext): Promise<void> {
        try {
            const summary = {
                callId: this.callId,
                messageCount: context.messages.length,
                duration: Date.now() - context.metadata.startTime.getTime(),
                lastMessage: context.messages[context.messages.length - 1]?.content || ''
            };

            console.log('📝 Conversation summary:', summary);

            // TODO: Save summary to database
            // await this.supabase.saveCallSummary(this.callId, summary);

        } catch (error) {
            console.error('❌ Error saving conversation summary:', error);
        }
    }

    /**
     * Check if conversation is active
     */
    isConversationActive(): boolean {
        return this.isActive;
    }

    /**
     * Update background noise settings during call
     */
    updateNoiseSettings(type: BackgroundNoiseType, level: number): void {
        if (!this.noiseMixer) {
            // Create mixer if it doesn't exist
            this.noiseMixer = new BackgroundNoiseMixer({ type, level });
            console.log(`🔊 Background noise enabled: ${type} at ${level}%`);
        } else {
            // Update existing mixer
            this.noiseMixer.updateConfig({ type, level });
        }
    }

    /**
     * Get current noise settings
     */
    getNoiseSettings() {
        return this.noiseMixer?.getConfig() || { type: 'none' as BackgroundNoiseType, level: 0 };
    }
}
