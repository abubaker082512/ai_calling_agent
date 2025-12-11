#!/usr/bin/env node
/**
 * API Test Script
 * Tests all critical API endpoints to verify they're working
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

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

async function testEndpoint(method, endpoint, body = null, expectedStatus = 200) {
    const url = `${API_URL}${endpoint}`;

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json().catch(() => null);

        if (response.status === expectedStatus) {
            log(`✅ ${method} ${endpoint} - ${response.status}`, 'green');
            return { success: true, data, status: response.status };
        } else {
            log(`❌ ${method} ${endpoint} - Expected ${expectedStatus}, got ${response.status}`, 'red');
            if (data) {
                console.log('   Response:', data);
            }
            return { success: false, data, status: response.status };
        }
    } catch (error) {
        log(`❌ ${method} ${endpoint} - ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function runTests() {
    log('\n🚀 Starting API Tests...', 'blue');
    log(`Testing API at: ${API_URL}\n`, 'yellow');

    const results = {
        passed: 0,
        failed: 0
    };

    // Test 1: Health Check
    log('\n📊 Test 1: Health Check', 'blue');
    const health = await testEndpoint('GET', '/api/stats');
    results[health.success ? 'passed' : 'failed']++;

    // Test 2: List Agents (should return empty array or agents)
    log('\n🤖 Test 2: List Agents', 'blue');
    const listAgents = await testEndpoint('GET', '/api/agents');
    results[listAgents.success ? 'passed' : 'failed']++;

    // Test 3: Create Agent
    log('\n🤖 Test 3: Create Agent', 'blue');
    const createAgent = await testEndpoint('POST', '/api/agents', {
        name: 'Test Agent',
        system_prompt: 'You are a helpful assistant.',
        voice: 'AWS.Polly.Joanna-Neural',
        greeting: 'Hello! How can I help you?',
        is_active: true
    }, 201);
    results[createAgent.success ? 'passed' : 'failed']++;

    let agentId = null;
    if (createAgent.success && createAgent.data) {
        agentId = createAgent.data.id;
        log(`   Created agent with ID: ${agentId}`, 'green');
    }

    // Test 4: Get Agent (if created)
    if (agentId) {
        log('\n🤖 Test 4: Get Agent', 'blue');
        const getAgent = await testEndpoint('GET', `/api/agents/${agentId}`);
        results[getAgent.success ? 'passed' : 'failed']++;
    }

    // Test 5: List Knowledge Bases
    log('\n📚 Test 5: List Knowledge Bases', 'blue');
    const listKBs = await testEndpoint('GET', '/api/knowledge-bases');
    results[listKBs.success ? 'passed' : 'failed']++;

    // Test 6: Create Knowledge Base
    log('\n📚 Test 6: Create Knowledge Base', 'blue');
    const createKB = await testEndpoint('POST', '/api/knowledge-bases', {
        name: 'Test Knowledge Base',
        description: 'A test knowledge base'
    }, 201);
    results[createKB.success ? 'passed' : 'failed']++;

    let kbId = null;
    if (createKB.success && createKB.data) {
        kbId = createKB.data.id;
        log(`   Created KB with ID: ${kbId}`, 'green');
    }

    // Test 7: Add Document to KB (if created)
    if (kbId) {
        log('\n📚 Test 7: Add Document to KB', 'blue');
        const addDoc = await testEndpoint('POST', `/api/knowledge-bases/${kbId}/documents`, {
            title: 'Test Document',
            content: 'This is a test document with some content about our product.'
        }, 201);
        results[addDoc.success ? 'passed' : 'failed']++;
    }

    // Test 8: List Documents (if KB created)
    if (kbId) {
        log('\n📚 Test 8: List Documents', 'blue');
        const listDocs = await testEndpoint('GET', `/api/knowledge-bases/${kbId}/documents`);
        results[listDocs.success ? 'passed' : 'failed']++;
    }

    // Test 9: Analytics Overview
    log('\n📊 Test 9: Analytics Overview', 'blue');
    const analytics = await testEndpoint('GET', '/api/analytics/overview?days=30');
    results[analytics.success ? 'passed' : 'failed']++;

    // Test 10: List Templates
    log('\n📝 Test 10: List Templates', 'blue');
    const templates = await testEndpoint('GET', '/api/templates');
    results[templates.success ? 'passed' : 'failed']++;

    // Cleanup: Delete created resources
    if (agentId) {
        log('\n🧹 Cleanup: Delete Test Agent', 'yellow');
        await testEndpoint('DELETE', `/api/agents/${agentId}`);
    }

    if (kbId) {
        log('🧹 Cleanup: Delete Test KB', 'yellow');
        await testEndpoint('DELETE', `/api/knowledge-bases/${kbId}`);
    }

    // Summary
    log('\n' + '='.repeat(50), 'blue');
    log('📊 Test Summary', 'blue');
    log('='.repeat(50), 'blue');
    log(`✅ Passed: ${results.passed}`, 'green');
    log(`❌ Failed: ${results.failed}`, 'red');
    log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%\n`, 'yellow');

    if (results.failed === 0) {
        log('🎉 All tests passed! API is fully functional.', 'green');
        process.exit(0);
    } else {
        log('⚠️  Some tests failed. Check the errors above.', 'red');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
});
