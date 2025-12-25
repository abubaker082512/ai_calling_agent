-- Dexatel Database Schema
-- Tables for storing Dexatel call data and events

-- Dexatel Calls Table
CREATE TABLE IF NOT EXISTS dexatel_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(255) UNIQUE NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    from_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'initiated',
    duration INTEGER DEFAULT 0,
    cost DECIMAL(10, 4) DEFAULT 0,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    recording_url TEXT,
    stream_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Dexatel Events Table
CREATE TABLE IF NOT EXISTS dexatel_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    occurred_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (call_id) REFERENCES dexatel_calls(call_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dexatel_calls_call_id ON dexatel_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_dexatel_calls_status ON dexatel_calls(status);
CREATE INDEX IF NOT EXISTS idx_dexatel_calls_created_at ON dexatel_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dexatel_events_call_id ON dexatel_events(call_id);
CREATE INDEX IF NOT EXISTS idx_dexatel_events_event_type ON dexatel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_dexatel_events_occurred_at ON dexatel_events(occurred_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_dexatel_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dexatel_calls_updated_at
    BEFORE UPDATE ON dexatel_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_dexatel_calls_updated_at();

-- Analytics View
CREATE OR REPLACE VIEW dexatel_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_calls,
    SUM(duration) as total_duration,
    AVG(duration) as avg_duration,
    SUM(cost) as total_cost,
    AVG(cost) as avg_cost
FROM dexatel_calls
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Recent Calls View
CREATE OR REPLACE VIEW dexatel_recent_calls AS
SELECT 
    call_id,
    to_number,
    from_number,
    status,
    duration,
    cost,
    started_at,
    ended_at,
    created_at
FROM dexatel_calls
ORDER BY created_at DESC
LIMIT 100;

-- Call Stats View
CREATE OR REPLACE VIEW dexatel_call_stats AS
SELECT 
    COUNT(*) as total_calls,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_calls,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
    SUM(duration) as total_duration,
    AVG(duration) as avg_duration,
    SUM(cost) as total_cost,
    AVG(cost) as avg_cost,
    MAX(created_at) as last_call_at
FROM dexatel_calls;

-- Comments
COMMENT ON TABLE dexatel_calls IS 'Stores all Dexatel voice calls';
COMMENT ON TABLE dexatel_events IS 'Stores all Dexatel call events';
COMMENT ON COLUMN dexatel_calls.call_id IS 'Unique call ID from Dexatel';
COMMENT ON COLUMN dexatel_calls.status IS 'Call status: initiated, active, completed, failed, ended';
COMMENT ON COLUMN dexatel_calls.duration IS 'Call duration in seconds';
COMMENT ON COLUMN dexatel_calls.cost IS 'Call cost in USD';
COMMENT ON COLUMN dexatel_events.event_type IS 'Event type: call.initiated, call.answered, call.ended, etc.';
