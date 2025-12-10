import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface Document {
    id: string;
    title: string;
    content: string;
    source_type: string;
    source_url?: string;
    similarity?: number;
}

export interface KnowledgeBase {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * RAG (Retrieval-Augmented Generation) Engine
 * Handles knowledge base queries and context augmentation
 */
export class RAGEngine {
    private supabase;
    private embeddingModel;

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_KEY || ''
        );

        // Use Gemini for embeddings
        this.embeddingModel = genAI.getGenerativeModel({
            model: 'embedding-001'
        });
    }

    /**
     * Generate embedding vector for text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const result = await this.embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Query knowledge base with semantic search
     */
    async queryKnowledgeBase(
        knowledgeBaseId: string,
        query: string,
        topK: number = 3,
        threshold: number = 0.7
    ): Promise<Document[]> {
        try {
            console.log(`🔍 Querying knowledge base ${knowledgeBaseId} for: "${query}"`);

            // Generate embedding for query
            const queryEmbedding = await this.generateEmbedding(query);

            // Perform vector similarity search
            const { data, error } = await this.supabase.rpc('match_documents', {
                query_embedding: queryEmbedding,
                knowledge_base_id_param: knowledgeBaseId,
                match_threshold: threshold,
                match_count: topK
            });

            if (error) {
                console.error('Error querying knowledge base:', error);
                return [];
            }

            console.log(`✅ Found ${data?.length || 0} relevant documents`);
            return data || [];

        } catch (error) {
            console.error('Error in queryKnowledgeBase:', error);
            return [];
        }
    }

    /**
     * Augment system prompt with relevant context from knowledge base
     */
    async augmentPrompt(
        systemPrompt: string,
        userMessage: string,
        knowledgeBaseId?: string
    ): Promise<string> {
        // If no knowledge base, return original prompt
        if (!knowledgeBaseId) {
            return systemPrompt;
        }

        try {
            // Query knowledge base for relevant documents
            const relevantDocs = await this.queryKnowledgeBase(
                knowledgeBaseId,
                userMessage,
                3, // Top 3 most relevant documents
                0.7 // 70% similarity threshold
            );

            // If no relevant documents found, return original prompt
            if (relevantDocs.length === 0) {
                console.log('⚠️ No relevant documents found in knowledge base');
                return systemPrompt;
            }

            // Build context from relevant documents
            const context = relevantDocs
                .map((doc, index) => {
                    return `[Document ${index + 1}: ${doc.title}]\n${doc.content}`;
                })
                .join('\n\n---\n\n');

            // Augment prompt with context
            const augmentedPrompt = `${systemPrompt}

KNOWLEDGE BASE CONTEXT:
The following information from the knowledge base may be relevant to answer the user's question:

${context}

---

Use the above information when relevant to provide accurate and helpful responses. If the knowledge base doesn't contain relevant information, use your general knowledge.`;

            console.log(`✅ Augmented prompt with ${relevantDocs.length} documents`);
            return augmentedPrompt;

        } catch (error) {
            console.error('Error augmenting prompt:', error);
            return systemPrompt; // Fallback to original prompt
        }
    }

    /**
     * Add document to knowledge base with embedding
     */
    async addDocument(
        knowledgeBaseId: string,
        title: string,
        content: string,
        sourceType: 'file' | 'url' | 'text',
        sourceUrl?: string,
        metadata?: any
    ): Promise<string | null> {
        try {
            console.log(`📄 Adding document "${title}" to knowledge base`);

            // Generate embedding for content
            const embedding = await this.generateEmbedding(content);

            // Insert document
            const { data, error } = await this.supabase
                .from('knowledge_documents')
                .insert({
                    knowledge_base_id: knowledgeBaseId,
                    title,
                    content,
                    source_type: sourceType,
                    source_url: sourceUrl,
                    embedding,
                    metadata: metadata || {}
                })
                .select('id')
                .single();

            if (error) {
                console.error('Error adding document:', error);
                return null;
            }

            console.log(`✅ Document added with ID: ${data.id}`);
            return data.id;

        } catch (error) {
            console.error('Error in addDocument:', error);
            return null;
        }
    }

    /**
     * Get knowledge base by ID
     */
    async getKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeBase | null> {
        try {
            const { data, error } = await this.supabase
                .from('knowledge_bases')
                .select('*')
                .eq('id', knowledgeBaseId)
                .single();

            if (error) {
                console.error('Error getting knowledge base:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in getKnowledgeBase:', error);
            return null;
        }
    }

    /**
     * List all documents in a knowledge base
     */
    async listDocuments(knowledgeBaseId: string): Promise<Document[]> {
        try {
            const { data, error } = await this.supabase
                .from('knowledge_documents')
                .select('id, title, content, source_type, source_url, created_at')
                .eq('knowledge_base_id', knowledgeBaseId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error listing documents:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in listDocuments:', error);
            return [];
        }
    }

    /**
     * Delete document from knowledge base
     */
    async deleteDocument(documentId: string): Promise<boolean> {
        try {
            const { error } = await this.supabase
                .from('knowledge_documents')
                .delete()
                .eq('id', documentId);

            if (error) {
                console.error('Error deleting document:', error);
                return false;
            }

            console.log(`✅ Document ${documentId} deleted`);
            return true;
        } catch (error) {
            console.error('Error in deleteDocument:', error);
            return false;
        }
    }
}
