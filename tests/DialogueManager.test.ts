/**
 * DialogueManager Unit Tests
 * Tests decision logic for AI conversation flow
 */

import { DialogueManager, DialogueInput } from '../src/managers/DialogueManager';
import { CallSessionState } from '../src/models/CallSession';

describe('DialogueManager', () => {
    let dialogueManager: DialogueManager;

    beforeEach(() => {
        dialogueManager = new DialogueManager();
    });

    describe('Confidence Threshold', () => {
        it('should REPEAT when confidence < 0.6', () => {
            const input: DialogueInput = {
                transcript: 'hello',
                confidence: 0.5,
                sessionState: CallSessionState.AI_ACTIVE,
                retryCount: 0,
                confidenceFailures: 0
            };

            const output = dialogueManager.processInput(input);

            expect(output.action).toBe('REPEAT');
            expect(output.incrementRetry).toBe(true);
        });

        it('should SPEAK when confidence >= 0.6', () => {
            const input: DialogueInput = {
                transcript: 'hello',
                confidence: 0.8,
                sessionState: CallSessionState.AI_ACTIVE,
                retryCount: 0,
                confidenceFailures: 0
            };

            const output = dialogueManager.processInput(input);

            expect(output.action).toBe('SPEAK');
        });
    });

    describe('Retry Logic', () => {
        it('should ESCALATE when retryCount >= 2', () => {
            const input: DialogueInput = {
                transcript: 'hello',
                confidence: 0.8,
                sessionState: CallSessionState.AI_ACTIVE,
                retryCount: 2,
                confidenceFailures: 0
            };

            const output = dialogueManager.processInput(input);

            expect(output.action).toBe('ESCALATE');
            expect(output.shouldUpdateState).toBe(CallSessionState.HUMAN_ESCALATED);
        });

        it('should ESCALATE when confidenceFailures >= 3', () => {
            const input: DialogueInput = {
                transcript: 'hello',
                confidence: 0.8,
                sessionState: CallSessionState.AI_ACTIVE,
                retryCount: 0,
                confidenceFailures: 3
            };

            const output = dialogueManager.processInput(input);

            expect(output.action).toBe('ESCALATE');
        });
    });

    describe('Intent Detection', () => {
        it('should detect greeting intent', () => {
            const input: DialogueInput = {
                transcript: 'hello',
                confidence: 0.9,
                sessionState: CallSessionState.AI_ACTIVE,
                retryCount: 0,
                confidenceFailures: 0
            };

            const output = dialogueManager.processInput(input);

            expect(output.action).toBe('SPEAK');
            expect(output.responseText).toContain('help');
        });

        it('should detect goodbye intent and END', () => {
            const input: DialogueInput = {
                transcript: 'goodbye',
                confidence: 0.9,
                sessionState: CallSessionState.AI_ACTIVE,
                retryCount: 0,
                confidenceFailures: 0
            };

            const output = dialogueManager.processInput(input);

            expect(output.action).toBe('END');
            expect(output.shouldUpdateState).toBe(CallSessionState.ENDED);
        });

        it('should detect escalation keywords', () => {
            const input: DialogueInput = {
                transcript: 'I want to speak to a human',
                confidence: 0.9,
                sessionState: CallSessionState.AI_ACTIVE,
                retryCount: 0,
                confidenceFailures: 0
            };

            const output = dialogueManager.processInput(input);

            expect(output.action).toBe('ESCALATE');
        });
    });

    describe('Static Responses', () => {
        it('should return greeting message', () => {
            const greeting = DialogueManager.getGreeting();
            expect(greeting).toBeTruthy();
            expect(typeof greeting).toBe('string');
        });

        it('should return goodbye message', () => {
            const goodbye = DialogueManager.getGoodbye();
            expect(goodbye).toBeTruthy();
            expect(typeof goodbye).toBe('string');
        });
    });
});
