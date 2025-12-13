// Cost Calculation Service
import { getSupabase } from './supabase';

export interface CallCost {
    llmCost: number;
    ttsCost: number;
    sttCost: number;
    telephonyCost: number;
    totalCost: number;
}

export interface CostBreakdown {
    period: string;
    llmCost: number;
    ttsCost: number;
    sttCost: number;
    telephonyCost: number;
    totalCost: number;
    totalCalls: number;
    totalMinutes: number;
}

export class CostService {
    /**
     * Calculate cost for a single call
     */
    static calculateCallCost(
        tokens: number,
        ttsCharacters: number,
        durationSeconds: number
    ): CallCost {
        // LLM Cost: $0.001 per 1K tokens (Gemini Flash)
        const llmCost = (tokens / 1000) * 0.001;

        // TTS Cost: $0.015 per 1M characters (AWS Polly Neural)
        const ttsCost = (ttsCharacters / 1000000) * 0.015;

        // STT Cost: $0.006 per minute (Deepgram)
        const durationMinutes = durationSeconds / 60;
        const sttCost = durationMinutes * 0.006;

        // Telephony Cost: $0.013 per minute (Telnyx)
        const telephonyCost = durationMinutes * 0.013;

        // Total
        const totalCost = llmCost + ttsCost + sttCost + telephonyCost;

        return {
            llmCost: parseFloat(llmCost.toFixed(4)),
            ttsCost: parseFloat(ttsCost.toFixed(4)),
            sttCost: parseFloat(sttCost.toFixed(4)),
            telephonyCost: parseFloat(telephonyCost.toFixed(4)),
            totalCost: parseFloat(totalCost.toFixed(4))
        };
    }

    /**
     * Get monthly cost summary
     */
    static async getMonthlyCost(userId: string, year: number, month: number): Promise<CostBreakdown | null> {
        try {
            const supabase = getSupabase();

            // Get start and end of month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            // Query agent_metrics for the period
            const { data, error } = await supabase
                .from('agent_metrics')
                .select('*')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());

            if (error) {
                console.error('Error fetching monthly costs:', error);
                return null;
            }

            if (!data || data.length === 0) {
                return {
                    period: `${year}-${month.toString().padStart(2, '0')}`,
                    llmCost: 0,
                    ttsCost: 0,
                    sttCost: 0,
                    telephonyCost: 0,
                    totalCost: 0,
                    totalCalls: 0,
                    totalMinutes: 0
                };
            }

            // Calculate totals
            let llmCost = 0;
            let ttsCost = 0;
            let sttCost = 0;
            let telephonyCost = 0;
            let totalMinutes = 0;

            data.forEach((metric: any) => {
                llmCost += metric.llm_cost || 0;
                ttsCost += metric.tts_cost || 0;
                sttCost += metric.stt_cost || 0;
                telephonyCost += metric.telephony_cost || 0;
                totalMinutes += (metric.avg_call_duration || 0) / 60;
            });

            return {
                period: `${year}-${month.toString().padStart(2, '0')}`,
                llmCost: parseFloat(llmCost.toFixed(4)),
                ttsCost: parseFloat(ttsCost.toFixed(4)),
                sttCost: parseFloat(sttCost.toFixed(4)),
                telephonyCost: parseFloat(telephonyCost.toFixed(4)),
                totalCost: parseFloat((llmCost + ttsCost + sttCost + telephonyCost).toFixed(4)),
                totalCalls: data.length,
                totalMinutes: parseFloat(totalMinutes.toFixed(2))
            };

        } catch (error) {
            console.error('Error calculating monthly cost:', error);
            return null;
        }
    }

    /**
     * Get cost trend (last 6 months)
     */
    static async getCostTrend(userId: string): Promise<CostBreakdown[]> {
        const trends: CostBreakdown[] = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const cost = await this.getMonthlyCost(userId, date.getFullYear(), date.getMonth() + 1);
            if (cost) {
                trends.push(cost);
            }
        }

        return trends;
    }

    /**
     * Update call with cost information
     */
    static async updateCallCost(
        callId: string,
        tokens: number,
        ttsCharacters: number,
        durationSeconds: number
    ): Promise<boolean> {
        try {
            const supabase = getSupabase();
            const costs = this.calculateCallCost(tokens, ttsCharacters, durationSeconds);

            const { error } = await supabase
                .from('agent_metrics')
                .update({
                    llm_cost: costs.llmCost,
                    tts_cost: costs.ttsCost,
                    stt_cost: costs.sttCost,
                    telephony_cost: costs.telephonyCost,
                    total_cost: costs.totalCost,
                    tokens_used: tokens,
                    tts_characters: ttsCharacters
                })
                .eq('id', callId);

            if (error) {
                console.error('Error updating call cost:', error);
                return false;
            }

            return true;

        } catch (error) {
            console.error('Error updating call cost:', error);
            return false;
        }
    }

    /**
     * Format cost for display
     */
    static formatCost(cost: number): string {
        if (cost === 0) return '$0.00';
        if (cost < 0.01) return '<$0.01';
        return `$${cost.toFixed(2)}`;
    }
}
