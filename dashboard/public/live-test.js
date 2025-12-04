// Live Call Testing Dashboard JavaScript

let currentCallId = null;
let currentCallControlId = null;
let ws = null;
let callStartTime = null;
let durationInterval = null;
let messageCount = 0;
let responseTimes = [];

// DOM Elements
const startCallBtn = document.getElementById('startCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const phoneNumber = document.getElementById('phoneNumber');
const fromNumber = document.getElementById('fromNumber');
const callStatus = document.getElementById('callStatus');
const callDuration = document.getElementById('callDuration');
const messagesContainer = document.getElementById('messagesContainer');
const statusMessage = document.getElementById('statusMessage');
const systemPrompt = document.getElementById('systemPrompt');
const voiceSelect = document.getElementById('voiceSelect');
const modelSelect = document.getElementById('modelSelect');
const messageCountEl = document.getElementById('messageCount');
const avgResponseTimeEl = document.getElementById('avgResponseTime');
const estimatedCostEl = document.getElementById('estimatedCost');
const currentCallIdEl = document.getElementById('currentCallId');

// Load saved settings from localStorage
function loadSettings() {
    const savedFrom = localStorage.getItem('from_number');
    if (savedFrom) {
        fromNumber.value = savedFrom;
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('from_number', fromNumber.value);
}

// Initialize
loadSettings();

// Start Call
startCallBtn.addEventListener('click', async () => {
    const to = phoneNumber.value.trim();
    const from = fromNumber.value.trim();

    if (!to || !from) {
        showStatus('Please enter both phone numbers', 'error');
        return;
    }

    try {
        startCallBtn.disabled = true;
        showStatus('Initiating call...', 'info');

        const response = await fetch('/api/test-call/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to,
                from,
                agentConfig: {
                    prompt: systemPrompt.value,
                    voice: voiceSelect.value,
                    model: modelSelect.value
                }
            })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('Call initiated! Waiting for answer...', 'success');
            updateCallStatus('calling');
            saveSettings();

            // Generate a temporary call ID (will be replaced when call is answered)
            currentCallId = 'temp_' + Date.now();
            currentCallIdEl.textContent = currentCallId;

            // Enable hangup button
            hangupBtn.disabled = false;
            hangupBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            hangupBtn.classList.remove('border-red-500/50');
            hangupBtn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600');
        } else {
            showStatus(`Error: ${data.error}`, 'error');
            startCallBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error starting call:', error);
        showStatus('Error connecting to server', 'error');
        startCallBtn.disabled = false;
    }
});

// Hang Up Call
hangupBtn.addEventListener('click', async () => {
    if (!currentCallControlId) {
        showStatus('No active call to hang up', 'error');
        return;
    }

    try {
        const response = await fetch('/api/test-call/hangup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callControlId: currentCallControlId })
        });

        if (response.ok) {
            showStatus('Call ended', 'success');
            endCall();
        } else {
            const data = await response.json();
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error hanging up:', error);
        showStatus('Error ending call', 'error');
    }
});

// Update Call Status
function updateCallStatus(status) {
    const statusBadge = callStatus;
    const statusContainer = document.getElementById('callStatusContainer');

    statusBadge.className = 'status-badge';

    if (status === 'idle') {
        statusContainer.classList.add('hidden');
    } else {
        statusContainer.classList.remove('hidden');
    }

    switch (status) {
        case 'idle':
            statusBadge.classList.add('status-idle');
            statusBadge.textContent = 'Idle';
            break;
        case 'calling':
            statusBadge.classList.add('status-calling');
            statusBadge.textContent = 'Calling...';
            break;
        case 'connected':
            statusBadge.classList.add('status-connected');
            statusBadge.textContent = 'Connected';
            startCallTimer();
            break;
        case 'ended':
            statusBadge.classList.add('status-ended');
            statusBadge.textContent = 'Ended';
            stopCallTimer();
            break;
    }
}

// Start Call Timer
function startCallTimer() {
    callStartTime = Date.now();
    durationInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        callDuration.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

// Stop Call Timer
function stopCallTimer() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
}

// End Call
function endCall() {
    updateCallStatus('ended');

    if (ws) {
        ws.close();
        ws = null;
    }

    startCallBtn.disabled = false;
    hangupBtn.disabled = true;
    hangupBtn.classList.add('opacity-50', 'cursor-not-allowed', 'border-red-500/50');
    hangupBtn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-600');

    currentCallId = null;
    currentCallControlId = null;
}

// Connect to WebSocket for live updates
function connectWebSocket(callId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-call/${callId}`;

    console.log('Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
        showStatus('Live transcription connected', 'success');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('WebSocket message:', message);

        switch (message.type) {
            case 'connected':
                console.log('WebSocket connection confirmed');
                break;
            case 'transcript':
                addMessage(message.data);
                break;
            case 'status':
                updateCallStatus(message.data.status);
                break;
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showStatus('Connection error', 'error');
    };

    ws.onclose = () => {
        console.log('WebSocket closed');
    };
}

// Add Message to Transcription
function addMessage(data) {
    const { speaker, text, timestamp, confidence } = data;

    // Clear placeholder if this is the first message
    if (messageCount === 0) {
        messagesContainer.innerHTML = '';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message mb-4 p-3 rounded-lg ' + (speaker === 'human' ? 'bg-blue-900/30' : 'bg-purple-900/30');

    const time = new Date(timestamp).toLocaleTimeString();
    const icon = speaker === 'human' ? '👤' : '🤖';
    const label = speaker === 'human' ? 'Human' : 'AI';

    messageDiv.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-2xl">${icon}</span>
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-semibold text-sm ${speaker === 'human' ? 'text-blue-400' : 'text-purple-400'}">${label}</span>
                    <span class="text-xs text-gray-500">${time}</span>
                    ${confidence < 1 ? `<span class="text-xs text-gray-500">(${Math.round(confidence * 100)}%)</span>` : ''}
                </div>
                <p class="text-white">${text}</p>
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update analytics
    messageCount++;
    messageCountEl.textContent = messageCount;

    // Calculate estimated cost (rough estimate)
    const estimatedTokens = messageCount * 100; // Rough estimate
    const cost = (estimatedTokens / 1000) * 0.002; // GPT-4 pricing
    estimatedCostEl.textContent = `$${cost.toFixed(4)}`;
}

// Show Status Message
function showStatus(message, type = 'info') {
    const colors = {
        info: 'text-blue-400',
        success: 'text-green-400',
        error: 'text-red-400'
    };

    statusMessage.innerHTML = `<span class="${colors[type]}">${message}</span>`;

    setTimeout(() => {
        statusMessage.innerHTML = '';
    }, 5000);
}

// Simulate call answered (for testing - remove in production)
// In production, this would come from Telnyx webhook
setTimeout(() => {
    if (currentCallId && currentCallId.startsWith('temp_')) {
        // Simulate call answered after 3 seconds
        // This is just for UI testing - real implementation uses webhooks
    }
}, 3000);

console.log('Live Test Dashboard loaded');
