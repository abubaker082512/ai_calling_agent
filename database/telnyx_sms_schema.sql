-- Telnyx SMS Database Schema
-- Tables for storing SMS messages, campaigns, and analytics

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Table: telnyx_sms
-- Stores individual SMS messages
CREATE TABLE IF NOT EXISTS telnyx_sms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    from_number VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'queued',
    cost DECIMAL(10, 4) DEFAULT 0,
    campaign_id UUID,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: telnyx_sms_campaigns
-- Stores bulk SMS campaigns
CREATE TABLE IF NOT EXISTS telnyx_sms_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Indexes for telnyx_sms
CREATE INDEX IF NOT EXISTS idx_telnyx_sms_message_id ON telnyx_sms(message_id);
CREATE INDEX IF NOT EXISTS idx_telnyx_sms_to_number ON telnyx_sms(to_number);
CREATE INDEX IF NOT EXISTS idx_telnyx_sms_status ON telnyx_sms(status);
CREATE INDEX IF NOT EXISTS idx_telnyx_sms_campaign_id ON telnyx_sms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_telnyx_sms_created_at ON telnyx_sms(created_at DESC);

-- Indexes for telnyx_sms_campaigns
CREATE INDEX IF NOT EXISTS idx_telnyx_sms_campaigns_status ON telnyx_sms_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_telnyx_sms_campaigns_created_at ON telnyx_sms_campaigns(created_at DESC);

-- =====================================================
-- VIEWS
-- =====================================================

-- View: telnyx_sms_analytics
-- Provides SMS analytics and statistics
CREATE OR REPLACE VIEW telnyx_sms_analytics AS
SELECT
    COUNT(*) as total_sms,
    COUNT(CASE WHEN status = 'sent' OR status = 'delivered' THEN 1 END) as sent_count,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    ROUND(
        CASE 
            WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN status = 'delivered' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100 
            ELSE 0 
        END, 
        2
    ) as delivery_rate_percent,
    SUM(cost) as total_cost,
    ROUND(AVG(cost), 4) as avg_cost_per_sms,
    DATE_TRUNC('day', created_at) as date
FROM telnyx_sms
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- View: telnyx_sms_recent
-- Shows recent SMS messages
CREATE OR REPLACE VIEW telnyx_sms_recent AS
SELECT
    id,
    message_id,
    to_number,
    from_number,
    LEFT(message, 50) || CASE WHEN LENGTH(message) > 50 THEN '...' ELSE '' END as message_preview,
    status,
    cost,
    campaign_id,
    sent_at,
    delivered_at,
    created_at
FROM telnyx_sms
ORDER BY created_at DESC
LIMIT 100;

-- View: telnyx_sms_campaign_summary
-- Provides campaign summary statistics
CREATE OR REPLACE VIEW telnyx_sms_campaign_summary AS
SELECT
    c.id,
    c.name,
    c.total_recipients,
    c.sent_count,
    c.delivered_count,
    c.failed_count,
    c.total_cost,
    c.status,
    c.created_at,
    c.completed_at,
    ROUND(
        CASE 
            WHEN c.total_recipients > 0 
            THEN (c.delivered_count::DECIMAL / c.total_recipients::DECIMAL) * 100 
            ELSE 0 
        END, 
        2
    ) as delivery_rate_percent,
    ROUND(
        CASE 
            WHEN c.sent_count > 0 
            THEN c.total_cost / c.sent_count 
            ELSE 0 
        END, 
        4
    ) as avg_cost_per_sms
FROM telnyx_sms_campaigns c
ORDER BY c.created_at DESC;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Function: update_updated_at_column
-- Updates the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for telnyx_sms
DROP TRIGGER IF EXISTS update_telnyx_sms_updated_at ON telnyx_sms;
CREATE TRIGGER update_telnyx_sms_updated_at
    BEFORE UPDATE ON telnyx_sms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for telnyx_sms_campaigns
DROP TRIGGER IF EXISTS update_telnyx_sms_campaigns_updated_at ON telnyx_sms_campaigns;
CREATE TRIGGER update_telnyx_sms_campaigns_updated_at
    BEFORE UPDATE ON telnyx_sms_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- GRANTS (Optional - adjust based on your security needs)
-- =====================================================

-- Grant permissions to authenticated users
-- GRANT SELECT, INSERT, UPDATE ON telnyx_sms TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON telnyx_sms_campaigns TO authenticated;
-- GRANT SELECT ON telnyx_sms_analytics TO authenticated;
-- GRANT SELECT ON telnyx_sms_recent TO authenticated;
-- GRANT SELECT ON telnyx_sms_campaign_summary TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE telnyx_sms IS 'Stores individual SMS messages sent via Telnyx';
COMMENT ON TABLE telnyx_sms_campaigns IS 'Stores bulk SMS campaign information';
COMMENT ON VIEW telnyx_sms_analytics IS 'Provides daily SMS analytics and statistics';
COMMENT ON VIEW telnyx_sms_recent IS 'Shows the 100 most recent SMS messages';
COMMENT ON VIEW telnyx_sms_campaign_summary IS 'Provides summary statistics for SMS campaigns';

-- =====================================================
-- SAMPLE QUERIES
-- =====================================================

-- Get today's SMS statistics
-- SELECT * FROM telnyx_sms_analytics WHERE date = CURRENT_DATE;

-- Get recent messages
-- SELECT * FROM telnyx_sms_recent LIMIT 20;

-- Get campaign summary
-- SELECT * FROM telnyx_sms_campaign_summary;

-- Get failed messages
-- SELECT * FROM telnyx_sms WHERE status = 'failed' ORDER BY created_at DESC;

-- Get messages for a specific campaign
-- SELECT * FROM telnyx_sms WHERE campaign_id = 'your-campaign-id' ORDER BY created_at DESC;
