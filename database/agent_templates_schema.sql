-- Agent Templates Schema
-- This creates the table for storing pre-built agent templates

-- Agent Templates Table
CREATE TABLE IF NOT EXISTS agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'sales', 'support', 'scheduler', 'qualifier', 'survey', 'custom'
    icon TEXT DEFAULT '🤖',
    system_prompt TEXT NOT NULL,
    greeting TEXT DEFAULT 'Hello! How can I help you today?',
    voice TEXT DEFAULT 'AWS.Polly.Joanna-Neural',
    voice_speed DECIMAL DEFAULT 1.0,
    voice_pitch INTEGER DEFAULT 0,
    personality JSONB DEFAULT '{}',
    sample_conversation JSONB DEFAULT '[]', -- Array of sample messages
    settings JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_templates_category ON agent_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_public ON agent_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_featured ON agent_templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON agent_templates(created_at DESC);

-- Updated timestamp trigger (reuse from previous schemas)
DROP TRIGGER IF EXISTS update_agent_templates_updated_at ON agent_templates;
CREATE TRIGGER update_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (development mode)
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
);

COMMENT ON TABLE agent_templates IS 'Pre-built agent templates for quick agent creation';
COMMENT ON COLUMN agent_templates.category IS 'Template category: sales, support, scheduler, qualifier, survey, custom';
COMMENT ON COLUMN agent_templates.sample_conversation IS 'Sample conversation to preview template behavior';
COMMENT ON COLUMN agent_templates.usage_count IS 'Number of times this template has been used to create agents';
