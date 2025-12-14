/**
 * Dialogue Manager
 * Decision logic for AI conversation flow
 * NO LLM yet - uses static responses and rule-based logic
 */

import { CallSessionState } from '../models/CallSession';

export interface DialogueInput {
    transcript: string;
    confidence: number;
    sessionState: CallSessionState;
    retryCount: number;
    confidenceFailures: number;
}

export type DialogueAction = 'SPEAK' | 'REPEAT' | 'ESCALATE' | 'END';

export interface DialogueOutput {
    action: DialogueAction;
    responseText: string;
    shouldUpdateState?: CallSessionState;
    incrementRetry?: boolean;
}

export class DialogueManager {
    private static readonly CONFIDENCE_THRESHOLD = 0.6;
    private static readonly MAX_RETRIES = 2;
    private static readonly MAX_CONFIDENCE_FAILURES = 3;

    /**
     * Static response templates
     */
    private static readonly RESPONSES = {
        greeting: "Hello! Thank you for calling. How can I help you today?",
        repeat: "I'm sorry, I didn't catch that. Could you please repeat?",
        lowConfidence: "I'm having trouble understanding. Could you speak more clearly?",
        escalate: "I understand you need assistance. Let me transfer you to a human agent who can better help you.",
        goodbye: "Thank you for calling. Have a great day!",
        error: "I apologize, but I'm experiencing technical difficulties. Let me transfer you to someone who can assist you.",

        // Intent-based responses (static for now)
        help: "I'm here to assist you. What can I help you with?",
        thanks: "You're welcome! Is there anything else I can help you with?",
        yes: "Great! How can I assist you further?",
        no: "Okay, is there anything else I can help you with?",
    };

    /**
     * Process user input and determine next action
     */
    public processInput(input: DialogueInput): DialogueOutput {
        console.log(`\n🧠 DialogueManager processing:`);
        console.log(`   Transcript: "${input.transcript}"`);
        console.log(`   Confidence: ${input.confidence}`);
        console.log(`   Retry Count: ${input.retryCount}`);
        console.log(`   Confidence Failures: ${input.confidenceFailures}`);

        // Check for escalation conditions first
        if (this.shouldEscalate(input)) {
            return this.createEscalateResponse();
        }

        // Check confidence threshold
        if (input.confidence < DialogueManager.CONFIDENCE_THRESHOLD) {
            return this.createRepeatResponse(input);
        }

        // Process based on intent (simple keyword matching for now)
        return this.processIntent(input);
    }

    /**
     * Check if we should escalate to human
     */
    private shouldEscalate(input: DialogueInput): boolean {
        // Escalate if too many retries
        if (input.retryCount >= DialogueManager.MAX_RETRIES) {
            console.log(`⚠️ Max retries reached (${input.retryCount})`);
            return true;
        }

        // Escalate if too many confidence failures
        if (input.confidenceFailures >= DialogueManager.MAX_CONFIDENCE_FAILURES) {
            console.log(`⚠️ Max confidence failures reached (${input.confidenceFailures})`);
            return true;
        }

        // Escalate if user explicitly requests human
        const transcript = input.transcript.toLowerCase();
        if (this.containsEscalationKeywords(transcript)) {
            console.log(`⚠️ Escalation keywords detected`);
            return true;
        }

        return false;
    }

    /**
     * Check for escalation keywords
     */
    private containsEscalationKeywords(transcript: string): boolean {
        const escalationKeywords = [
            'human', 'agent', 'representative', 'person',
            'speak to someone', 'talk to someone',
            'transfer', 'supervisor', 'manager'
        ];

        return escalationKeywords.some(keyword => transcript.includes(keyword));
    }

    /**
     * Create repeat response (low confidence)
     */
    private createRepeatResponse(input: DialogueInput): DialogueOutput {
        console.log(`🔄 Action: REPEAT (low confidence)`);

        return {
            action: 'REPEAT',
            responseText: DialogueManager.RESPONSES.lowConfidence,
            incrementRetry: true
        };
    }

    /**
     * Create escalate response
     */
    private createEscalateResponse(): DialogueOutput {
        console.log(`🚨 Action: ESCALATE`);

        return {
            action: 'ESCALATE',
            responseText: DialogueManager.RESPONSES.escalate,
            shouldUpdateState: CallSessionState.HUMAN_ESCALATED
        };
    }

    /**
     * Process intent and generate response
     * Simple keyword matching for now (will be replaced with LLM in Phase 3)
     */
    private processIntent(input: DialogueInput): DialogueOutput {
        const transcript = input.transcript.toLowerCase().trim();

        // Greeting detection
        if (this.isGreeting(transcript)) {
            console.log(`👋 Intent: GREETING`);
            return {
                action: 'SPEAK',
                responseText: DialogueManager.RESPONSES.greeting
            };
        }

        // Thanks detection
        if (this.isThanks(transcript)) {
            console.log(`🙏 Intent: THANKS`);
            return {
                action: 'SPEAK',
                responseText: DialogueManager.RESPONSES.thanks
            };
        }

        // Yes/No detection
        if (this.isYes(transcript)) {
            console.log(`✅ Intent: YES`);
            return {
                action: 'SPEAK',
                responseText: DialogueManager.RESPONSES.yes
            };
        }

        if (this.isNo(transcript)) {
            console.log(`❌ Intent: NO`);
            return {
                action: 'SPEAK',
                responseText: DialogueManager.RESPONSES.no
            };
        }

        // Goodbye detection
        if (this.isGoodbye(transcript)) {
            console.log(`👋 Intent: GOODBYE`);
            return {
                action: 'END',
                responseText: DialogueManager.RESPONSES.goodbye,
                shouldUpdateState: CallSessionState.ENDED
            };
        }

        // Default: ask for help
        console.log(`❓ Intent: UNKNOWN (default help)`);
        return {
            action: 'SPEAK',
            responseText: DialogueManager.RESPONSES.help
        };
    }

    /**
     * Intent detection helpers (simple keyword matching)
     */
    private isGreeting(text: string): boolean {
        const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
        return greetings.some(g => text.includes(g));
    }

    private isThanks(text: string): boolean {
        const thanks = ['thank', 'thanks', 'appreciate'];
        return thanks.some(t => text.includes(t));
    }

    private isYes(text: string): boolean {
        const yes = ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'correct', 'right'];
        return yes.some(y => text === y || text.startsWith(y + ' '));
    }

    private isNo(text: string): boolean {
        const no = ['no', 'nope', 'nah', 'not really'];
        return no.some(n => text === n || text.startsWith(n + ' '));
    }

    private isGoodbye(text: string): boolean {
        const goodbye = ['bye', 'goodbye', 'see you', 'have a good', 'take care'];
        return goodbye.some(g => text.includes(g));
    }

    /**
     * Get greeting message (for call start)
     */
    public static getGreeting(): string {
        return DialogueManager.RESPONSES.greeting;
    }

    /**
     * Get goodbye message
     */
    public static getGoodbye(): string {
        return DialogueManager.RESPONSES.goodbye;
    }

    /**
     * Get error message
     */
    public static getErrorMessage(): string {
        return DialogueManager.RESPONSES.error;
    }
}
