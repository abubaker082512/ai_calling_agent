import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import EventEmitter from 'events';
import { ConversationContext, Message } from './conversationState';

export interface AIResponse {
    text: string;
    tokens: number;
}

export class ConversationEngine extends EventEmitter {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private modelName: string;

    constructor() {
        super();
        const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('❌ GEMINI_API_KEY is missing');
            throw new Error('GEMINI_API_KEY is required');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        // Use a valid model name. 2.5-flash is not released yet.
        this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        console.log(`✨ Gemini AI initialized with model: ${this.modelName}`);
    }

    async generateResponse(context: ConversationContext, userMessage: string): Promise<string> {
        try {
            console.log(`🤖 Generating AI response for: "${userMessage}"`);

            const conversationHistory = context.messages.slice(-10).map(msg => {
                const role = msg.role === 'assistant' ? 'Assistant' : 'User';
                return `${role}: ${msg.content}`;
            }).join('\n');

            const fullPrompt = `${context.systemPrompt}\n\n${conversationHistory ? `Conversation so far:\n${conversationHistory}\n\n` : ''}User: ${userMessage}\n\nAssistant:`;

            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();

            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from Gemini');
            }

            console.log(`✅ AI response: "${text}"`);
            this.emit('response', { text: text, tokens: 0 });
            return text;

        } catch (error) {
            console.error('❌ Error generating AI response:', error);
            // Default safe response, but log the error clearly
            const fallbackResponse = "I'm sorry, I'm having a technical issue right now. Can we talk later?";
            this.emit('error', error);
            return fallbackResponse;
        }
    }

    async generateStreamingResponse(context: ConversationContext, userMessage: string, onChunk: (chunk: string) => void): Promise<string> {
        try {
            console.log(`🤖 Generating streaming AI response for: "${userMessage}"`);

            const conversationHistory = context.messages.slice(-10).map(msg => {
                const role = msg.role === 'assistant' ? 'Assistant' : 'User';
                return `${role}: ${msg.content}`;
            }).join('\n');

            const fullPrompt = `${context.systemPrompt}\n\n${conversationHistory ? `Conversation so far:\n${conversationHistory}\n\n` : ''}User: ${userMessage}\n\nAssistant:`;

            const result = await this.model.generateContentStream(fullPrompt);

            let fullText = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    fullText += chunkText;
                    onChunk(chunkText);
                }
            }

            console.log(`✅ Completing streaming response: "${fullText}"`);
            this.emit('response', { text: fullText, tokens: 0 });
            return fullText;

        } catch (error) {
            console.error('❌ Error generating streaming AI response:', error);
            // Don't send a robotic interruption if it fails mid-stream or at start
            // Just emit error so we can debug.
            // If absolutely nothing was sent, maybe send a short error message.
            this.emit('error', error);

            // Only send fallback if we know what happened, usually silence is better than "I apologize" loop
            // But let's send a very short, natural error acknowledgment if needed.
            // onChunk("Hmm, I lost my train of thought. Say that again?");
            return '';
        }
    }

    static createSystemPrompt(purpose = 'sales agent'): string {
        return `You are a helpful and friendly sales agent speaking with a customer over the phone.
        
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
}
