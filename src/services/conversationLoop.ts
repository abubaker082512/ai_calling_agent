import { DeepgramService, TranscriptResult } from './deepgramService';
import { ConversationEngine, ConversationContext } from './conversationEngine';
import { ConversationStateManager } from './conversationState';
import { TelnyxService } from './telnyx';
import { SupabaseService } from './supabase';
import EventEmitter from 'events';

export interface ConversationLoopConfig {
    callId: string;
    callControlId: string;
    callerPhone: string;
    purpose?: string;
    greeting?: string;
    callType?: 'phone' | 'browser';
    onSpeak?: (text: string) => Promise<void>;
}

export class ConversationLoop extends EventEmitter {
    private deepgram: DeepgramService;
    private conversationEngine: ConversationEngine;
    private stateManager: ConversationStateManager;
    private telnyx: TelnyxService;
    private supabase: SupabaseService;

    private callId: string;
    private callControlId: string;
    private isActive: boolean = false;
    private isAISpeaking: boolean = false;
    private interruptBuffer: string = '';
    private onSpeak?: (text: string) => Promise<void>;

    constructor(config: ConversationLoopConfig) {
        super();

        this.callId = config.callId;
        this.callControlId = config.callControlId;
        this.onSpeak = config.onSpeak;

        // Initialize services
        this.deepgram = new DeepgramService();
        this.conversationEngine = new ConversationEngine();
        this.stateManager = new ConversationStateManager();
        this.telnyx = new TelnyxService();
        this.supabase = new SupabaseService();

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
            if (this.callId.startsWith('browser_')) {
                console.log('🌐 Browser call detected - using linear16 PCM encoding');
                await this.deepgram.startStream({
                    encoding: 'linear16',
                    sampleRate: 16000 // 16kHz PCM from browser AudioContext
                });
            } else {
                console.log('📞 Phone call detected - using mulaw encoding');
                await this.deepgram.startStream();
            }

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
        if (!result.isFinal || !result.text.trim()) {
            return;
        }

        const userText = result.text.trim();
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
     * Speak text using Telnyx TTS or custom handler
     */
    private async speak(text: string): Promise<void> {
        try {
            this.isAISpeaking = true;
            console.log(`🗣️ AI speaking: "${text}"`);

            if (this.onSpeak) {
                await this.onSpeak(text);
            } else {
                await this.telnyx.speak(this.callControlId, text);
            }

            // Wait a bit for speech to complete
            // In production, listen for call.speak.ended webhook
            await new Promise(resolve => setTimeout(resolve, text.length * 50)); // Rough estimate

            this.isAISpeaking = false;
            this.emit('speech_complete');

        } catch (error) {
            console.error('❌ Error speaking:', error);
            this.isAISpeaking = false;
            throw error;
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

            // Close Deepgram connection
            await this.deepgram.close();

            // Get final conversation context
            const context = await this.stateManager.endSession(this.callId);

            // Save final conversation summary
            if (context) {
                await this.saveFinalSummary(context);
            }

            console.log('✅ Conversation loop stopped');
            this.emit('stopped');

        } catch (error) {
            console.error('❌ Error stopping conversation loop:', error);
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
}
