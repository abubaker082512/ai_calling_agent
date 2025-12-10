// Agent Management JavaScript

const API_URL = window.location.origin;
let allAgents = [];

// Load agents on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAgents();
});

// Load all agents
async function loadAgents() {
    const agentsGrid = document.getElementById('agentsGrid');
    agentsGrid.innerHTML = '<div class="loading">Loading agents...</div>';

    try {
        const response = await fetch(`${API_URL}/api/agents`);

        if (!response.ok) {
            throw new Error('Failed to load agents');
        }

        allAgents = await response.json();

        displayAgents(allAgents);

    } catch (error) {
        console.error('Error loading agents:', error);
        agentsGrid.innerHTML = `
            <div class="empty-state">
                <p style="color: #ef4444;">Error loading agents</p>
                <button class="btn-primary" onclick="loadAgents()">Retry</button>
            </div>
        `;
    }
}

// Display agents in grid
function displayAgents(agents) {
    const agentsGrid = document.getElementById('agentsGrid');

    if (agents.length === 0) {
        agentsGrid.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <h3>No agents yet</h3>
                <p>Create your first AI agent to get started</p>
                <button class="btn-primary" onclick="createNewAgent()" style="margin-top: 16px;">Create Agent</button>
            </div>
        `;
        return;
    }

    agentsGrid.innerHTML = agents.map(agent => {
        const metrics = agent.metrics?.[0] || {};
        const totalCalls = metrics.total_calls || 0;
        const successRate = totalCalls > 0
            ? Math.round((metrics.successful_calls / totalCalls) * 100)
            : 0;
        const avgDuration = metrics.average_duration_seconds
            ? formatDuration(metrics.average_duration_seconds)
            : '0s';

        return `
            <div class="agent-card" onclick="editAgent('${agent.id}')">
                <div class="agent-header">
                    <div class="agent-icon">🤖</div>
                    <div class="agent-menu" onclick="event.stopPropagation(); showAgentMenu('${agent.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </div>
                </div>
                
                <div class="agent-name">${agent.name}</div>
                <div class="agent-description">${agent.description || 'No description'}</div>
                
                <div class="agent-meta">
                    <div class="agent-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        </svg>
                        Voice: ${getVoiceName(agent.voice)}
                    </div>
                    ${agent.knowledge_base ? `
                        <div class="agent-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            KB: ${agent.knowledge_base.name}
                        </div>
                    ` : ''}
                    <div class="agent-meta-item">
                        ${agent.is_active
                ? '<span class="badge-success">Active</span>'
                : '<span class="badge-inactive">Inactive</span>'}
                    </div>
                </div>
                
                <div class="agent-stats">
                    <div class="stat-item">
                        <div class="stat-value">${totalCalls}</div>
                        <div class="stat-label">Calls</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${successRate}%</div>
                        <div class="stat-label">Success</div>
                    </div>
                </div>
                
                <div class="agent-actions">
                    <button class="primary" onclick="event.stopPropagation(); testAgent('${agent.id}')">
                        Test
                    </button>
                    <button onclick="event.stopPropagation(); cloneAgent('${agent.id}')">
                        Clone
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Search agents
function searchAgents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allAgents.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm) ||
        (agent.description && agent.description.toLowerCase().includes(searchTerm))
    );

    displayAgents(filtered);
}

// Sort agents
function sortAgents() {
    const sortBy = document.getElementById('sortSelect').value;

    let sorted = [...allAgents];

    switch (sortBy) {
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'calls':
            sorted.sort((a, b) => {
                const aCalls = a.metrics?.[0]?.total_calls || 0;
                const bCalls = b.metrics?.[0]?.total_calls || 0;
                return bCalls - aCalls;
            });
            break;
        case 'success':
            sorted.sort((a, b) => {
                const aSuccess = a.metrics?.[0]?.successful_calls || 0;
                const bSuccess = b.metrics?.[0]?.successful_calls || 0;
                return bSuccess - aSuccess;
            });
            break;
        case 'created':
        default:
            sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    displayAgents(sorted);
}

// Create new agent
function createNewAgent() {
    window.location.href = 'agent-editor.html';
}

// Edit agent
function editAgent(agentId) {
    window.location.href = `agent-editor.html?id=${agentId}`;
}

// Test agent
async function testAgent(agentId) {
    try {
        const response = await fetch(`${API_URL}/api/agents/${agentId}/test`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Failed to get agent config');
        }

        const agentConfig = await response.json();

        // Store agent config in session storage
        sessionStorage.setItem('testAgentConfig', JSON.stringify(agentConfig));

        // Redirect to voice testing page
        window.location.href = `live-test-enhanced.html?agent=${agentId}`;

    } catch (error) {
        console.error('Error testing agent:', error);
        alert('Failed to test agent. Please try again.');
    }
}

// Clone agent
async function cloneAgent(agentId) {
    const name = prompt('Enter name for cloned agent:');

    if (!name) return;

    try {
        const response = await fetch(`${API_URL}/api/agents/${agentId}/clone`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            throw new Error('Failed to clone agent');
        }

        loadAgents();

    } catch (error) {
        console.error('Error cloning agent:', error);
        alert('Failed to clone agent. Please try again.');
    }
}

// Show agent menu
function showAgentMenu(agentId) {
    const action = confirm('Delete this agent?');
    if (action) {
        deleteAgent(agentId);
    }
}

// Delete agent
async function deleteAgent(agentId) {
    try {
        const response = await fetch(`${API_URL}/api/agents/${agentId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete agent');
        }

        loadAgents();

    } catch (error) {
        console.error('Error deleting agent:', error);
        alert('Failed to delete agent');
    }
}

// Helper functions
function getVoiceName(voice) {
    if (!voice) return 'Default';
    const parts = voice.split('.');
    return parts[parts.length - 1].replace('-Neural', '');
}

function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
}
