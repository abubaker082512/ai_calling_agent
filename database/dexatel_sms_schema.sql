-- Dexatel SMS Database Schema
-- Tables for storing SMS messages and campaigns

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dexatel SMS Table
-- Stores all SMS messages
CREATE TABLE IF NOT EXISTS dexatel_sms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    from_sender VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    cost DECIMAL(10, 4) DEFAULT 0,
    campaign_id UUID,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Dexatel SMS Campaigns Table
-- Stores bulk SMS campaigns
CREATE TABLE IF NOT EXISTS dexatel_sms_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Dexatel SMS Recipients Table
-- Stores individual recipients for campaigns
CREATE TABLE IF NOT EXISTS dexatel_sms_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    message_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (campaign_id) REFERENCES dexatel_sms_campaigns(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dexatel_sms_message_id ON dexatel_sms(message_id);
CREATE INDEX IF NOT EXISTS idx_dexatel_sms_to_number ON dexatel_sms(to_number);
CREATE INDEX IF NOT EXISTS idx_dexatel_sms_status ON dexatel_sms(status);
CREATE INDEX IF NOT EXISTS idx_dexatel_sms_campaign_id ON dexatel_sms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dexatel_sms_created_at ON dexatel_sms(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dexatel_sms_campaigns_status ON dexatel_sms_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_dexatel_sms_campaigns_created_at ON dexatel_sms_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dexatel_sms_recipients_campaign_id ON dexatel_sms_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dexatel_sms_recipients_status ON dexatel_sms_recipients(status);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_dexatel_sms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dexatel_sms_updated_at
    BEFORE UPDATE ON dexatel_sms
    FOR EACH ROW
    EXECUTE FUNCTION update_dexatel_sms_updated_at();

CREATE TRIGGER trigger_update_dexatel_sms_campaigns_updated_at
    BEFORE UPDATE ON dexatel_sms_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_dexatel_sms_updated_at();

-- Analytics Views

-- SMS Analytics View
CREATE OR REPLACE VIEW dexatel_sms_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_sms,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    SUM(cost) as total_cost,
    AVG(cost) as avg_cost
FROM dexatel_sms
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Recent SMS View
CREATE OR REPLACE VIEW dexatel_sms_recent AS
SELECT 
    message_id,
    to_number,
    from_sender,
    message,
    status,
    cost,
    sent_at,
    created_at
FROM dexatel_sms
ORDER BY created_at DESC
LIMIT 100;

-- Campaign Stats View
CREATE OR REPLACE VIEW dexatel_campaign_stats AS
SELECT 
    id,
    name,
    total_recipients,
    sent_count,
    delivered_count,
    failed_count,
    total_cost,
    status,
    created_at,
    CASE 
        WHEN total_recipients > 0 THEN (delivered_count::FLOAT / total_recipients * 100)
        ELSE 0 
    END as delivery_rate
FROM dexatel_sms_campaigns
ORDER BY created_at DESC;

-- Overall SMS Stats View
CREATE OR REPLACE VIEW dexatel_sms_overall_stats AS
SELECT 
    COUNT(*) as total_sms,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    SUM(cost) as total_cost,
    AVG(cost) as avg_cost,
    MAX(created_at) as last_sms_at
FROM dexatel_sms;

-- Comments
COMMENT ON TABLE dexatel_sms IS 'Stores all Dexatel SMS messages';
COMMENT ON TABLE dexatel_sms_campaigns IS 'Stores bulk SMS campaigns';
COMMENT ON TABLE dexatel_sms_recipients IS 'Stores campaign recipients';

COMMENT ON COLUMN dexatel_sms.message_id IS 'Unique message ID from Dexatel';
COMMENT ON COLUMN dexatel_sms.status IS 'SMS status: sent, delivered, failed';
COMMENT ON COLUMN dexatel_sms.cost IS 'SMS cost in USD';

COMMENT ON COLUMN dexatel_sms_campaigns.status IS 'Campaign status: pending, sending, sent, completed, failed';
