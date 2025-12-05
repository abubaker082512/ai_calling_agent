import { DeepgramService, TranscriptResult } from './deepgramService';
import { ConversationEngine } from './conversationEngine';
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
    onSpeak?: (text: string) => Promise<void>;
    callType?: 'browser' | 'phone';
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
    private callType: 'browser' | 'phone';
    private onSpeak?: (text: string) => Promise<void>;

    constructor(config: ConversationLoopConfig) {
        super();

        this.callId = config.callId;
        this.callControlId = config.callControlId;
        this.onSpeak = config.onSpeak;
        this.callType = config.callType || 'phone';

        // Initialize services
        this.deepgram = new DeepgramService();
        this.conversationEngine = new ConversationEngine();
        this.stateManager = new ConversationStateManager();
        this.telnyx = new TelnyxService();
        this.supabase = new SupabaseService();

        this.setupEventHandlers();
    }

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

    async start(greeting?: string): Promise<void> {
        try {
            console.log(`🚀 Starting conversation loop for call ${this.callId} (${this.callType})`);
            this.isActive = true;

            // Create conversation session
            const systemPrompt = ConversationEngine.createSystemPrompt('customer support');
            await this.stateManager.createSession(this.callId, systemPrompt, {
                callerPhone: this.callControlId,
                callPurpose: 'support'
            });

            // Start Deepgram stream with appropriate encoding
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

    private async handleTranscript(result: TranscriptResult): Promise<void> {
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

        // Generate AI response
        const context = await this.stateManager.getContext(this.callId);
        if (!context) {
            console.error('❌ No conversation context found');
            return;
        }

        let fullResponse = '';
        let sentenceBuffer = '';
        this.isAISpeaking = true;

        try {
            await this.conversationEngine.generateStreamingResponse(context, userText, (chunk: string) => {
                fullResponse += chunk;
                sentenceBuffer += chunk;

                if (sentenceBuffer.match(/[.!?]+["']?\s*$/)) {
                    const sentence = sentenceBuffer.trim();
                    if (sentence.length > 0) {
                        console.log(`🗣️ Speaking sentence chunk: "${sentence}"`);
                        this.speak(sentence).catch(err => console.error('Error speaking chunk:', err));
                    }
                    sentenceBuffer = '';
                }
            });

            if (sentenceBuffer.trim().length > 0) {
                const sentence = sentenceBuffer.trim();
                console.log(`🗣️ Speaking final chunk: "${sentence}"`);
                await this.speak(sentence);
            }

        } catch (error) {
            console.error('Error in streaming response:', error);
            this.isAISpeaking = false;
        }

        this.broadcastMessage('ai', fullResponse, 1.0);

        await this.stateManager.addMessage(this.callId, 'assistant', fullResponse);
        await this.supabase.saveTranscript(this.callId, 'ai', fullResponse, 1.0);
    }

    private broadcastMessage(speaker: 'human' | 'ai', text: string, confidence: number): void {
        try {
            import('../index').then(module => {
                if (this.callType === 'browser') {
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

    private handleSpeechStart(): void {
        if (this.isAISpeaking) {
            console.log('🛑 User interrupted AI - stopping playback');
            this.isAISpeaking = false;
            this.emit('interrupted');
        }
    }

    private async speak(text: string): Promise<void> {
        try {
            this.isAISpeaking = true;
            console.log(`🗣️ AI speaking: "${text}"`);

            if (this.onSpeak) {
                await this.onSpeak(text);
            } else {
                await this.telnyx.speak(this.callControlId, text);
            }

            // Simple delay to prevent overlap if we don't have exact timing
            await new Promise(resolve => setTimeout(resolve, text.length * 50));

            this.isAISpeaking = false;
            this.emit('speech_complete');

        } catch (error) {
            console.error('❌ Error speaking:', error);
            this.isAISpeaking = false;
            throw error;
        }
    }

    async processAudio(audioData: Buffer): Promise<void> {
        if (!this.isActive) {
            return;
        }
        this.deepgram.sendAudio(audioData);
    }

    async stop(): Promise<void> {
        try {
            console.log(`🛑 Stopping conversation loop for call ${this.callId}`);
            this.isActive = false;
            await this.deepgram.close();
            this.removeAllListeners();
            this.emit('stopped');
        } catch (error) {
            console.error('Error stopping conversation loop:', error);
        }
    }
}
