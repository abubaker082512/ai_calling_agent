-- Knowledge Base System Schema
-- This creates tables for storing knowledge bases and their documents with vector embeddings

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Bases Table
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents Table
CREATE TABLE IF NOT EXISTS kb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT DEFAULT 'text', -- 'text', 'file', 'url'
    source_url TEXT,
    embedding vector(768), -- Gemini embedding dimension
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kb_user_id ON knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_created_at ON knowledge_bases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_kb_id ON kb_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_docs_embedding ON kb_documents USING ivfflat (embedding vector_cosine_ops);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON knowledge_bases;
CREATE TRIGGER update_knowledge_bases_updated_at
    BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kb_documents_updated_at ON kb_documents;
CREATE TRIGGER update_kb_documents_updated_at
    BEFORE UPDATE ON kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Note: For development, we'll disable RLS or use simpler policies
-- In production, implement proper authentication with Supabase Auth

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (disable in production!)
-- Replace these with proper auth-based policies when implementing authentication

DROP POLICY IF EXISTS "Enable all for knowledge_bases" ON knowledge_bases;
CREATE POLICY "Enable all for knowledge_bases"
    ON knowledge_bases
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for kb_documents" ON kb_documents;
CREATE POLICY "Enable all for kb_documents"
    ON kb_documents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- TODO: In production, replace with these policies:
-- CREATE POLICY "Users can view own knowledge bases"
--     ON knowledge_bases FOR SELECT
--     USING (auth.uid()::text = user_id);
-- 
-- CREATE POLICY "Users can insert own knowledge bases"
--     ON knowledge_bases FOR INSERT
--     WITH CHECK (auth.uid()::text = user_id);

-- Function to search documents by similarity
CREATE OR REPLACE FUNCTION search_documents(
    kb_id UUID,
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb_documents.id,
        kb_documents.title,
        kb_documents.content,
        1 - (kb_documents.embedding <=> query_embedding) AS similarity
    FROM kb_documents
    WHERE kb_documents.knowledge_base_id = kb_id
        AND 1 - (kb_documents.embedding <=> query_embedding) > match_threshold
    ORDER BY kb_documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Sample data (optional - comment out if not needed)
-- INSERT INTO knowledge_bases (user_id, name, description) VALUES
-- ('demo-user', 'Product Documentation', 'Documentation for our main product'),
-- ('demo-user', 'Customer FAQs', 'Frequently asked questions from customers');

COMMENT ON TABLE knowledge_bases IS 'Stores knowledge bases for AI agents';
COMMENT ON TABLE kb_documents IS 'Stores documents with vector embeddings for semantic search';
COMMENT ON FUNCTION search_documents IS 'Searches documents using vector similarity';