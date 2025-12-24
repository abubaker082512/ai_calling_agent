/**
 * API Test Script
 * Tests all Phase 2 endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAPIs() {
    console.log('🧪 Testing Phase 2 APIs...\n');

    try {
        // Test 1: Health Check
        console.log('1️⃣ Testing Health Check...');
        const health = await axios.get(`${BASE_URL}/api/health`);
        console.log('✅ Health:', health.data.status);
        console.log('');

        // Test 2: Telnyx Webhook Test Endpoint
        console.log('2️⃣ Testing Telnyx Webhook Endpoint...');
        const webhook = await axios.get(`${BASE_URL}/telnyx/events/test`);
        console.log('✅ Webhook:', webhook.data.message);
        console.log('   Orchestrator:', webhook.data.orchestrator);
        console.log('   Features:', webhook.data.features);
        console.log('');

        // Test 3: Media WebSocket Health
        console.log('3️⃣ Testing Media WebSocket Health...');
        const mediaHealth = await axios.get(`${BASE_URL}/media/health`);
        console.log('✅ Media WebSocket:', mediaHealth.data.status);
        console.log('   Active Streams:', mediaHealth.data.activeStreams);
        console.log('   Active Transcriptions:', mediaHealth.data.activeTranscriptions);
        console.log('');

        // Test 4: Stats Endpoint
        console.log('4️⃣ Testing Stats Endpoint...');
        const stats = await axios.get(`${BASE_URL}/api/stats`);
        console.log('✅ Stats:', {
            activeCalls: stats.data.activeCalls,
            totalCalls: stats.data.totalCalls
        });
        console.log('');

        console.log('✅ All API tests passed!');
        console.log('\n📊 Summary:');
        console.log('   ✅ Health Check: OK');
        console.log('   ✅ Telnyx Webhook: OK');
        console.log('   ✅ Media WebSocket: OK');
        console.log('   ✅ Stats: OK');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        process.exit(1);
    }
}

// Run tests
testAPIs();
