#!/usr/bin/env node
/**
 * Quick API Test - Render Deployment
 * Tests if all APIs are working after database setup
 */

const API_URL = 'https://ai-calling-agent-q1qf.onrender.com';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAPI(endpoint, expectedStatus = 200) {
    const url = `${API_URL}${endpoint}`;

    try {
        const response = await fetch(url);
        const isSuccess = response.status === expectedStatus;

        if (isSuccess) {
            log(`✅ ${endpoint} - ${response.status}`, 'green');
            try {
                const data = await response.json();
                console.log('   Response:', JSON.stringify(data).substring(0, 100) + '...');
            } catch (e) {
                // Not JSON, that's ok
            }
        } else {
            log(`❌ ${endpoint} - Expected ${expectedStatus}, got ${response.status}`, 'red');
        }

        return isSuccess;
    } catch (error) {
        log(`❌ ${endpoint} - ${error.message}`, 'red');
        return false;
    }
}

async function runQuickTest() {
    log('\n🚀 Testing Render Deployment...', 'blue');
    log(`URL: ${API_URL}\n`, 'yellow');

    const results = [];

    // Test critical endpoints
    log('Testing APIs:', 'blue');
    results.push(await testAPI('/api/stats'));
    results.push(await testAPI('/api/agents'));
    results.push(await testAPI('/api/knowledge-bases'));

    // Summary
    const passed = results.filter(r => r).length;
    const total = results.length;

    log('\n' + '='.repeat(50), 'blue');
    if (passed === total) {
        log('🎉 ALL TESTS PASSED!', 'green');
        log('Your system is fully functional!', 'green');
        log('\nNext steps:', 'yellow');
        log('1. Visit: https://ai-calling-agent-q1qf.onrender.com/dashboard/', 'reset');
        log('2. Create your first knowledge base', 'reset');
        log('3. Create your first AI agent', 'reset');
        log('4. Test the agent!', 'reset');
    } else {
        log(`⚠️  ${total - passed} tests failed`, 'red');
        log('\nIf /api/agents or /api/knowledge-bases failed:', 'yellow');
        log('→ Run ai_agents_schema.sql in Supabase', 'yellow');
        log('→ Verify tables exist in Table Editor', 'yellow');
    }
    log('='.repeat(50) + '\n', 'blue');
}

runQuickTest();
