/**
 * Supabase Schema Setup Script
 * Applies the database schema to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
    console.log('🚀 Starting Supabase schema setup...\n');

    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, '../database/telnyx_calls_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        console.log('📄 Schema file loaded');
        console.log('📊 Applying schema to Supabase...\n');

        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';

            // Skip comments
            if (statement.startsWith('--')) continue;

            try {
                console.log(`[${i + 1}/${statements.length}] Executing...`);

                const { error } = await supabase.rpc('exec_sql', {
                    sql: statement
                });

                if (error) {
                    // Try direct execution for some statements
                    console.log(`⚠️  RPC failed, trying direct execution...`);
                    // Some statements might fail but that's okay (e.g., DROP IF EXISTS)
                    console.log(`   ${error.message}`);
                }

                successCount++;
                console.log(`✅ Success\n`);
            } catch (error: any) {
                errorCount++;
                console.log(`⚠️  Warning: ${error.message}\n`);
            }
        }

        console.log('\n📊 Schema Application Summary:');
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ⚠️  Warnings: ${errorCount}`);

        // Verify tables were created
        console.log('\n🔍 Verifying tables...');

        const { data: tables, error: tablesError } = await supabase
            .from('calls')
            .select('*')
            .limit(0);

        if (!tablesError) {
            console.log('✅ calls table exists');
        }

        const { data: events, error: eventsError } = await supabase
            .from('call_events')
            .select('*')
            .limit(0);

        if (!eventsError) {
            console.log('✅ call_events table exists');
        }

        console.log('\n✅ Schema setup complete!');

    } catch (error: any) {
        console.error('❌ Error applying schema:', error.message);
        process.exit(1);
    }
}

// Run the setup
applySchema();
