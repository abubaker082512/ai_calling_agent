// Templates Page JavaScript

const API_URL = window.location.origin;
let allTemplates = [];
let currentFilter = 'all';
let selectedTemplate = null;

// Load templates on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTemplates();
    setupFilterButtons();
});

// Load templates from API
async function loadTemplates() {
    try {
        const response = await fetch(`${API_URL}/api/templates`);

        if (!response.ok) {
            throw new Error('Failed to load templates');
        }

        allTemplates = await response.json();
        renderTemplates(allTemplates);

    } catch (error) {
        console.error('Error loading templates:', error);
        showError('Failed to load templates. Please refresh the page.');
    }
}

// Render templates to grid
function renderTemplates(templates) {
    const grid = document.getElementById('templatesGrid');
    const emptyState = document.getElementById('emptyState');

    // Filter templates based on current filter
    const filteredTemplates = currentFilter === 'all'
        ? templates
        : templates.filter(t => t.category === currentFilter);

    if (filteredTemplates.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    grid.innerHTML = filteredTemplates.map(template => `
        <div class="template-card ${template.is_featured ? 'featured' : ''}" onclick="showPreview('${template.id}')">
            <span class="template-icon">${template.icon || '🤖'}</span>
            <div class="template-header">
                <div class="template-name">${template.name}</div>
                <span class="template-category category-${template.category}">${template.category}</span>
            </div>
            <p class="template-description">${template.description}</p>
            <div class="template-stats">
                <div class="stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    ${template.usage_count || 0} uses
                </div>
                <div class="stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    </svg>
                    ${template.voice.split('.').pop().split('-')[0]}
                </div>
            </div>
            <div class="template-actions" onclick="event.stopPropagation()">
                <button class="btn-use-template" onclick="useTemplate('${template.id}')">
                    Use Template
                </button>
                <button class="btn-preview" onclick="showPreview('${template.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Setup filter buttons
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update filter and re-render
            currentFilter = button.dataset.category;
            renderTemplates(allTemplates);
        });
    });
}

// Show template preview modal
function showPreview(templateId) {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;

    selectedTemplate = template;

    // Update modal content
    document.getElementById('modalIcon').textContent = template.icon || '🤖';
    document.getElementById('modalTitle').textContent = template.name;
    document.getElementById('previewDescription').textContent = template.description;
    document.getElementById('previewPrompt').textContent = template.system_prompt;

    // Render sample conversation
    const conversationDiv = document.getElementById('previewConversation');
    const sampleConversation = template.sample_conversation || [];

    if (sampleConversation.length > 0) {
        conversationDiv.innerHTML = sampleConversation.map(msg => `
            <div class="message ${msg.role}">
                ${msg.content}
            </div>
        `).join('');
    } else {
        conversationDiv.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No sample conversation available</p>';
    }

    // Show modal
    document.getElementById('previewModal').classList.add('active');
}

// Close preview modal
function closePreviewModal() {
    document.getElementById('previewModal').classList.remove('active');
    selectedTemplate = null;
}

// Use template from preview modal
function useTemplateFromPreview() {
    if (selectedTemplate) {
        useTemplate(selectedTemplate.id);
    }
}

// Use template to create agent
async function useTemplate(templateId) {
    try {
        // Increment usage count
        await fetch(`${API_URL}/api/templates/${templateId}/use`, {
            method: 'POST'
        });

        // Get template details
        const template = allTemplates.find(t => t.id === templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        // Create agent from template
        const agentData = {
            name: `${template.name} (from template)`,
            description: template.description,
            system_prompt: template.system_prompt,
            voice: template.voice,
            is_active: true,
            settings: {
                greeting: template.greeting,
                ...template.settings,
                voiceSpeed: template.voice_speed || 1.0,
                voicePitch: template.voice_pitch || 0
            }
        };

        const response = await fetch(`${API_URL}/api/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(agentData)
        });

        if (!response.ok) {
            throw new Error('Failed to create agent');
        }

        const newAgent = await response.json();

        // Show success message
        showNotification('Agent created successfully from template!', 'success');

        // Close modal if open
        closePreviewModal();

        // Redirect to agent editor after a short delay
        setTimeout(() => {
            window.location.href = `agent-editor.html?id=${newAgent.id}`;
        }, 1000);

    } catch (error) {
        console.error('Error using template:', error);
        showNotification('Failed to create agent from template', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: ${type === 'success' ? '#22c55e' : '#ef4444'};
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

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Show error message
function showError(message) {
    const grid = document.getElementById('templatesGrid');
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 24px;">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <h3 style="color: var(--text-primary); margin-bottom: 8px;">Error Loading Templates</h3>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">${message}</p>
            <button class="btn-primary" onclick="loadTemplates()">Retry</button>
        </div>
    `;
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

// Close modal when clicking outside
document.getElementById('previewModal').addEventListener('click', (e) => {
    if (e.target.id === 'previewModal') {
        closePreviewModal();
    }
});
