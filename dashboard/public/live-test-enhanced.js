// Voice options database - Using correct Telnyx format: Provider.ModelId.VoiceId
const VOICES = {
    aws: [
        { value: 'AWS.Polly.Joanna-Neural', label: 'Joanna (Female, US)' },
        { value: 'AWS.Polly.Matthew-Neural', label: 'Matthew (Male, US)' },
        { value: 'AWS.Polly.Ivy-Neural', label: 'Ivy (Female Child, US)' },
        { value: 'AWS.Polly.Kevin-Neural', label: 'Kevin (Male Child, US)' },
        { value: 'AWS.Polly.Kimberly-Neural', label: 'Kimberly (Female, US)' },
        { value: 'AWS.Polly.Salli-Neural', label: 'Salli (Female, US)' },
        { value: 'AWS.Polly.Joey-Neural', label: 'Joey (Male, US)' },
        { value: 'AWS.Polly.Justin-Neural', label: 'Justin (Male Child, US)' },
        { value: 'AWS.Polly.Amy-Neural', label: 'Amy (Female, British)' },
        { value: 'AWS.Polly.Emma-Neural', label: 'Emma (Female, British)' },
        { value: 'AWS.Polly.Brian-Neural', label: 'Brian (Male, British)' },
        { value: 'AWS.Polly.Olivia-Neural', label: 'Olivia (Female, Australian)' }
    ],
    azure: [
        { value: 'Azure.en-US-JennyNeural', label: 'Jenny (Female)' },
        { value: 'Azure.en-US-GuyNeural', label: 'Guy (Male)' },
        { value: 'Azure.en-US-AriaNeural', label: 'Aria (Female)' },
        { value: 'Azure.en-US-DavisNeural', label: 'Davis (Male)' },
        { value: 'Azure.en-US-AmberNeural', label: 'Amber (Female)' },
        { value: 'Azure.en-US-AshleyNeural', label: 'Ashley (Female)' },
        { value: 'Azure.en-US-BrandonNeural', label: 'Brandon (Male)' },
        { value: 'Azure.en-US-ChristopherNeural', label: 'Christopher (Male)' }
    ],
    google: [
        { value: 'Google.en-US-Neural2-A', label: 'Neural2-A (Male)' },
        { value: 'Google.en-US-Neural2-C', label: 'Neural2-C (Female)' },
        { value: 'Google.en-US-Neural2-D', label: 'Neural2-D (Male)' },
        { value: 'Google.en-US-Neural2-E', label: 'Neural2-E (Female)' },
        { value: 'Google.en-US-Neural2-F', label: 'Neural2-F (Female)' },
        { value: 'Google.en-US-Neural2-G', label: 'Neural2-G (Female)' },
        { value: 'Google.en-US-Neural2-H', label: 'Neural2-H (Female)' },
        { value: 'Google.en-US-Neural2-I', label: 'Neural2-I (Male)' },
        { value: 'Google.en-US-Neural2-J', label: 'Neural2-J (Male)' }
    ],
    elevenlabs: [
        { value: 'ElevenLabs.eleven_multilingual_v2.Rachel', label: 'Rachel (Conversational)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Domi', label: 'Domi (Strong)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Bella', label: 'Bella (Soft)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Antoni', label: 'Antoni (Well-rounded)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Elli', label: 'Elli (Emotional)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Josh', label: 'Josh (Deep)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Arnold', label: 'Arnold (Crisp)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Adam', label: 'Adam (Deep)' },
        { value: 'ElevenLabs.eleven_multilingual_v2.Sam', label: 'Sam (Raspy)' }
    ],
    telnyx: [
        { value: 'Telnyx.KokoroTTS.af', label: 'Kokoro Female (US)' },
        { value: 'Telnyx.KokoroTTS.am', label: 'Kokoro Male (US)' }
    ]
};

// Global state
let ws = null;
let audioContext = null;
let mediaStream = null;
let callStartTime = null;
let callDurationInterval = null;
let messageCount = 0;
let lastResponseTime = null;
let audioQueue = [];
let isPlayingAudio = false;

// DOM Elements
const startCallBtn = document.getElementById('startCallBtn');
const stopCallBtn = document.getElementById('stopCallBtn');
const callStatus = document.getElementById('callStatus');
const transcript = document.getElementById('transcript');
const audioVisualizer = document.getElementById('audioVisualizer');
const voiceProvider = document.getElementById('voiceProvider');
const voiceSelect = document.getElementById('voiceSelect');
const previewVoiceBtn = document.getElementById('previewVoiceBtn');
const backgroundNoise = document.getElementById('backgroundNoise');
const noiseLevel = document.getElementById('noiseLevel');
const noiseLevelValue = document.getElementById('noiseLevelValue');
const llmProvider = document.getElementById('llmProvider');
const temperature = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperatureValue');
const callDuration = document.getElementById('callDuration');
const messageCountEl = document.getElementById('messageCount');
const latency = document.getElementById('latency');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎙️ Telnyx AI Calling Agent - Enhanced UI Loaded');

    // Populate voice options
    populateVoices('aws');

    // Event listeners
    startCallBtn.addEventListener('click', startCall);
    stopCallBtn.addEventListener('click', stopCall);
    voiceProvider.addEventListener('change', (e) => populateVoices(e.target.value));
    previewVoiceBtn.addEventListener('click', previewVoice);
    noiseLevel.addEventListener('input', (e) => {
        noiseLevelValue.textContent = `${e.target.value}%`;
    });
    temperature.addEventListener('input', (e) => {
        temperatureValue.textContent = e.target.value;
    });
});

// Populate voice dropdown based on provider
function populateVoices(provider) {
    const voices = VOICES[provider] || [];
    voiceSelect.innerHTML = '';

    voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.value;
        option.textContent = voice.label;
        voiceSelect.appendChild(option);
    });
}

// Start browser call
async function startCall() {
    try {
        console.log('🎤 Starting browser call...');
        console.log('🎭 Selected voice:', voiceSelect.value);

        // Get user media
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Connect WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/browser-call`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            updateCallStatus('connected', 'Connected');

            // Send configuration
            const config = {
                voice: voiceSelect.value,
                backgroundNoise: {
                    type: backgroundNoise.value,
                    level: parseInt(noiseLevel.value)
                },
                llmProvider: llmProvider.value,
                temperature: parseFloat(temperature.value),
                interruptionEnabled: document.getElementById('interruptionEnabled').checked
            };

            console.log('⚙️ Sending configuration:', config);
            ws.send(JSON.stringify({
                type: 'config',
                config: config
            }));

            // Start audio processing
            setupAudioProcessing();

            // Update UI
            startCallBtn.classList.add('hidden');
            stopCallBtn.classList.remove('hidden');
            audioVisualizer.classList.remove('hidden');

            // Start call timer
            callStartTime = Date.now();
            callDurationInterval = setInterval(updateCallDuration, 1000);
        };

        ws.onmessage = handleWebSocketMessage;

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            updateCallStatus('error', 'Connection Error');
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket closed');
            cleanup();
        };

    } catch (error) {
        console.error('❌ Error starting call:', error);
        alert('Failed to start call. Please check microphone permissions.');
    }
}

// Stop call
function stopCall() {
    console.log('📴 Stopping call...');
    cleanup();
}

// Setup audio processing
function setupAudioProcessing() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = convertFloat32ToInt16(inputData);

            // Send audio to server
            ws.send(pcmData.buffer);
        }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
}

// Convert Float32 to Int16 PCM
function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

// Handle WebSocket messages
function handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);

        switch (message.type) {
            case 'connected':
                console.log('✅ Call connected:', message.callId);
                break;

            case 'started':
                console.log('🎙️ Conversation started');
                updateCallStatus('active', 'Active Call');
                break;

            case 'transcript':
                if (message.data && message.data.text) {
                    addMessage('user', message.data.text);
                    messageCount++;
                    updateMessageCount();
                }
                break;

            case 'speak':
                if (message.data && message.data.text) {
                    addMessage('ai', message.data.text);
                    // Audio will be played via 'audio' message from Telnyx TTS
                    messageCount++;
                    updateMessageCount();

                    // Calculate latency
                    if (lastResponseTime) {
                        const latencyMs = Date.now() - lastResponseTime;
                        latency.textContent = `${latencyMs} ms`;
                    }
                }
                break;

            case 'audio':
                // Play TTS audio from backend (Telnyx TTS with selected voice)
                if (message.data) {
                    playAudio(message.data);
                }
                break;

            case 'error':
                console.error('❌ Server error:', message.error);
                addMessage('system', `Error: ${message.error}`);
                break;
        }
    } catch (error) {
        console.error('❌ Error handling message:', error);
    }
}

// Play audio from base64 encoded data
function playAudio(base64Data) {
    try {
        console.log('🔊 Playing audio from backend (Telnyx TTS)');
        const audioData = atob(base64Data);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            audioArray[i] = audioData.charCodeAt(i);
        }
        const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };

        audio.play().catch(err => console.error('Error playing audio:', err));
    } catch (err) {
        console.error('Error processing audio:', err);
    }
}

// Add message to transcript
function addMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message p-4 rounded-lg ${role === 'user' ? 'bg-blue-600/20 ml-8' :
            role === 'ai' ? 'bg-purple-600/20 mr-8' :
                'bg-gray-600/20 text-center'
        }`;

    const icon = role === 'user' ? '👤' : role === 'ai' ? '🤖' : 'ℹ️';
    const label = role === 'user' ? 'You' : role === 'ai' ? 'AI' : 'System';

    messageDiv.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-2xl">${icon}</span>
            <div class="flex-1">
                <div class="font-semibold text-sm mb-1">${label}</div>
                <div class="text-gray-200">${text}</div>
            </div>
        </div>
    `;

    // Clear placeholder if exists
    if (transcript.querySelector('.text-gray-400')) {
        transcript.innerHTML = '';
    }

    transcript.appendChild(messageDiv);
    transcript.scrollTop = transcript.scrollHeight;

    lastResponseTime = Date.now();
}

// Preview voice
async function previewVoice() {
    try {
        const voice = voiceSelect.value;
        const text = "Hello! This is a preview of my voice. How do I sound?";

        console.log(`🔊 Previewing voice: ${voice}`);
        previewVoiceBtn.disabled = true;
        previewVoiceBtn.textContent = '🔊 Playing...';

        const response = await fetch('/api/test/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate voice preview');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            previewVoiceBtn.disabled = false;
            previewVoiceBtn.textContent = '🔊 Preview Voice';
            URL.revokeObjectURL(audioUrl);
        };

        audio.play();

    } catch (error) {
        console.error('❌ Error previewing voice:', error);
        alert(`Failed to preview voice: ${error.message}`);
        previewVoiceBtn.disabled = false;
        previewVoiceBtn.textContent = '🔊 Preview Voice';
    }
}

// Update call status
function updateCallStatus(status, text) {
    callStatus.textContent = text;
    callStatus.className = `px-4 py-2 rounded-full text-sm ${status === 'connected' ? 'bg-yellow-600' :
            status === 'active' ? 'bg-green-600 active-call' :
                status === 'error' ? 'bg-red-600' :
                    'bg-gray-700'
        }`;
}

// Update call duration
function updateCallDuration() {
    if (callStartTime) {
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        callDuration.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

// Update message count
function updateMessageCount() {
    messageCountEl.textContent = messageCount;
}

// Cleanup
function cleanup() {
    if (ws) {
        ws.close();
        ws = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }

    // Reset UI
    startCallBtn.classList.remove('hidden');
    stopCallBtn.classList.add('hidden');
    audioVisualizer.classList.add('hidden');
    updateCallStatus('disconnected', 'Disconnected');

    // Reset stats
    callStartTime = null;
    callDuration.textContent = '00:00';
    latency.textContent = '-- ms';
}

console.log('✅ Live Test Enhanced UI loaded with Telnyx TTS support (correct voice format)');
