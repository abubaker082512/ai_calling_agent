import { GoogleGenerativeAI } from '@google/generative-ai';
import EventEmitter from 'events';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

export interface ConversationContext {
    callId: string;
    messages: Message[];
    systemPrompt: string;
    metadata: {
        callerPhone?: string;
        callPurpose: string;
        startTime: Date;
    };
}

export class ConversationEngine extends EventEmitter {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private modelName: string;

    constructor() {
        super();

        const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('❌ GEMINI_API_KEY is missing');
            throw new Error('GEMINI_API_KEY is required');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = process.env.GEMINI_MODEL || 'gemini-pro';
        this.model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 150,
            }
        });

        console.log(`✅ Gemini AI initialized with model: ${this.modelName}`);
    }

    async generateResponse(context: ConversationContext, userMessage: string): Promise<string> {
        try {
            console.log(`🤖 Generating AI response for: "${userMessage}"`);

            const conversationHistory = context.messages
                .slice(-10)
                .map(msg => {
                    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
                    return `${role}: ${msg.content}`;
                })
                .join('\n');

            const fullPrompt = `${context.systemPrompt}

${conversationHistory ? `Conversation so far:\n${conversationHistory}\n\n` : ''}User: ${userMessage}

            Assistant: `;

            const result = await this.model.generateContent(fullPrompt);
            const response = result.response;
            const text = response.text();

            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from Gemini');
            }

            console.log(` AI response: "${text}"`);

            this.emit('response', {
                text: text,
                tokens: 0
            });

            return text;

        } catch (error: any) {
            console.error(' Error generating AI response:', error);

            const fallbackResponse = "I apologize, I'm having trouble processing that. Could you please repeat?";

            this.emit('error', error);
            return fallbackResponse;
        }
    }

    async generateStreamingResponse(
        context: ConversationContext,
        userMessage: string,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        return this.generateResponse(context, userMessage);
    }

    static createSystemPrompt(purpose: string = 'general assistant'): string {
        return `You are a helpful AI assistant speaking with a customer over the phone.

Guidelines:
- Be concise and natural in your responses
- Speak in short sentences (1-2 sentences at a time)
- Use a friendly, professional tone
- Ask clarifying questions when needed
- If you don't know something, admit it honestly
- Listen carefully and respond appropriately
- Avoid long explanations unless specifically asked

Purpose: ${purpose}

Remember: You are having a voice conversation, so keep responses brief and conversational.`;
    }

    private validateResponse(response: string): boolean {
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 3) {
            console.warn(' Response too long, consider breaking it up');
        }

        if (response.trim().length < 5) {
            console.warn(' Response too short');
            return false;
        }

        return true;
    }
}
