-- ============================================
-- Conversation Templates System
-- ============================================

-- Templates table for reusable conversation prompts
CREATE TABLE IF NOT EXISTS conversation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general', -- 'sales', 'support', 'general', 'custom'
    system_prompt TEXT NOT NULL,
    greeting TEXT,
    example_questions JSONB DEFAULT '[]', -- Array of sample questions
    tags TEXT[] DEFAULT '{}', -- For filtering
    is_public BOOLEAN DEFAULT false, -- Share with community
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_user ON conversation_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON conversation_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_public ON conversation_templates(is_public);

-- RLS Policies
ALTER TABLE conversation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
    ON conversation_templates FOR SELECT
    USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create their own templates"
    ON conversation_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
    ON conversation_templates FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
    ON conversation_templates FOR DELETE
    USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON conversation_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample templates (optional)
INSERT INTO conversation_templates (user_id, name, description, category, system_prompt, greeting, example_questions, tags, is_public)
VALUES 
(
    (SELECT id FROM auth.users LIMIT 1),
    'Sales Assistant',
    'Friendly sales agent for product inquiries',
    'sales',
    'You are a helpful sales assistant. Be enthusiastic, knowledgeable about products, and guide customers to make informed decisions. Always be professional and courteous.',
    'Hello! Thank you for your interest. How can I help you find the perfect product today?',
    '["What products do you offer?", "Can you tell me about pricing?", "Do you have any promotions?"]'::jsonb,
    ARRAY['sales', 'products', 'customer-service'],
    true
),
(
    (SELECT id FROM auth.users LIMIT 1),
    'Customer Support',
    'Technical support agent for troubleshooting',
    'support',
    'You are a patient and helpful customer support agent. Listen carefully to customer issues, ask clarifying questions, and provide step-by-step solutions. Be empathetic and professional.',
    'Hello! I''m here to help resolve any issues you''re experiencing. What seems to be the problem?',
    '["I''m having trouble with...", "How do I...", "Can you help me with..."]'::jsonb,
    ARRAY['support', 'technical', 'troubleshooting'],
    true
),
(
    (SELECT id FROM auth.users LIMIT 1),
    'Appointment Scheduler',
    'Schedule appointments and manage calendar',
    'general',
    'You are an efficient appointment scheduler. Help customers book appointments, check availability, and confirm details. Be organized and clear about dates and times.',
    'Hello! I can help you schedule an appointment. What date and time works best for you?',
    '["What times are available?", "Can I book for next week?", "I need to reschedule"]'::jsonb,
    ARRAY['scheduling', 'appointments', 'calendar'],
    true
);
