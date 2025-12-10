import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RAGEngine } from './ragEngine';

export interface KnowledgeBaseCreate {
    name: string;
    description?: string;
    user_id: string;
}

export interface KnowledgeBaseUpdate {
    name?: string;
    description?: string;
    is_active?: boolean;
}

export interface DocumentCreate {
    knowledge_base_id: string;
    title: string;
    content: string;
    source_type: 'file' | 'url' | 'text';
    source_url?: string;
    metadata?: any;
}

/**
 * Knowledge Base Management Service
 */
export class KnowledgeBaseService {
    private ragEngine: RAGEngine;
    private _supabase?: SupabaseClient;

    constructor() {
        this.ragEngine = new RAGEngine();
    }

    private get supabase(): SupabaseClient {
        if (!this._supabase) {
            this._supabase = createClient(
                process.env.SUPABASE_URL || '',
                process.env.SUPABASE_KEY || ''
            );
        }
        return this._supabase;
    }

    /**
     * Create a new knowledge base
     */
    async createKnowledgeBase(data: KnowledgeBaseCreate) {
        try {
            const { data: kb, error } = await this.supabase
                .from('knowledge_bases')
                .insert({
                    user_id: data.user_id,
                    name: data.name,
                    description: data.description
                })
                .select()
                .single();

            if (error) throw error;

            console.log(`✅ Created knowledge base: ${kb.name}`);
            return { success: true, data: kb };

        } catch (error: any) {
            console.error('Error creating knowledge base:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all knowledge bases for a user
     */
    async listKnowledgeBases(userId: string) {
        try {
            const { data, error } = await this.supabase
                .from('knowledge_bases')
                .select(`
                    *,
                    document_count:knowledge_documents(count)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { success: true, data };

        } catch (error: any) {
            console.error('Error listing knowledge bases:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a specific knowledge base
     */
    async getKnowledgeBase(id: string) {
        try {
            const { data, error } = await this.supabase
                .from('knowledge_bases')
                .select(`
                    *,
                    documents:knowledge_documents(*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            return { success: true, data };

        } catch (error: any) {
            console.error('Error getting knowledge base:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update a knowledge base
     */
    async updateKnowledgeBase(id: string, updates: KnowledgeBaseUpdate) {
        try {
            const { data, error } = await this.supabase
                .from('knowledge_bases')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            console.log(`✅ Updated knowledge base: ${id}`);
            return { success: true, data };

        } catch (error: any) {
            console.error('Error updating knowledge base:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a knowledge base
     */
    async deleteKnowledgeBase(id: string) {
        try {
            const { error } = await this.supabase
                .from('knowledge_bases')
                .delete()
                .eq('id', id);

            if (error) throw error;

            console.log(`✅ Deleted knowledge base: ${id}`);
            return { success: true };

        } catch (error: any) {
            console.error('Error deleting knowledge base:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add a document to a knowledge base
     */
    async addDocument(data: DocumentCreate) {
        try {
            const documentId = await this.ragEngine.addDocument(
                data.knowledge_base_id,
                data.title,
                data.content,
                data.source_type,
                data.source_url,
                data.metadata
            );

            if (!documentId) {
                throw new Error('Failed to add document');
            }

            console.log(`✅ Added document: ${data.title}`);
            return { success: true, data: { id: documentId } };

        } catch (error: any) {
            console.error('Error adding document:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all documents in a knowledge base
     */
    async listDocuments(knowledgeBaseId: string) {
        try {
            const documents = await this.ragEngine.listDocuments(knowledgeBaseId);
            return { success: true, data: documents };

        } catch (error: any) {
            console.error('Error listing documents:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a document
     */
    async deleteDocument(documentId: string) {
        try {
            const success = await this.ragEngine.deleteDocument(documentId);

            if (!success) {
                throw new Error('Failed to delete document');
            }

            return { success: true };

        } catch (error: any) {
            console.error('Error deleting document:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Search within a knowledge base
     */
    async searchKnowledgeBase(knowledgeBaseId: string, query: string) {
        try {
            const results = await this.ragEngine.queryKnowledgeBase(
                knowledgeBaseId,
                query,
                5, // Top 5 results
                0.6 // 60% similarity threshold
            );

            return { success: true, data: results };

        } catch (error: any) {
            console.error('Error searching knowledge base:', error);
            return { success: false, error: error.message };
        }
    }
}
