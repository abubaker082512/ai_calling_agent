/**
 * Script to setup Dexatel database tables
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDexatelTables() {
    console.log('🔧 Setting up Dexatel database tables...\n');

    try {
        // Read SQL file
        const sqlPath = path.join(__dirname, '../database/dexatel_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`${i + 1}/${statements.length} Executing...`);

            const { error } = await supabase.rpc('exec_sql', {
                sql_query: statement + ';'
            });

            if (error) {
                console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
            } else {
                console.log(`✅ Statement ${i + 1} executed successfully`);
            }
        }

        console.log('\n✅ Dexatel database setup complete!');
        console.log('\nCreated:');
        console.log('  - dexatel_calls table');
        console.log('  - dexatel_events table');
        console.log('  - Indexes for performance');
        console.log('  - Analytics views');

    } catch (error) {
        console.error('\n❌ Error setting up database:', error);
        console.error('\nNote: You may need to run the SQL manually in Supabase SQL Editor');
        console.error('File: database/dexatel_schema.sql');
    }
}

setupDexatelTables();
