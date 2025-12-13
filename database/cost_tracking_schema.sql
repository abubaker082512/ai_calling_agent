-- Cost Tracking Schema
-- Adds cost tracking fields to existing tables

-- Add cost fields to calls table (if it exists)
-- Note: Adjust table name based on your actual calls/sessions table

-- For agent_metrics table (call tracking)
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS llm_cost DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS tts_cost DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS stt_cost DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS telephony_cost DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS tts_characters INTEGER DEFAULT 0;

-- Create cost_tracking table for detailed cost analytics
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

-- Indexes for cost tracking
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_period ON cost_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created ON cost_tracking(created_at DESC);

-- Updated timestamp trigger
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

-- Create function to calculate call cost
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
    -- Calculate costs based on usage
    -- LLM: $0.001 per 1K tokens (Gemini Flash pricing)
    v_llm_cost := (p_tokens::DECIMAL / 1000) * 0.001;
    
    -- TTS: $0.015 per 1M characters (AWS Polly Neural pricing)
    v_tts_cost := (p_tts_chars::DECIMAL / 1000000) * 0.015;
    
    -- STT: $0.006 per minute (Deepgram pricing)
    v_duration_minutes := p_duration_seconds::DECIMAL / 60;
    v_stt_cost := v_duration_minutes * 0.006;
    
    -- Telephony: $0.013 per minute (Telnyx pricing)
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

COMMENT ON TABLE cost_tracking IS 'Monthly cost tracking and analytics';
COMMENT ON FUNCTION calculate_call_cost IS 'Calculate cost breakdown for a call based on usage metrics';
