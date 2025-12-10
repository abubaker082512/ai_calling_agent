import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TemplatesService } from '../services/templates';

const templatesService = new TemplatesService();

export default async function templatesRoutes(fastify: FastifyInstance) {
    /**
     * GET /
     * List all templates
     */
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // TODO: Add authentication
            const userId = 'default-user-id';
            const { category } = request.query as any;

            const result = await templatesService.listTemplates(userId, category);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error listing templates:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /
     * Create a new template
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

            const result = await templatesService.createTemplate({
                user_id: userId,
                ...body
            });

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return reply.status(201).send(result.data);

        } catch (error: any) {
            console.error('Error creating template:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /:id
     * Get a specific template
     */
    fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await templatesService.getTemplate(id);

            if (!result.success) {
                return reply.status(404).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error getting template:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * PUT /:id
     * Update a template
     */
    fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;
            const updates = request.body as any;

            const result = await templatesService.updateTemplate(id, updates);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error updating template:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * DELETE /:id
     * Delete a template
     */
    fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await templatesService.deleteTemplate(id);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return { message: 'Template deleted successfully' };

        } catch (error: any) {
            console.error('Error deleting template:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /:id/use
     * Increment usage count
     */
    fastify.post('/:id/use', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await templatesService.incrementUsage(id);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return { message: 'Usage incremented' };

        } catch (error: any) {
            console.error('Error incrementing usage:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /search
     * Search templates
     */
    fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // TODO: Add authentication
            const userId = 'default-user-id';
            const { q } = request.query as any;

            if (!q) {
                return reply.status(400).send({ error: 'Query parameter required' });
            }

            const result = await templatesService.searchTemplates(userId, q);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error searching templates:', error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
