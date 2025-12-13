-- ============================================
-- COMPLETE DATABASE SCHEMA FOR AI CALLING AGENT
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. AI AGENTS SCHEMA
-- ============================================

-- AI Agents Table
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    voice TEXT DEFAULT 'AWS.Polly.Joanna-Neural',
    is_active BOOLEAN DEFAULT true,
    knowledge_base_id UUID,
    background_noise TEXT DEFAULT 'none',
    noise_level INTEGER DEFAULT 0,
    temperature DECIMAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 500,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Metrics Table
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    avg_call_duration INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    llm_cost DECIMAL(10, 4) DEFAULT 0,
    tts_cost DECIMAL(10, 4) DEFAULT 0,
    stt_cost DECIMAL(10, 4) DEFAULT 0,
    telephony_cost DECIMAL(10, 4) DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    tts_characters INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ai_agents
CREATE INDEX IF NOT EXISTS idx_agents_active ON ai_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_kb ON ai_agents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_agents_created ON ai_agents(created_at DESC);

-- Indexes for agent_metrics
CREATE INDEX IF NOT EXISTS idx_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON agent_metrics(created_at DESC);

-- Triggers for ai_agents
DROP TRIGGER IF EXISTS update_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER update_ai_agents_updated_at
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers for agent_metrics
DROP TRIGGER IF EXISTS update_agent_metrics_updated_at ON agent_metrics;
CREATE TRIGGER update_agent_metrics_updated_at
    BEFORE UPDATE ON agent_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for ai_agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for ai_agents" ON ai_agents;
CREATE POLICY "Enable all for ai_agents"
    ON ai_agents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- RLS for agent_metrics
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for agent_metrics" ON agent_metrics;
CREATE POLICY "Enable all for agent_metrics"
    ON agent_metrics
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 2. KNOWLEDGE BASE SCHEMA
-- ============================================

-- Knowledge Bases Table
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Base Documents Table
CREATE TABLE IF NOT EXISTS kb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for knowledge_bases
CREATE INDEX IF NOT EXISTS idx_kb_created ON knowledge_bases(created_at DESC);

-- Indexes for kb_documents
CREATE INDEX IF NOT EXISTS idx_kb_docs_kb ON kb_documents(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_embedding ON kb_documents USING ivfflat (embedding vector_cosine_ops);

-- Triggers for knowledge_bases
DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON knowledge_bases;
CREATE TRIGGER update_knowledge_bases_updated_at
    BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers for kb_documents
DROP TRIGGER IF EXISTS update_kb_documents_updated_at ON kb_documents;
CREATE TRIGGER update_kb_documents_updated_at
    BEFORE UPDATE ON kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for knowledge_bases
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for knowledge_bases" ON knowledge_bases;
CREATE POLICY "Enable all for knowledge_bases"
    ON knowledge_bases
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- RLS for kb_documents
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for kb_documents" ON kb_documents;
CREATE POLICY "Enable all for kb_documents"
    ON kb_documents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 3. AGENT TEMPLATES SCHEMA
-- ============================================

-- Agent Templates Table
CREATE TABLE IF NOT EXISTS agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    icon TEXT DEFAULT '🤖',
    system_prompt TEXT NOT NULL,
    greeting TEXT DEFAULT 'Hello! How can I help you today?',
    voice TEXT DEFAULT 'AWS.Polly.Joanna-Neural',
    voice_speed DECIMAL DEFAULT 1.0,
    voice_pitch INTEGER DEFAULT 0,
    personality JSONB DEFAULT '{}',
    sample_conversation JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_templates
CREATE INDEX IF NOT EXISTS idx_templates_category ON agent_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_public ON agent_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_featured ON agent_templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_created ON agent_templates(created_at DESC);

-- Trigger for agent_templates
DROP TRIGGER IF EXISTS update_agent_templates_updated_at ON agent_templates;
CREATE TRIGGER update_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for agent_templates
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for agent_templates" ON agent_templates;
CREATE POLICY "Enable all for agent_templates"
    ON agent_templates
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert default templates
INSERT INTO agent_templates (name, description, category, icon, system_prompt, greeting, voice, sample_conversation, settings, is_featured) VALUES
(
    'Sales Assistant',
    'Professional sales agent for product inquiries and lead qualification',
    'sales',
    '💼',
    'You are a professional sales assistant. Your goal is to understand customer needs, present product benefits, handle objections gracefully, and guide prospects toward a purchase decision. Be enthusiastic but not pushy. Listen actively and provide value in every interaction.',
    'Hi! Thanks for your interest in our products. I''d love to learn more about what you''re looking for. What brings you here today?',
    'AWS.Polly.Joanna-Neural',
    '[
        {"role": "assistant", "content": "Hi! Thanks for your interest. What brings you here today?"},
        {"role": "user", "content": "I''m looking for a CRM solution"},
        {"role": "assistant", "content": "Great! Let me ask a few questions to find the perfect fit for you..."}
    ]'::jsonb,
    '{
        "interruptionEnabled": true,
        "silenceTimeout": 3000,
        "maxDuration": 1800,
        "endCallPhrases": ["goodbye", "bye", "thank you", "not interested"],
        "voiceSpeed": 1.0,
        "voicePitch": 0
    }'::jsonb,
    true
),
(
    'Customer Support Agent',
    'Helpful support agent for troubleshooting and issue resolution',
    'support',
    '🛟',
    'You are a patient and helpful customer support agent. Your goal is to resolve customer issues quickly and effectively. Ask clarifying questions, provide step-by-step guidance, and escalate to human support when necessary. Always be empathetic and professional.',
    'Hello! I''m here to help resolve any issues you''re experiencing. Can you tell me what''s going on?',
    'AWS.Polly.Matthew-Neural',
    '[
        {"role": "assistant", "content": "Hello! What issue can I help you with today?"},
        {"role": "user", "content": "My account isn''t working"},
        {"role": "assistant", "content": "I understand that''s frustrating. Let me help you troubleshoot..."}
    ]'::jsonb,
    '{
        "interruptionEnabled": true,
        "silenceTimeout": 4000,
        "maxDuration": 2400,
        "endCallPhrases": ["goodbye", "bye", "thank you", "resolved"],
        "voiceSpeed": 0.95,
        "voicePitch": 0
    }'::jsonb,
    true
),
(
    'Appointment Scheduler',
    'Efficient scheduler for booking appointments and managing calendars',
    'scheduler',
    '📅',
    'You are an efficient appointment scheduler. Your goal is to book appointments quickly and accurately. Check availability, confirm details, and send confirmations. Be organized and detail-oriented. Always confirm the date, time, and any special requirements.',
    'Hi! I can help you schedule an appointment. What date and time works best for you?',
    'AWS.Polly.Kendra-Neural',
    '[
        {"role": "assistant", "content": "Hi! What date and time works for you?"},
        {"role": "user", "content": "Next Tuesday at 2pm"},
        {"role": "assistant", "content": "Perfect! Let me check availability for Tuesday at 2pm..."}
    ]'::jsonb,
    '{
        "interruptionEnabled": true,
        "silenceTimeout": 3500,
        "maxDuration": 1200,
        "endCallPhrases": ["goodbye", "bye", "thank you", "booked"],
        "voiceSpeed": 1.05,
        "voicePitch": 1
    }'::jsonb,
    true
),
(
    'Lead Qualifier',
    'Smart qualifier to assess lead quality using BANT framework',
    'qualifier',
    '🎯',
    'You are a lead qualification specialist. Your goal is to assess lead quality using the BANT framework (Budget, Authority, Need, Timeline). Ask strategic questions to determine if the prospect is a good fit. Be professional and efficient. Score leads based on their responses.',
    'Hello! I''d like to learn more about your needs to see if we''re a good fit. Do you have a few minutes?',
    'AWS.Polly.Joey-Neural',
    '[
        {"role": "assistant", "content": "Hello! Can I ask a few qualifying questions?"},
        {"role": "user", "content": "Sure, go ahead"},
        {"role": "assistant", "content": "Great! First, what''s your budget range for this solution?"}
    ]'::jsonb,
    '{
        "interruptionEnabled": true,
        "silenceTimeout": 3000,
        "maxDuration": 1500,
        "endCallPhrases": ["goodbye", "bye", "thank you", "qualified", "not qualified"],
        "voiceSpeed": 1.0,
        "voicePitch": 0
    }'::jsonb,
    true
),
(
    'Survey Conductor',
    'Friendly agent for conducting surveys and collecting feedback',
    'survey',
    '📊',
    'You are a friendly survey conductor. Your goal is to collect honest feedback through structured questions. Be neutral and non-leading in your questions. Thank participants for their time and input. Keep the survey moving at a good pace while allowing time for thoughtful responses.',
    'Hi! Thank you for participating in our survey. This will only take a few minutes. Ready to begin?',
    'AWS.Polly.Salli-Neural',
    '[
        {"role": "assistant", "content": "Hi! Ready to start the survey?"},
        {"role": "user", "content": "Yes, let''s do it"},
        {"role": "assistant", "content": "Great! First question: On a scale of 1-10, how satisfied are you..."}
    ]'::jsonb,
    '{
        "interruptionEnabled": false,
        "silenceTimeout": 5000,
        "maxDuration": 1800,
        "endCallPhrases": ["goodbye", "bye", "thank you", "done"],
        "voiceSpeed": 0.95,
        "voicePitch": 0
    }'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. COST TRACKING SCHEMA
-- ============================================

-- Cost Tracking Table
CREATE TABLE IF NOT EXISTS cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    llm_cost DECIMAL(10, 4) DEFAULT 0,
    tts_cost DECIMAL(10, 4) DEFAULT 0,
    stt_cost DECIMAL(10, 4) DEFAULT 0,
    telephony_cost DECIMAL(10, 4) DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    total_calls INTEGER DEFAULT 0,
    total_minutes DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cost_tracking
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_period ON cost_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created ON cost_tracking(created_at DESC);

-- Trigger for cost_tracking
DROP TRIGGER IF EXISTS update_cost_tracking_updated_at ON cost_tracking;
CREATE TRIGGER update_cost_tracking_updated_at
    BEFORE UPDATE ON cost_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for cost_tracking
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for cost_tracking" ON cost_tracking;
CREATE POLICY "Enable all for cost_tracking"
    ON cost_tracking
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Cost Calculation Function
CREATE OR REPLACE FUNCTION calculate_call_cost(
    p_tokens INTEGER,
    p_tts_chars INTEGER,
    p_duration_seconds INTEGER
) RETURNS TABLE (
    llm_cost DECIMAL,
    tts_cost DECIMAL,
    stt_cost DECIMAL,
    telephony_cost DECIMAL,
    total_cost DECIMAL
) AS $$
DECLARE
    v_llm_cost DECIMAL;
    v_tts_cost DECIMAL;
    v_stt_cost DECIMAL;
    v_telephony_cost DECIMAL;
    v_total_cost DECIMAL;
    v_duration_minutes DECIMAL;
BEGIN
    -- LLM: $0.001 per 1K tokens (Gemini Flash)
    v_llm_cost := (p_tokens::DECIMAL / 1000) * 0.001;
    
    -- TTS: $0.015 per 1M characters (AWS Polly Neural)
    v_tts_cost := (p_tts_chars::DECIMAL / 1000000) * 0.015;
    
    -- STT: $0.006 per minute (Deepgram)
    v_duration_minutes := p_duration_seconds::DECIMAL / 60;
    v_stt_cost := v_duration_minutes * 0.006;
    
    -- Telephony: $0.013 per minute (Telnyx)
    v_telephony_cost := v_duration_minutes * 0.013;
    
    -- Total cost
    v_total_cost := v_llm_cost + v_tts_cost + v_stt_cost + v_telephony_cost;
    
    RETURN QUERY SELECT 
        v_llm_cost,
        v_tts_cost,
        v_stt_cost,
        v_telephony_cost,
        v_total_cost;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ai_agents IS 'AI agents configuration and settings';
COMMENT ON TABLE agent_metrics IS 'Performance metrics for AI agents';
COMMENT ON TABLE knowledge_bases IS 'Knowledge base collections';
COMMENT ON TABLE kb_documents IS 'Documents within knowledge bases with vector embeddings';
COMMENT ON TABLE agent_templates IS 'Pre-built agent templates for quick agent creation';
COMMENT ON TABLE cost_tracking IS 'Monthly cost tracking and analytics';
COMMENT ON FUNCTION calculate_call_cost IS 'Calculate cost breakdown for a call based on usage metrics';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify all tables were created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('ai_agents', 'agent_metrics', 'knowledge_bases', 'kb_documents', 'agent_templates', 'cost_tracking')
ORDER BY table_name;

-- Verify templates were inserted
SELECT COUNT(*) as template_count FROM agent_templates;

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- All schemas have been created successfully!
-- You should see:
-- - 6 tables created
-- - 5 agent templates inserted
-- - All indexes and triggers in place
-- - RLS policies enabled
-- ============================================
