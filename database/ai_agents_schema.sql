-- AI Agents Table Schema
-- This creates the table for storing AI agent configurations

-- AI Agents Table
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    voice TEXT DEFAULT 'AWS.Polly.Joanna-Neural',
    system_prompt TEXT NOT NULL,
    greeting TEXT DEFAULT 'Hello! How can I help you today?',
    personality JSONB DEFAULT '{}',
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,
    background_noise TEXT DEFAULT 'none',
    noise_level INTEGER DEFAULT 10,
    temperature DECIMAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 150,
    interruption_enabled BOOLEAN DEFAULT true,
    silence_timeout INTEGER DEFAULT 3000,
    max_duration INTEGER DEFAULT 1800,
    recording_enabled BOOLEAN DEFAULT true,
    transcription_enabled BOOLEAN DEFAULT true,
    webhook_url TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Metrics Table
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    average_duration_seconds DECIMAL DEFAULT 0,
    total_duration_seconds DECIMAL DEFAULT 0,
    average_sentiment DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, date)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON ai_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON ai_agents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_kb_id ON ai_agents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_metrics_agent_id ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON agent_metrics(date DESC);

-- Updated timestamp trigger function (reuse from knowledge_base_schema.sql if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER update_ai_agents_updated_at
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_metrics_updated_at ON agent_metrics;
CREATE TRIGGER update_agent_metrics_updated_at
    BEFORE UPDATE ON agent_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (development mode)
DROP POLICY IF EXISTS "Enable all for ai_agents" ON ai_agents;
CREATE POLICY "Enable all for ai_agents"
    ON ai_agents
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for agent_metrics" ON agent_metrics;
CREATE POLICY "Enable all for agent_metrics"
    ON agent_metrics
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- TODO: In production, replace with proper auth-based policies:
-- CREATE POLICY "Users can view own agents"
--     ON ai_agents FOR SELECT
--     USING (auth.uid()::text = user_id);

COMMENT ON TABLE ai_agents IS 'Stores AI agent configurations';
COMMENT ON TABLE agent_metrics IS 'Stores daily performance metrics for agents';
