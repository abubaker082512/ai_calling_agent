// Test Dexatel SMS API directly
const axios = require('axios');

const apiKey = '51050c33778001c2d22df1d722750026';
const phoneNumber = '+923185954599';

async function testDexatelSMS() {
    console.log('🧪 Testing Dexatel SMS API...\n');

    // Test 1: Exact format from documentation
    console.log('Test 1: Official format from docs');
    try {
        const response = await axios.post(
            'https://api.dexatel.com/v1/messages',
            {
                data: {
                    channel: 'SMS',
                    to: phoneNumber,
                    text: 'Test message from Dexatel API',
                    sender: 'Callify'
                }
            },
            {
                headers: {
                    'X-Dexatel-Key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        console.log('✅ Success:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }

    console.log('\n---\n');

    // Test 2: Without sender
    console.log('Test 2: Without sender field');
    try {
        const response = await axios.post(
            'https://api.dexatel.com/v1/messages',
            {
                data: {
                    channel: 'SMS',
                    to: phoneNumber,
                    text: 'Test without sender'
                }
            },
            {
                headers: {
                    'X-Dexatel-Key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        console.log('✅ Success:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }

    console.log('\n---\n');

    // Test 3: Check account balance
    console.log('Test 3: Check account balance');
    try {
        const response = await axios.get(
            'https://api.dexatel.com/v1/account/balance',
            {
                headers: {
                    'X-Dexatel-Key': apiKey,
                    'Accept': 'application/json'
                }
            }
        );
        console.log('✅ Balance:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

testDexatelSMS();
