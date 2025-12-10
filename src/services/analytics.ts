import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabase(): SupabaseClient {
    return createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_KEY || ''
    );
}

export interface AnalyticsOverview {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number;
    avgDuration: number;
    totalDuration: number;
    sentimentBreakdown: {
        positive: number;
        neutral: number;
        negative: number;
    };
}

export interface CallTrend {
    date: string;
    calls: number;
    successful: number;
    failed: number;
}

export interface AgentPerformance {
    agentId: string;
    agentName: string;
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    sentimentScore: number;
}

/**
 * Analytics Service
 * Provides metrics and insights for dashboard visualization
 */
export class AnalyticsService {
    /**
     * Get overview metrics for a date range
     */
    async getOverview(days: number = 30): Promise<AnalyticsOverview> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Get all agent metrics for the period
            const { data: metrics, error } = await getSupabase()
                .from('agent_metrics')
                .select('*')
                .gte('date', startDate.toISOString().split('T')[0]);

            if (error) throw error;

            if (!metrics || metrics.length === 0) {
                return {
                    totalCalls: 0,
                    successfulCalls: 0,
                    failedCalls: 0,
                    successRate: 0,
                    avgDuration: 0,
                    totalDuration: 0,
                    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 }
                };
            }

            // Aggregate metrics
            const totals = metrics.reduce((acc: any, m: any) => ({
                totalCalls: acc.totalCalls + m.total_calls,
                successfulCalls: acc.successfulCalls + m.successful_calls,
                failedCalls: acc.failedCalls + m.failed_calls,
                totalDuration: acc.totalDuration + m.total_duration_seconds,
                sentimentPositive: acc.sentimentPositive + (m.sentiment_positive || 0),
                sentimentNeutral: acc.sentimentNeutral + (m.sentiment_neutral || 0),
                sentimentNegative: acc.sentimentNegative + (m.sentiment_negative || 0)
            }), {
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                totalDuration: 0,
                sentimentPositive: 0,
                sentimentNeutral: 0,
                sentimentNegative: 0
            });

            return {
                totalCalls: totals.totalCalls,
                successfulCalls: totals.successfulCalls,
                failedCalls: totals.failedCalls,
                successRate: totals.totalCalls > 0
                    ? (totals.successfulCalls / totals.totalCalls) * 100
                    : 0,
                avgDuration: totals.totalCalls > 0
                    ? totals.totalDuration / totals.totalCalls
                    : 0,
                totalDuration: totals.totalDuration,
                sentimentBreakdown: {
                    positive: totals.sentimentPositive,
                    neutral: totals.sentimentNeutral,
                    negative: totals.sentimentNegative
                }
            };

        } catch (error: any) {
            console.error('Error getting analytics overview:', error);
            throw error;
        }
    }

    /**
     * Get call trends over time
     */
    async getCallTrends(days: number = 30): Promise<CallTrend[]> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data: metrics, error } = await getSupabase()
                .from('agent_metrics')
                .select('date, total_calls, successful_calls, failed_calls')
                .gte('date', startDate.toISOString().split('T')[0])
                .order('date', { ascending: true });

            if (error) throw error;

            if (!metrics || metrics.length === 0) {
                return [];
            }

            // Group by date
            const trendMap = new Map<string, CallTrend>();

            metrics.forEach((m: any) => {
                const existing = trendMap.get(m.date) || {
                    date: m.date,
                    calls: 0,
                    successful: 0,
                    failed: 0
                };

                trendMap.set(m.date, {
                    date: m.date,
                    calls: existing.calls + m.total_calls,
                    successful: existing.successful + m.successful_calls,
                    failed: existing.failed + m.failed_calls
                });
            });

            return Array.from(trendMap.values()).sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

        } catch (error: any) {
            console.error('Error getting call trends:', error);
            throw error;
        }
    }

    /**
     * Get top performing agents
     */
    async getTopAgents(limit: number = 10): Promise<AgentPerformance[]> {
        try {
            // Get agents with their metrics
            const { data: agents, error: agentsError } = await getSupabase()
                .from('ai_agents')
                .select(`
                    id,
                    name,
                    metrics:agent_metrics(
                        total_calls,
                        successful_calls,
                        total_duration_seconds,
                        sentiment_positive,
                        sentiment_neutral,
                        sentiment_negative
                    )
                `)
                .eq('is_active', true);

            if (agentsError) throw agentsError;

            if (!agents || agents.length === 0) {
                return [];
            }

            // Calculate performance for each agent
            const performance: AgentPerformance[] = agents.map((agent: any) => {
                const metrics = agent.metrics || [];

                const totals = metrics.reduce((acc: any, m: any) => ({
                    totalCalls: acc.totalCalls + (m.total_calls || 0),
                    successfulCalls: acc.successfulCalls + (m.successful_calls || 0),
                    totalDuration: acc.totalDuration + (m.total_duration_seconds || 0),
                    sentimentPositive: acc.sentimentPositive + (m.sentiment_positive || 0),
                    sentimentNeutral: acc.sentimentNeutral + (m.sentiment_neutral || 0),
                    sentimentNegative: acc.sentimentNegative + (m.sentiment_negative || 0)
                }), {
                    totalCalls: 0,
                    successfulCalls: 0,
                    totalDuration: 0,
                    sentimentPositive: 0,
                    sentimentNeutral: 0,
                    sentimentNegative: 0
                });

                const successRate = totals.totalCalls > 0
                    ? (totals.successfulCalls / totals.totalCalls) * 100
                    : 0;

                const avgDuration = totals.totalCalls > 0
                    ? totals.totalDuration / totals.totalCalls
                    : 0;

                // Calculate sentiment score (positive = 1, neutral = 0.5, negative = 0)
                const totalSentiment = totals.sentimentPositive + totals.sentimentNeutral + totals.sentimentNegative;
                const sentimentScore = totalSentiment > 0
                    ? ((totals.sentimentPositive * 1) + (totals.sentimentNeutral * 0.5)) / totalSentiment
                    : 0.5;

                return {
                    agentId: agent.id,
                    agentName: agent.name,
                    totalCalls: totals.totalCalls,
                    successRate,
                    avgDuration,
                    sentimentScore
                };
            });

            // Sort by total calls and success rate
            return performance
                .sort((a, b) => {
                    if (b.totalCalls !== a.totalCalls) {
                        return b.totalCalls - a.totalCalls;
                    }
                    return b.successRate - a.successRate;
                })
                .slice(0, limit);

        } catch (error: any) {
            console.error('Error getting top agents:', error);
            throw error;
        }
    }

    /**
     * Get sentiment trends over time
     */
    async getSentimentTrends(days: number = 30): Promise<any[]> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data: metrics, error } = await getSupabase()
                .from('agent_metrics')
                .select('date, sentiment_positive, sentiment_neutral, sentiment_negative')
                .gte('date', startDate.toISOString().split('T')[0])
                .order('date', { ascending: true });

            if (error) throw error;

            if (!metrics || metrics.length === 0) {
                return [];
            }

            // Group by date
            const trendMap = new Map<string, any>();

            metrics.forEach((m: any) => {
                const existing = trendMap.get(m.date) || {
                    date: m.date,
                    positive: 0,
                    neutral: 0,
                    negative: 0
                };

                trendMap.set(m.date, {
                    date: m.date,
                    positive: existing.positive + (m.sentiment_positive || 0),
                    neutral: existing.neutral + (m.sentiment_neutral || 0),
                    negative: existing.negative + (m.sentiment_negative || 0)
                });
            });

            return Array.from(trendMap.values()).sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

        } catch (error: any) {
            console.error('Error getting sentiment trends:', error);
            throw error;
        }
    }
}
