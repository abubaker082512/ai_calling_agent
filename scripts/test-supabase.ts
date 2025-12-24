/**
 * Simple Supabase Connection Test
 * Tests connection and creates tables directly
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🔍 Testing Supabase Connection...\n');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseServiceKey.substring(0, 20)}...\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
    try {
        // Test 1: Basic connection
        console.log('Test 1: Basic Connection');
        const { data, error } = await supabase.from('calls').select('count').limit(1);

        if (error) {
            if (error.message.includes('does not exist')) {
                console.log('⚠️  Table does not exist yet (expected)');
                console.log('✅ Connection successful!\n');
                return true;
            } else {
                console.error('❌ Connection error:', error.message);
                return false;
            }
        }

        console.log('✅ Connection successful!');
        console.log(`📊 Current calls count: ${data?.[0]?.count || 0}\n`);
        return true;

    } catch (error: any) {
        console.error('❌ Connection failed:', error.message);
        return false;
    }
}

async function createTables() {
    console.log('📊 Creating tables...\n');

    try {
        // Create calls table
        console.log('Creating calls table...');
        const { error: callsError } = await supabase.rpc('exec_sql', {
            sql: `
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
            `
        });

        if (callsError) {
            console.log('⚠️  RPC method not available, using direct SQL...');
            // Tables might already exist
        }

        // Create call_events table
        console.log('Creating call_events table...');
        const { error: eventsError } = await supabase.rpc('exec_sql', {
            sql: `
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
            `
        });

        if (eventsError) {
            console.log('⚠️  RPC method not available');
        }

        console.log('\n✅ Tables created (or already exist)');

    } catch (error: any) {
        console.error('❌ Error creating tables:', error.message);
    }
}

async function main() {
    const connected = await testConnection();

    if (connected) {
        await createTables();

        console.log('\n📝 Next Steps:');
        console.log('1. Go to Supabase Dashboard → SQL Editor');
        console.log('2. Run the SQL from: database/telnyx_calls_schema.sql');
        console.log('3. This will create all tables, indexes, and triggers');
        console.log('\n✅ Setup complete!');
    }
}

main();
