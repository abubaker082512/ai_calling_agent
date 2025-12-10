import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from '../services/analytics';

const analyticsService = new AnalyticsService();

export default async function analyticsRoutes(fastify: FastifyInstance) {
    /**
     * GET /overview
     * Get analytics overview metrics
     */
    fastify.get('/overview', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { days } = request.query as any;
            const overview = await analyticsService.getOverview(days ? parseInt(days) : 30);
            return overview;
        } catch (error: any) {
            console.error('Error getting analytics overview:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /calls-over-time
     * Get call trends over time
     */
    fastify.get('/calls-over-time', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { days } = request.query as any;
            const trends = await analyticsService.getCallTrends(days ? parseInt(days) : 30);
            return trends;
        } catch (error: any) {
            console.error('Error getting call trends:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /top-agents
     * Get top performing agents
     */
    fastify.get('/top-agents', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { limit } = request.query as any;
            const agents = await analyticsService.getTopAgents(limit ? parseInt(limit) : 10);
            return agents;
        } catch (error: any) {
            console.error('Error getting top agents:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /sentiment-trends
     * Get sentiment trends over time
     */
    fastify.get('/sentiment-trends', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { days } = request.query as any;
            const trends = await analyticsService.getSentimentTrends(days ? parseInt(days) : 30);
            return trends;
        } catch (error: any) {
            console.error('Error getting sentiment trends:', error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
