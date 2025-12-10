import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentManager } from '../services/agentManager';

const agentManager = new AgentManager();

export default async function agentRoutes(fastify: FastifyInstance) {
    /**
     * GET /
     * List all agents for the authenticated user
     */
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // TODO: Add authentication
            const userId = 'default-user-id';

            const result = await agentManager.listAgents(userId);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error listing agents:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /
     * Create a new agent
     */
    fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // TODO: Add authentication
            const userId = 'default-user-id';

            const body = request.body as any;

            if (!body.name || !body.system_prompt) {
                return reply.status(400).send({
                    error: 'Name and system prompt are required'
                });
            }

            const result = await agentManager.createAgent({
                user_id: userId,
                ...body
            });

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return reply.status(201).send(result.data);

        } catch (error: any) {
            console.error('Error creating agent:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /:id
     * Get a specific agent
     */
    fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await agentManager.getAgent(id);

            if (!result.success) {
                return reply.status(404).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error getting agent:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * PUT /:id
     * Update an agent
     */
    fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;
            const updates = request.body as any;

            const result = await agentManager.updateAgent(id, updates);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error updating agent:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * DELETE /:id
     * Delete an agent
     */
    fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await agentManager.deleteAgent(id);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return { message: 'Agent deleted successfully' };

        } catch (error: any) {
            console.error('Error deleting agent:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /:id/clone
     * Clone an agent
     */
    fastify.post('/:id/clone', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;
            const { name } = request.body as any;

            // TODO: Add authentication
            const userId = 'default-user-id';

            if (!name) {
                return reply.status(400).send({ error: 'Name is required' });
            }

            const result = await agentManager.cloneAgent(id, name, userId);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return reply.status(201).send(result.data);

        } catch (error: any) {
            console.error('Error cloning agent:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /:id/metrics
     * Get agent performance metrics
     */
    fastify.get('/:id/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;
            const { days } = request.query as any;

            const result = await agentManager.getAgentMetrics(
                id,
                days ? parseInt(days) : 30
            );

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error getting agent metrics:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /:id/test
     * Test an agent (returns agent config for browser call)
     */
    fastify.post('/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await agentManager.getAgent(id);

            if (!result.success) {
                return reply.status(404).send({ error: result.error });
            }

            const agent = result.data;

            // Return agent configuration for browser call
            return {
                agentId: agent.id,
                name: agent.name,
                voice: agent.voice,
                systemPrompt: agent.system_prompt,
                knowledgeBaseId: agent.knowledge_base_id,
                backgroundNoise: agent.background_noise,
                noiseLevel: agent.noise_level,
                settings: agent.settings
            };

        } catch (error: any) {
            console.error('Error testing agent:', error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
