/**
 * Dexatel API Routes
 * Complete API endpoints for Dexatel voice operations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DexatelCallService } from '../services/DexatelCallService';
import { SupabaseService } from '../services/supabase';

interface MakeCallRequest {
    to: string;
    from?: string;
}

interface CallIdParams {
    callId: string;
}

export default async function dexatelApiRoutes(fastify: FastifyInstance) {
    const dexatelService = new DexatelCallService();
    const supabase = new SupabaseService();

    console.log('✅ Dexatel API routes initialized');

    /**
     * POST /api/dexatel/call
     * Make an outbound call
     */
    fastify.post('/call', async (request: FastifyRequest<{ Body: MakeCallRequest }>, reply: FastifyReply) => {
        try {
            const { to, from } = request.body;

            if (!to) {
                return reply.code(400).send({ error: 'Phone number required' });
            }

            console.log(`📞 Making Dexatel call to: ${to}`);

            const domain = process.env.DOMAIN || 'http://localhost:3000';
            const streamUrl = `wss://${domain.replace('https://', '').replace('http://', '')}/media/stream`;

            const call = await dexatelService.makeCall({
                to,
                from: from || process.env.DEXATEL_FROM_NUMBER,
                stream_url: streamUrl
            });

            // Log to database
            await supabase.client.from('dexatel_calls').insert({
                call_id: call.call_id,
                to_number: to,
                from_number: from || process.env.DEXATEL_FROM_NUMBER,
                status: call.status,
                started_at: new Date().toISOString()
            });

            return reply.code(200).send({
                success: true,
                call
            });

        } catch (error: any) {
            console.error('❌ Error making call:', error);
            return reply.code(500).send({
                error: 'Failed to make call',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/calls
     * List all calls
     */
    fastify.get('/calls', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { data: calls, error } = await supabase.client
                .from('dexatel_calls')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            return reply.code(200).send({
                success: true,
                calls: calls || []
            });

        } catch (error: any) {
            console.error('❌ Error fetching calls:', error);
            return reply.code(500).send({
                error: 'Failed to fetch calls',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/calls/:callId
     * Get call details
     */
    fastify.get('/calls/:callId', async (request: FastifyRequest<{ Params: CallIdParams }>, reply: FastifyReply) => {
        try {
            const { callId } = request.params;

            const { data: call, error } = await supabase.client
                .from('dexatel_calls')
                .select('*')
                .eq('call_id', callId)
                .single();

            if (error) throw error;

            if (!call) {
                return reply.code(404).send({ error: 'Call not found' });
            }

            // Get call status from Dexatel
            try {
                const status = await dexatelService.getCallStatus(callId);
                return reply.code(200).send({
                    success: true,
                    call: {
                        ...call,
                        live_status: status
                    }
                });
            } catch (err) {
                // Return DB data if API call fails
                return reply.code(200).send({
                    success: true,
                    call
                });
            }

        } catch (error: any) {
            console.error('❌ Error fetching call:', error);
            return reply.code(500).send({
                error: 'Failed to fetch call',
                message: error.message
            });
        }
    });

    /**
     * DELETE /api/dexatel/calls/:callId
     * Hangup a call
     */
    fastify.delete('/calls/:callId', async (request: FastifyRequest<{ Params: CallIdParams }>, reply: FastifyReply) => {
        try {
            const { callId } = request.params;

            await dexatelService.hangupCall(callId);

            // Update database
            await supabase.client
                .from('dexatel_calls')
                .update({
                    status: 'ended',
                    ended_at: new Date().toISOString()
                })
                .eq('call_id', callId);

            return reply.code(200).send({
                success: true,
                message: 'Call ended'
            });

        } catch (error: any) {
            console.error('❌ Error hanging up call:', error);
            return reply.code(500).send({
                error: 'Failed to hangup call',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/balance
     * Get account balance
     */
    fastify.get('/balance', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const balance = await dexatelService.getBalance();

            return reply.code(200).send({
                success: true,
                balance
            });

        } catch (error: any) {
            console.error('❌ Error fetching balance:', error);
            return reply.code(500).send({
                error: 'Failed to fetch balance',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/status
     * Get service status
     */
    fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const apiKey = process.env.DEXATEL_API_KEY;

            return reply.code(200).send({
                success: true,
                status: 'operational',
                configured: !!apiKey,
                provider: 'Dexatel',
                features: ['voice_calls', 'webhooks', 'real_time_audio']
            });

        } catch (error: any) {
            return reply.code(500).send({
                error: 'Service unavailable',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/analytics
     * Get call analytics
     */
    fastify.get('/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { data: calls, error } = await supabase.client
                .from('dexatel_calls')
                .select('*');

            if (error) throw error;

            const analytics = {
                total_calls: calls?.length || 0,
                active_calls: calls?.filter(c => c.status === 'active').length || 0,
                completed_calls: calls?.filter(c => c.status === 'completed').length || 0,
                failed_calls: calls?.filter(c => c.status === 'failed').length || 0,
                total_duration: calls?.reduce((sum, c) => sum + (c.duration || 0), 0) || 0,
                total_cost: calls?.reduce((sum, c) => sum + (c.cost || 0), 0) || 0,
                avg_duration: calls?.length ?
                    (calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length) : 0,
                avg_cost: calls?.length ?
                    (calls.reduce((sum, c) => sum + (c.cost || 0), 0) / calls.length) : 0
            };

            return reply.code(200).send({
                success: true,
                analytics
            });

        } catch (error: any) {
            console.error('❌ Error fetching analytics:', error);
            return reply.code(500).send({
                error: 'Failed to fetch analytics',
                message: error.message
            });
        }
    });

    /**
     * GET /api/dexatel/stats
     * Get quick stats
     */
    fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { data: calls } = await supabase.client
                .from('dexatel_calls')
                .select('status, duration, cost')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            const stats = {
                calls_24h: calls?.length || 0,
                active_now: calls?.filter(c => c.status === 'active').length || 0,
                total_duration_24h: calls?.reduce((sum, c) => sum + (c.duration || 0), 0) || 0,
                total_cost_24h: calls?.reduce((sum, c) => sum + (c.cost || 0), 0) || 0
            };

            return reply.code(200).send({
                success: true,
                stats
            });

        } catch (error: any) {
            return reply.code(500).send({
                error: 'Failed to fetch stats',
                message: error.message
            });
        }
    });
}
