import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { KnowledgeBaseService } from '../services/knowledgeBase';

const kbService = new KnowledgeBaseService();

export default async function knowledgeBaseRoutes(fastify: FastifyInstance) {
    /**
     * GET /
     * List all knowledge bases for the authenticated user
     */
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // TODO: Add authentication
            const userId = 'default-user-id'; // Temporary: will add auth later

            const result = await kbService.listKnowledgeBases(userId);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error listing knowledge bases:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /
     * Create a new knowledge base
     */
    fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // TODO: Add authentication
            const userId = 'default-user-id'; // Temporary: will add auth later

            const { name, description } = request.body as any;

            if (!name) {
                return reply.status(400).send({ error: 'Name is required' });
            }

            const result = await kbService.createKnowledgeBase({
                user_id: userId,
                name,
                description
            });

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return reply.status(201).send(result.data);

        } catch (error: any) {
            console.error('Error creating knowledge base:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /:id
     * Get a specific knowledge base
     */
    fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await kbService.getKnowledgeBase(id);

            if (!result.success) {
                return reply.status(404).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error getting knowledge base:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * PUT /:id
     * Update a knowledge base
     */
    fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;
            const { name, description, is_active } = request.body as any;

            const result = await kbService.updateKnowledgeBase(id, {
                name,
                description,
                is_active
            });

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error updating knowledge base:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * DELETE /:id
     * Delete a knowledge base
     */
    fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await kbService.deleteKnowledgeBase(id);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return { message: 'Knowledge base deleted successfully' };

        } catch (error: any) {
            console.error('Error deleting knowledge base:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /:id/documents
     * Add a document to a knowledge base
     */
    fastify.post('/:id/documents', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;
            const { title, content, source_url } = request.body as any;

            if (!content) {
                return reply.status(400).send({ error: 'Content is required' });
            }

            const result = await kbService.addDocument({
                knowledge_base_id: id,
                title: title || 'Untitled',
                content: content,
                source_type: source_url ? 'url' : 'text',
                source_url
            });

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return reply.status(201).send(result.data);

        } catch (error: any) {
            console.error('Error adding document:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /:id/documents
     * List all documents in a knowledge base
     */
    fastify.get('/:id/documents', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;

            const result = await kbService.listDocuments(id);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error listing documents:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * DELETE /:id/documents/:docId
     * Delete a document
     */
    fastify.delete('/:id/documents/:docId', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { docId } = request.params as any;

            const result = await kbService.deleteDocument(docId);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return { message: 'Document deleted successfully' };

        } catch (error: any) {
            console.error('Error deleting document:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /:id/search
     * Search within a knowledge base
     */
    fastify.post('/:id/search', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as any;
            const { query } = request.body as any;

            if (!query) {
                return reply.status(400).send({ error: 'Query is required' });
            }

            const result = await kbService.searchKnowledgeBase(id, query);

            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }

            return result.data;

        } catch (error: any) {
            console.error('Error searching knowledge base:', error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
