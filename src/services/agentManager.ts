import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConversationLoop, ConversationLoopConfig } from './conversationLoop';
import { RAGEngine } from './ragEngine';

function getSupabase(): SupabaseClient {
    return createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_KEY || ''
    );
}

export interface Agent {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    voice: string;
    system_prompt: string;
    personality: any;
    knowledge_base_id?: string;
    background_noise: string;
    noise_level: number;
    temperature: number;
    max_tokens: number;
    settings: any;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AgentCreate {
    user_id: string;
    name: string;
    description?: string;
    voice?: string;
    system_prompt: string;
    personality?: any;
    knowledge_base_id?: string;
    background_noise?: string;
    noise_level?: number;
    temperature?: number;
    max_tokens?: number;
    settings?: any;
}

export interface AgentUpdate {
    name?: string;
    description?: string;
    voice?: string;
    system_prompt?: string;
    personality?: any;
    knowledge_base_id?: string;
    background_noise?: string;
    noise_level?: number;
    temperature?: number;
    max_tokens?: number;
    settings?: any;
    is_active?: boolean;
}

/**
 * Agent Manager Service
 * Handles CRUD operations and management for AI agents
 */
export class AgentManager {
    private ragEngine: RAGEngine;

    constructor() {
        this.ragEngine = new RAGEngine();
    }

    /**
     * Create a new AI agent
     */
    async createAgent(data: AgentCreate) {
        try {
            const { data: agent, error } = await getSupabase()
                .from('ai_agents')
                .insert({
                    user_id: data.user_id,
                    name: data.name,
                    description: data.description,
                    voice: data.voice || 'AWS.Polly.Joanna-Neural',
                    system_prompt: data.system_prompt,
                    personality: data.personality || { tone: 'friendly', formality: 'professional' },
                    knowledge_base_id: data.knowledge_base_id,
                    background_noise: data.background_noise || 'none',
                    noise_level: data.noise_level || 10,
                    temperature: data.temperature || 0.7,
                    max_tokens: data.max_tokens || 150,
                    settings: data.settings || {
                        model: 'gemini-2.5-flash',
                        language: 'en',
                        greeting: 'Hello! How can I help you today?',
                        endCallPhrases: ['goodbye', 'bye', 'thank you'],
                        interruptionEnabled: true,
                        silenceTimeout: 3000,
                        maxDuration: 1800,
                        recordingEnabled: true,
                        transcriptionEnabled: true
                    }
                })
                .select()
                .single();

            if (error) throw error;

            console.log(`✅ Created agent: ${agent.name}`);
            return { success: true, data: agent };

        } catch (error: any) {
            console.error('Error creating agent:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all agents for a user
     */
    async listAgents(userId: string) {
        try {
            const { data, error } = await getSupabase()
                .from('ai_agents')
                .select(`
                    *,
                    knowledge_base:knowledge_bases(id, name),
                    metrics:agent_metrics(
                        total_calls,
                        successful_calls,
                        average_duration_seconds
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { success: true, data };

        } catch (error: any) {
            console.error('Error listing agents:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a specific agent
     */
    async getAgent(agentId: string) {
        try {
            const { data, error } = await getSupabase()
                .from('ai_agents')
                .select(`
                    *,
                    knowledge_base:knowledge_bases(id, name, description),
                    metrics:agent_metrics(*)
                `)
                .eq('id', agentId)
                .single();

            if (error) throw error;

            return { success: true, data };

        } catch (error: any) {
            console.error('Error getting agent:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update an agent
     */
    async updateAgent(agentId: string, updates: AgentUpdate) {
        try {
            const { data, error } = await getSupabase()
                .from('ai_agents')
                .update(updates)
                .eq('id', agentId)
                .select()
                .single();

            if (error) throw error;

            console.log(`✅ Updated agent: ${agentId}`);
            return { success: true, data };

        } catch (error: any) {
            console.error('Error updating agent:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete an agent
     */
    async deleteAgent(agentId: string) {
        try {
            const { error } = await getSupabase()
                .from('ai_agents')
                .delete()
                .eq('id', agentId);

            if (error) throw error;

            console.log(`✅ Deleted agent: ${agentId}`);
            return { success: true };

        } catch (error: any) {
            console.error('Error deleting agent:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clone an agent
     */
    async cloneAgent(agentId: string, newName: string, userId: string) {
        try {
            // Get original agent
            const { data: original, error: fetchError } = await getSupabase()
                .from('ai_agents')
                .select('*')
                .eq('id', agentId)
                .single();

            if (fetchError) throw fetchError;

            // Create clone
            const { data: clone, error: createError } = await getSupabase()
                .from('ai_agents')
                .insert({
                    user_id: userId,
                    name: newName,
                    description: original.description ? `${original.description} (Clone)` : 'Cloned agent',
                    voice: original.voice,
                    system_prompt: original.system_prompt,
                    personality: original.personality,
                    knowledge_base_id: original.knowledge_base_id,
                    background_noise: original.background_noise,
                    noise_level: original.noise_level,
                    temperature: original.temperature,
                    max_tokens: original.max_tokens,
                    settings: original.settings
                })
                .select()
                .single();

            if (createError) throw createError;

            console.log(`✅ Cloned agent: ${original.name} -> ${newName}`);
            return { success: true, data: clone };

        } catch (error: any) {
            console.error('Error cloning agent:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get agent metrics
     */
    async getAgentMetrics(agentId: string, days: number = 30) {
        try {
            const { data, error } = await getSupabase()
                .from('agent_metrics')
                .select('*')
                .eq('agent_id', agentId)
                .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
                .order('date', { ascending: false });

            if (error) throw error;

            // Calculate aggregate metrics
            const aggregate = data.reduce((acc: any, day: any) => ({
                total_calls: acc.total_calls + day.total_calls,
                successful_calls: acc.successful_calls + day.successful_calls,
                failed_calls: acc.failed_calls + day.failed_calls,
                total_duration: acc.total_duration + day.total_duration_seconds,
                total_messages: acc.total_messages + day.total_messages,
                kb_queries: acc.kb_queries + day.knowledge_base_queries
            }), {
                total_calls: 0,
                successful_calls: 0,
                failed_calls: 0,
                total_duration: 0,
                total_messages: 0,
                kb_queries: 0
            });

            return {
                success: true,
                data: {
                    daily: data,
                    aggregate: {
                        ...aggregate,
                        success_rate: aggregate.total_calls > 0
                            ? (aggregate.successful_calls / aggregate.total_calls) * 100
                            : 0,
                        avg_duration: aggregate.total_calls > 0
                            ? aggregate.total_duration / aggregate.total_calls
                            : 0,
                        avg_messages: aggregate.total_calls > 0
                            ? aggregate.total_messages / aggregate.total_calls
                            : 0
                    }
                }
            };

        } catch (error: any) {
            console.error('Error getting agent metrics:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update agent metrics after a call
     */
    async updateAgentMetrics(agentId: string, callData: {
        success: boolean;
        duration: number;
        messageCount: number;
        kbUsed: boolean;
        sentiment?: 'positive' | 'neutral' | 'negative';
    }) {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Get or create today's metrics
            const { data: existing } = await getSupabase()
                .from('agent_metrics')
                .select('*')
                .eq('agent_id', agentId)
                .eq('date', today)
                .single();

            if (existing) {
                // Update existing metrics
                const { error } = await getSupabase()
                    .from('agent_metrics')
                    .update({
                        total_calls: existing.total_calls + 1,
                        successful_calls: existing.successful_calls + (callData.success ? 1 : 0),
                        failed_calls: existing.failed_calls + (callData.success ? 0 : 1),
                        total_duration_seconds: existing.total_duration_seconds + callData.duration,
                        total_messages: existing.total_messages + callData.messageCount,
                        knowledge_base_queries: existing.knowledge_base_queries + (callData.kbUsed ? 1 : 0),
                        sentiment_positive: existing.sentiment_positive + (callData.sentiment === 'positive' ? 1 : 0),
                        sentiment_neutral: existing.sentiment_neutral + (callData.sentiment === 'neutral' ? 1 : 0),
                        sentiment_negative: existing.sentiment_negative + (callData.sentiment === 'negative' ? 1 : 0)
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Create new metrics
                const { error } = await getSupabase()
                    .from('agent_metrics')
                    .insert({
                        agent_id: agentId,
                        date: today,
                        total_calls: 1,
                        successful_calls: callData.success ? 1 : 0,
                        failed_calls: callData.success ? 0 : 1,
                        total_duration_seconds: callData.duration,
                        total_messages: callData.messageCount,
                        knowledge_base_queries: callData.kbUsed ? 1 : 0,
                        sentiment_positive: callData.sentiment === 'positive' ? 1 : 0,
                        sentiment_neutral: callData.sentiment === 'neutral' ? 1 : 0,
                        sentiment_negative: callData.sentiment === 'negative' ? 1 : 0
                    });

                if (error) throw error;
            }

            return { success: true };

        } catch (error: any) {
            console.error('Error updating agent metrics:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a conversation loop for an agent
     */
    async createConversationLoop(
        agentId: string,
        callId: string,
        callControlId: string = '',
        callerPhone: string = 'browser-call'
    ): Promise<ConversationLoop | null> {
        try {
            const result = await this.getAgent(agentId);

            if (!result.success || !result.data) {
                throw new Error('Agent not found');
            }

            const agent = result.data;

            const config: ConversationLoopConfig = {
                callId,
                callControlId,
                callerPhone,
                voice: agent.voice,
                systemPrompt: agent.system_prompt,
                knowledgeBaseId: agent.knowledge_base_id,
                backgroundNoise: agent.background_noise as any,
                noiseLevel: agent.noise_level,
                temperature: agent.temperature,
                maxTokens: agent.max_tokens,
                agentId: agent.id
            };

            const conversationLoop = new ConversationLoop(config);

            console.log(`✅ Created conversation loop for agent: ${agent.name}`);
            return conversationLoop;

        } catch (error: any) {
            console.error('Error creating conversation loop:', error);
            return null;
        }
    }
}
