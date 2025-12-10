// Dialer.js - Browser-based call management
const API_BASE = window.location.origin;
let ws = null;
let activeCalls = new Map();
let callHistory = [];
let currentFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAgents();
    loadCallHistory();
    setupEventListeners();
});

// Load agents from API
async function loadAgents() {
    try {
        const response = await fetch(`${API_BASE}/api/agents`);
        const agents = await response.json();

        const select = document.getElementById('agentSelect');
        select.innerHTML = '<option value="">Select an agent...</option>';

        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = `${agent.name} (${agent.voice})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading agents:', error);
        document.getElementById('agentSelect').innerHTML = '<option value="">Error loading agents</option>';
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('callButton').addEventListener('click', startCall);

    // History filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderCallHistory();
        });
    });
}

// Start a call
async function startCall() {
    const agentId = document.getElementById('agentSelect').value;
    const phoneNumber = document.getElementById('phoneNumber').value;

    if (!agentId) {
        alert('Please select an agent');
        return;
    }

    const callButton = document.getElementById('callButton');
    callButton.disabled = true;
    callButton.textContent = 'Connecting...';

    try {
        // Get agent configuration
        const agentResponse = await fetch(`${API_BASE}/api/agents/${agentId}`);
        const agent = await agentResponse.json();

        // Create call ID
        const callId = `call-${Date.now()}`;

        // Create WebSocket connection
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/browser-call`);

        const call = {
            id: callId,
            number: phoneNumber,
            agent: agent.name,
            agentId: agentId,
            startTime: Date.now(),
            status: 'connecting',
            muted: false
        };

        ws.onopen = () => {
            console.log('WebSocket connected');
            ws.send(JSON.stringify({
                type: 'start',
                callId: callId,
                agentId: agentId,
                phoneNumber: phoneNumber
            }));

            call.status = 'active';
            activeCalls.set(callId, call);
            renderActiveCalls();
            startCallTimer(callId);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(callId, data);
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            endCall(callId);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            alert('Failed to connect call');
            callButton.disabled = false;
            callButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Start Call';
        };

    } catch (error) {
        console.error('Error starting call:', error);
        alert('Failed to start call');
        callButton.disabled = false;
        callButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Start Call';
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(callId, data) {
    console.log('WebSocket message:', data);

    switch (data.type) {
        case 'connected':
            console.log('Call connected');
            break;
        case 'transcript':
            console.log('Transcript:', data.text);
            break;
        case 'audio':
            // Audio playback is handled by the WebSocket handler
            break;
        case 'sentiment':
            console.log('Sentiment:', data.sentiment);
            break;
        case 'ended':
            endCall(callId);
            break;
    }
}

// Start call timer
function startCallTimer(callId) {
    const call = activeCalls.get(callId);
    if (!call) return;

    call.timerInterval = setInterval(() => {
        const duration = Math.floor((Date.now() - call.startTime) / 1000);
        const timerElement = document.getElementById(`timer-${callId}`);
        if (timerElement) {
            timerElement.textContent = formatDuration(duration);
        }
    }, 1000);
}

// Format duration (seconds to MM:SS)
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Toggle mute
function toggleMute(callId) {
    const call = activeCalls.get(callId);
    if (!call) return;

    call.muted = !call.muted;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'mute',
            callId: callId,
            muted: call.muted
        }));
    }

    renderActiveCalls();
}

// End call
function endCall(callId) {
    const call = activeCalls.get(callId);
    if (!call) return;

    // Stop timer
    if (call.timerInterval) {
        clearInterval(call.timerInterval);
    }

    // Calculate duration
    const duration = Math.floor((Date.now() - call.startTime) / 1000);

    // Add to history
    callHistory.unshift({
        id: callId,
        number: call.number,
        agent: call.agent,
        direction: 'outbound',
        duration: duration,
        timestamp: Date.now(),
        status: 'completed'
    });

    // Save to localStorage
    saveCallHistory();

    // Remove from active calls
    activeCalls.delete(callId);

    // Close WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'end',
            callId: callId
        }));
        ws.close();
    }

    // Re-enable call button
    const callButton = document.getElementById('callButton');
    callButton.disabled = false;
    callButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Start Call';

    renderActiveCalls();
    renderCallHistory();
}

// Render active calls
function renderActiveCalls() {
    const container = document.getElementById('activeCallsList');
    const count = document.getElementById('activeCallCount');

    count.textContent = activeCalls.size;

    if (activeCalls.size === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <p>No active calls</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    activeCalls.forEach((call, callId) => {
        const duration = Math.floor((Date.now() - call.startTime) / 1000);
        const callElement = document.createElement('div');
        callElement.className = 'active-call';
        callElement.innerHTML = `
            <div class="active-call-header">
                <div class="active-call-number">${call.number}</div>
            </div>
            <div class="active-call-agent">${call.agent}</div>
            <div class="active-call-controls">
                <span class="call-timer" id="timer-${callId}">${formatDuration(duration)}</span>
                <button class="control-btn mute" onclick="toggleMute('${callId}')">
                    ${call.muted ? '🔇 Unmute' : '🔊 Mute'}
                </button>
                <button class="control-btn end" onclick="endCall('${callId}')">
                    End Call
                </button>
            </div>
        `;
        container.appendChild(callElement);
    });
}

// Render call history
function renderCallHistory() {
    const container = document.getElementById('callHistoryList');

    let filtered = callHistory;
    if (currentFilter !== 'all') {
        filtered = callHistory.filter(call => call.direction === currentFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <p>No call history yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    filtered.slice(0, 50).forEach(call => {
        const timeAgo = getTimeAgo(call.timestamp);
        const historyElement = document.createElement('div');
        historyElement.className = 'history-item';
        historyElement.innerHTML = `
            <div class="history-item-left">
                <div class="call-direction ${call.direction}">
                    ${call.direction === 'outbound' ? '↗' : '↙'}
                </div>
                <div class="history-details">
                    <div class="history-number">${call.number}</div>
                    <div class="history-meta">${call.agent}</div>
                </div>
            </div>
            <div class="history-item-right">
                <div class="history-duration">${formatDuration(call.duration)}</div>
                <div class="history-time">${timeAgo}</div>
            </div>
        `;
        container.appendChild(historyElement);
    });
}

// Get time ago
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Load call history from localStorage
function loadCallHistory() {
    const saved = localStorage.getItem('callHistory');
    if (saved) {
        callHistory = JSON.parse(saved);
        renderCallHistory();
    }
}

// Save call history to localStorage
function saveCallHistory() {
    localStorage.setItem('callHistory', JSON.stringify(callHistory.slice(0, 100)));
}

// Make functions globally accessible
window.toggleMute = toggleMute;
window.endCall = endCall;
