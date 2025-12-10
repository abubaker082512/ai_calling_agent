import express from 'express';
import { KnowledgeBaseService } from '../services/knowledgeBase';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();
const kbService = new KnowledgeBaseService();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/documents/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.txt', '.pdf', '.doc', '.docx', '.md'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: TXT, PDF, DOC, DOCX, MD'));
        }
    }
});

/**
 * GET /api/knowledge-bases
 * List all knowledge bases for the authenticated user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.id; // Assuming auth middleware sets req.user

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const result = await kbService.listKnowledgeBases(userId);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result.data);

    } catch (error: any) {
        console.error('Error listing knowledge bases:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/knowledge-bases
 * Create a new knowledge base
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const result = await kbService.createKnowledgeBase({
            user_id: userId,
            name,
            description
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.status(201).json(result.data);

    } catch (error: any) {
        console.error('Error creating knowledge base:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/knowledge-bases/:id
 * Get a specific knowledge base
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await kbService.getKnowledgeBase(id);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result.data);

    } catch (error: any) {
        console.error('Error getting knowledge base:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/knowledge-bases/:id
 * Update a knowledge base
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;

        const result = await kbService.updateKnowledgeBase(id, {
            name,
            description,
            is_active
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result.data);

    } catch (error: any) {
        console.error('Error updating knowledge base:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/knowledge-bases/:id
 * Delete a knowledge base
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await kbService.deleteKnowledgeBase(id);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({ message: 'Knowledge base deleted successfully' });

    } catch (error: any) {
        console.error('Error deleting knowledge base:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/knowledge-bases/:id/documents
 * Add a document to a knowledge base
 */
router.post('/:id/documents', upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, source_url } = req.body;
        const file = req.file;

        let documentContent = content;
        let sourceType: 'file' | 'url' | 'text' = 'text';

        // If file was uploaded, read its content
        if (file) {
            const fileContent = await fs.readFile(file.path, 'utf-8');
            documentContent = fileContent;
            sourceType = 'file';

            // Clean up uploaded file
            await fs.unlink(file.path);
        } else if (source_url) {
            // TODO: Implement URL scraping
            sourceType = 'url';
        }

        if (!documentContent) {
            return res.status(400).json({ error: 'Content or file is required' });
        }

        const result = await kbService.addDocument({
            knowledge_base_id: id,
            title: title || file?.originalname || 'Untitled',
            content: documentContent,
            source_type: sourceType,
            source_url
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.status(201).json(result.data);

    } catch (error: any) {
        console.error('Error adding document:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/knowledge-bases/:id/documents
 * List all documents in a knowledge base
 */
router.get('/:id/documents', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await kbService.listDocuments(id);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result.data);

    } catch (error: any) {
        console.error('Error listing documents:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/knowledge-bases/:id/documents/:docId
 * Delete a document
 */
router.delete('/:id/documents/:docId', async (req, res) => {
    try {
        const { docId } = req.params;

        const result = await kbService.deleteDocument(docId);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({ message: 'Document deleted successfully' });

    } catch (error: any) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/knowledge-bases/:id/search
 * Search within a knowledge base
 */
router.post('/:id/search', async (req, res) => {
    try {
        const { id } = req.params;
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const result = await kbService.searchKnowledgeBase(id, query);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result.data);

    } catch (error: any) {
        console.error('Error searching knowledge base:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
