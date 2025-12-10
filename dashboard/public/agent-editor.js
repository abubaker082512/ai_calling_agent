// Agent Editor JavaScript

const API_URL = window.location.origin;
let currentAgentId = null;
let knowledgeBases = [];

// Load agent data on page load
document.addEventListener('DOMContentLoaded', () => {
    // Get agent ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentAgentId = urlParams.get('id');

    // Load knowledge bases
    loadKnowledgeBases();

    // Load agent if editing
    if (currentAgentId) {
        loadAgent(currentAgentId);
    } else {
        // Set default values for new agent
        document.getElementById('agentName').value = 'New Agent';
        document.getElementById('systemPrompt').value = 'You are a helpful AI assistant. Be friendly, professional, and concise in your responses.';
        document.getElementById('greeting').value = 'Hello! How can I help you today?';
    }
});

// Load knowledge bases for dropdown
async function loadKnowledgeBases() {
    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases`);

        if (!response.ok) {
            throw new Error('Failed to load knowledge bases');
        }

        knowledgeBases = await response.json();

        const select = document.getElementById('knowledgeBaseSelect');
        select.innerHTML = '<option value="">No Knowledge Base</option>';

        knowledgeBases.forEach(kb => {
            const option = document.createElement('option');
            option.value = kb.id;
            option.textContent = kb.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading knowledge bases:', error);
    }
}

// Load agent data
async function loadAgent(agentId) {
    try {
        const response = await fetch(`${API_URL}/api/agents/${agentId}`);

        if (!response.ok) {
            throw new Error('Failed to load agent');
        }

        const agent = await response.json();

        // Populate form fields
        document.getElementById('agentName').value = agent.name;
        document.getElementById('systemPrompt').value = agent.system_prompt;
        document.getElementById('description').value = agent.description || '';
        document.getElementById('greeting').value = agent.settings?.greeting || '';
        document.getElementById('voiceSelect').value = agent.voice;
        document.getElementById('isActive').checked = agent.is_active;
        document.getElementById('knowledgeBaseSelect').value = agent.knowledge_base_id || '';
        document.getElementById('backgroundNoise').value = agent.background_noise;
        document.getElementById('noiseLevel').value = agent.noise_level;
        document.getElementById('noiseLevelValue').textContent = agent.noise_level;
        document.getElementById('temperature').value = agent.temperature;
        document.getElementById('temperatureValue').textContent = agent.temperature;
        document.getElementById('maxTokens').value = agent.max_tokens;

        // Settings
        const settings = agent.settings || {};
        document.getElementById('interruptionEnabled').checked = settings.interruptionEnabled !== false;
        document.getElementById('silenceTimeout').value = settings.silenceTimeout || 3000;
        document.getElementById('maxDuration').value = settings.maxDuration || 1800;
        document.getElementById('recordingEnabled').checked = settings.recordingEnabled !== false;
        document.getElementById('transcriptionEnabled').checked = settings.transcriptionEnabled !== false;
        document.getElementById('webhookUrl').value = settings.webhookUrl || '';

    } catch (error) {
        console.error('Error loading agent:', error);
        alert('Failed to load agent');
        window.location.href = 'agents.html';
    }
}

// Save agent
async function saveAgent() {
    try {
        const agentData = {
            name: document.getElementById('agentName').value,
            description: document.getElementById('description').value,
            system_prompt: document.getElementById('systemPrompt').value,
            voice: document.getElementById('voiceSelect').value,
            is_active: document.getElementById('isActive').checked,
            knowledge_base_id: document.getElementById('knowledgeBaseSelect').value || null,
            background_noise: document.getElementById('backgroundNoise').value,
            noise_level: parseInt(document.getElementById('noiseLevel').value),
            temperature: parseFloat(document.getElementById('temperature').value),
            max_tokens: parseInt(document.getElementById('maxTokens').value),
            settings: {
                greeting: document.getElementById('greeting').value,
                interruptionEnabled: document.getElementById('interruptionEnabled').checked,
                silenceTimeout: parseInt(document.getElementById('silenceTimeout').value),
                maxDuration: parseInt(document.getElementById('maxDuration').value),
                recordingEnabled: document.getElementById('recordingEnabled').checked,
                transcriptionEnabled: document.getElementById('transcriptionEnabled').checked,
                webhookUrl: document.getElementById('webhookUrl').value,
                model: 'gemini-2.5-flash',
                language: 'en',
                endCallPhrases: ['goodbye', 'bye', 'thank you']
            }
        };

        let response;
        if (currentAgentId) {
            // Update existing agent
            response = await fetch(`${API_URL}/api/agents/${currentAgentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(agentData)
            });
        } else {
            // Create new agent
            response = await fetch(`${API_URL}/api/agents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(agentData)
            });
        }

        if (!response.ok) {
            throw new Error('Failed to save agent');
        }

        const savedAgent = await response.json();

        // Show success message
        showNotification('Agent saved successfully!', 'success');

        // Redirect to agents list after a short delay
        setTimeout(() => {
            window.location.href = 'agents.html';
        }, 1000);

    } catch (error) {
        console.error('Error saving agent:', error);
        showNotification('Failed to save agent', 'error');
    }
}

// Test agent
async function testAgent() {
    if (!currentAgentId) {
        alert('Please save the agent first before testing');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/agents/${currentAgentId}/test`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Failed to get agent config');
        }

        const agentConfig = await response.json();

        // Store agent config in session storage
        sessionStorage.setItem('testAgentConfig', JSON.stringify(agentConfig));

        // Open voice testing in new tab
        window.open(`live-test-enhanced.html?agent=${currentAgentId}`, '_blank');

    } catch (error) {
        console.error('Error testing agent:', error);
        alert('Failed to test agent. Please save the agent first.');
    }
}

// Toggle section
function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const header = content.previousElementSibling;

    content.classList.toggle('collapsed');
    header.classList.toggle('expanded');
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: ${type === 'success' ? 'var(--success)' : '#ef4444'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
