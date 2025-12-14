-- Telnyx Call Events and Calls Schema
-- Stores all webhook events and call records

-- Table: calls
-- Main call records table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_control_id TEXT UNIQUE NOT NULL,
    call_session_id TEXT,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
    status TEXT CHECK (status IN ('initiated', 'answered', 'ended', 'failed')),
    hangup_cause TEXT,
    hangup_source TEXT,
    started_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: call_events
-- Stores all Telnyx webhook events
CREATE TABLE IF NOT EXISTS call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    call_control_id TEXT NOT NULL,
    call_session_id TEXT,
    from_number TEXT,
    to_number TEXT,
    direction TEXT,
    state TEXT,
    hangup_cause TEXT,
    hangup_source TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_call_control_id ON calls(call_control_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number);
CREATE INDEX IF NOT EXISTS idx_calls_to_number ON calls(to_number);

CREATE INDEX IF NOT EXISTS idx_call_events_call_control_id ON call_events(call_control_id);
CREATE INDEX IF NOT EXISTS idx_call_events_event_type ON call_events(event_type);
CREATE INDEX IF NOT EXISTS idx_call_events_occurred_at ON call_events(occurred_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
CREATE TRIGGER update_calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate call duration
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND NEW.answered_at IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-calculate duration
DROP TRIGGER IF EXISTS calculate_calls_duration ON calls;
CREATE TRIGGER calculate_calls_duration
    BEFORE UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION calculate_call_duration();

-- Row Level Security (RLS)
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;

-- Policies (permissive for development)
DROP POLICY IF EXISTS "Enable all access for calls" ON calls;
CREATE POLICY "Enable all access for calls" ON calls
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for call_events" ON call_events;
CREATE POLICY "Enable all access for call_events" ON call_events
    FOR ALL USING (true) WITH CHECK (true);

-- Sample queries for testing
-- SELECT * FROM calls ORDER BY started_at DESC LIMIT 10;
-- SELECT * FROM call_events ORDER BY occurred_at DESC LIMIT 20;
-- SELECT event_type, COUNT(*) FROM call_events GROUP BY event_type;
