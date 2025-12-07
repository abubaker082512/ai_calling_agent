const axios = require('axios');
const EventEmitter = require('events');

class ConversationEngine extends EventEmitter {
    constructor() {
        super();
        const apiKey = process.env.TELNYX_API_KEY;
        if (!apiKey) {
            console.error('❌ TELNYX_API_KEY is missing');
            throw new Error('TELNYX_API_KEY is required');
        }
        this.apiKey = apiKey;
        // Using GPT-4 as Telnyx Llama models are returning 404
        this.modelName = 'gpt-4';
        this.baseURL = 'https://api.telnyx.com/v2/ai';
        console.log(`🤖 Telnyx AI initialized with model: ${this.modelName}`);
    }

    async generateResponse(context, userMessage) {
        try {
            console.log(`🤖 Generating AI response for: "${userMessage}"`);

            // Build messages array for Telnyx Inference API
            const messages = [
                { role: 'system', content: context.systemPrompt }
            ];

            // Add conversation history (last 10 messages)
            const recentMessages = context.messages.slice(-10);
            for (const msg of recentMessages) {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }

            // Add current user message
            messages.push({
                role: 'user',
                content: userMessage
            });

            // Call Telnyx Inference API
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: this.modelName,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            const aiResponse = response.data.choices[0].message.content;
            const tokens = response.data.usage?.total_tokens || 0;

            if (!aiResponse || aiResponse.trim().length === 0) {
                throw new Error('Empty response from Telnyx AI');
            }

            console.log(`✅ AI response: "${aiResponse}"`);
            this.emit('response', { text: aiResponse, tokens: tokens });

            return aiResponse;

        } catch (error) {
            console.error('❌ Error generating AI response:', error.response?.data || error.message);
            const fallbackResponse = "I apologize, I'm having trouble processing that. Could you please repeat?";
            this.emit('error', error);
            return fallbackResponse;
        }
    }

    async generateStreamingResponse(context, userMessage, onChunk) {
        // For now, return non-streaming response
        // TODO: Implement streaming with Telnyx Inference API
        return this.generateResponse(context, userMessage);
    }

    static createSystemPrompt(purpose = 'general assistant') {
        return `You are a helpful AI assistant speaking with a customer over the phone.

Guidelines:
- Be concise and natural
- Keep responses under 2-3 sentences when possible
- Be friendly and professional
- If you don't know something, say so
- Speak in a conversational tone

Purpose: ${purpose}`;
    }
}

module.exports = { ConversationEngine };
