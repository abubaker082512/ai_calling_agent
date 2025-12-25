const axios = require('axios');

const API_KEY = '51050c33778001c2d22df1d722750026';
const BASE_URL = 'https://api.dexatel.com/v1';

async function testDexatel() {
    console.log('🧪 Dexatel Voice API Test\n');
    console.log('='.repeat(50));

    // Test 1: API Key & Account Balance
    console.log('\n1️⃣ Testing API Key & Account Balance...');
    try {
        const response = await axios.get(`${BASE_URL}/account/balance`, {
            headers: {
                'X-Dexatel-Key': API_KEY,
                'Accept': 'application/json'
            }
        });
        console.log('✅ API Key Valid');
        console.log('📊 Account Info:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ API Key Test Failed');
        console.log('Error:', error.response?.data || error.message);
    }

    // Test 2: Voice Call API (will fail if not activated)
    console.log('\n2️⃣ Testing Voice Call API...');
    console.log('⚠️  Note: This will fail if Voice API is not activated');

    const testCall = {
        to: '+923185954599', // Replace with your number
        stream_url: 'wss://yourdomain.com/media/stream'
    };

    try {
        const response = await axios.post(`${BASE_URL}/voice-calls`, testCall, {
            headers: {
                'X-Dexatel-Key': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        console.log('✅ Voice API Active - Call Initiated');
        console.log('📞 Call Details:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ Voice Call Test Failed');
        console.log('Error:', error.response?.data || error.message);

        if (error.response?.status === 403 || error.response?.status === 401) {
            console.log('\n⚠️  Voice API NOT ACTIVATED');
            console.log('📧 Contact Dexatel Support:');
            console.log('   Email: [email protected]');
            console.log('   Subject: Activate Voice API');
            console.log('   Message: Please activate Voice API for my account');
        }
    }

    // Test 3: Local Webhook
    console.log('\n3️⃣ Testing Local Webhook...');
    try {
        const response = await axios.get('http://localhost:3000/dexatel/events/test');
        console.log('✅ Webhook Receiver Ready');
        console.log('📡 Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ Webhook Test Failed');
        console.log('Error:', error.message);
        console.log('⚠️  Make sure server is running: npm start');
    }

    console.log('\n' + '='.repeat(50));
    console.log('🏁 Test Complete\n');
}

// Run tests
testDexatel().catch(console.error);
