import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
    sentiment: Sentiment;
    confidence: number;
    text: string;
    timestamp: number;
}

/**
 * Sentiment Analysis Service
 * Analyzes conversation sentiment using Gemini AI
 */
export class SentimentAnalyzer {
    private model: any;

    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }

    /**
     * Analyze sentiment of text using Gemini
     */
    async analyze(text: string): Promise<SentimentResult> {
        try {
            const prompt = `Analyze the sentiment of this text. Respond with ONLY one word: positive, neutral, or negative.

Text: "${text}"

Sentiment:`;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim().toLowerCase();

            // Parse sentiment
            let sentiment: Sentiment = 'neutral';
            if (response.includes('positive')) {
                sentiment = 'positive';
            } else if (response.includes('negative')) {
                sentiment = 'negative';
            }

            return {
                sentiment,
                confidence: 0.8, // Gemini doesn't provide confidence, using default
                text,
                timestamp: Date.now()
            };

        } catch (error: any) {
            console.error('Error analyzing sentiment:', error);
            // Fallback to keyword-based analysis
            return this.keywordBasedAnalysis(text);
        }
    }

    /**
     * Fallback keyword-based sentiment analysis
     */
    private keywordBasedAnalysis(text: string): SentimentResult {
        const lower = text.toLowerCase();

        const positiveWords = [
            'great', 'excellent', 'happy', 'thank', 'perfect', 'wonderful',
            'amazing', 'love', 'good', 'best', 'awesome', 'fantastic',
            'appreciate', 'helpful', 'pleased', 'satisfied'
        ];

        const negativeWords = [
            'bad', 'terrible', 'angry', 'frustrated', 'problem', 'issue',
            'hate', 'worst', 'awful', 'horrible', 'disappointed', 'upset',
            'annoyed', 'confused', 'difficult', 'wrong'
        ];

        const positiveCount = positiveWords.filter(word => lower.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lower.includes(word)).length;

        let sentiment: Sentiment = 'neutral';
        if (positiveCount > negativeCount && positiveCount > 0) {
            sentiment = 'positive';
        } else if (negativeCount > positiveCount && negativeCount > 0) {
            sentiment = 'negative';
        }

        return {
            sentiment,
            confidence: 0.6, // Lower confidence for keyword-based
            text,
            timestamp: Date.now()
        };
    }

    /**
     * Analyze overall conversation sentiment
     */
    async analyzeConversation(messages: string[]): Promise<SentimentResult> {
        try {
            const conversationText = messages.join('\n');

            const prompt = `Analyze the overall sentiment of this conversation. Respond with ONLY one word: positive, neutral, or negative.

Conversation:
${conversationText}

Overall Sentiment:`;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim().toLowerCase();

            let sentiment: Sentiment = 'neutral';
            if (response.includes('positive')) {
                sentiment = 'positive';
            } else if (response.includes('negative')) {
                sentiment = 'negative';
            }

            return {
                sentiment,
                confidence: 0.85,
                text: conversationText,
                timestamp: Date.now()
            };

        } catch (error: any) {
            console.error('Error analyzing conversation sentiment:', error);

            // Fallback: average individual sentiments
            const sentiments = await Promise.all(
                messages.map(msg => this.keywordBasedAnalysis(msg))
            );

            const counts = {
                positive: sentiments.filter(s => s.sentiment === 'positive').length,
                neutral: sentiments.filter(s => s.sentiment === 'neutral').length,
                negative: sentiments.filter(s => s.sentiment === 'negative').length
            };

            let overallSentiment: Sentiment = 'neutral';
            if (counts.positive > counts.negative && counts.positive > counts.neutral) {
                overallSentiment = 'positive';
            } else if (counts.negative > counts.positive && counts.negative > counts.neutral) {
                overallSentiment = 'negative';
            }

            return {
                sentiment: overallSentiment,
                confidence: 0.7,
                text: messages.join('\n'),
                timestamp: Date.now()
            };
        }
    }

    /**
     * Get sentiment emoji
     */
    getSentimentEmoji(sentiment: Sentiment): string {
        switch (sentiment) {
            case 'positive':
                return '😊';
            case 'negative':
                return '😞';
            case 'neutral':
            default:
                return '😐';
        }
    }

    /**
     * Get sentiment color
     */
    getSentimentColor(sentiment: Sentiment): string {
        switch (sentiment) {
            case 'positive':
                return '#10b981'; // green
            case 'negative':
                return '#ef4444'; // red
            case 'neutral':
            default:
                return '#f59e0b'; // yellow
        }
    }
}
