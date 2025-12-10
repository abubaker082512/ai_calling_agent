// Knowledge Base Management JavaScript

const API_URL = window.location.origin;
let currentKBId = null;
let currentSourceType = 'text';

// Load knowledge bases on page load
document.addEventListener('DOMContentLoaded', () => {
    loadKnowledgeBases();
});

// Load all knowledge bases
async function loadKnowledgeBases() {
    const kbList = document.getElementById('kbList');
    kbList.innerHTML = '<div class="loading">Loading knowledge bases...</div>';

    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases`);

        if (!response.ok) {
            throw new Error('Failed to load knowledge bases');
        }

        const knowledgeBases = await response.json();

        if (knowledgeBases.length === 0) {
            kbList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <h3>No knowledge bases yet</h3>
                    <p>Create your first knowledge base to get started</p>
                </div>
            `;
            return;
        }

        kbList.innerHTML = knowledgeBases.map(kb => `
            <div class="kb-card" onclick="viewKnowledgeBase('${kb.id}')">
                <div class="kb-card-header">
                    <div class="kb-icon">📚</div>
                    <div class="kb-menu" onclick="event.stopPropagation(); showKBMenu('${kb.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </div>
                </div>
                <div class="kb-name">${kb.name}</div>
                <div class="kb-description">${kb.description || 'No description'}</div>
                <div class="kb-stats">
                    <div class="kb-stat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        ${kb.document_count?.[0]?.count || 0} documents
                    </div>
                    <div class="kb-stat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        0 agents
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading knowledge bases:', error);
        kbList.innerHTML = `
            <div class="empty-state">
                <p style="color: #ef4444;">Error loading knowledge bases</p>
                <button class="btn-primary" onclick="loadKnowledgeBases()">Retry</button>
            </div>
        `;
    }
}

// Show create KB modal
function showCreateKBModal() {
    document.getElementById('createKBModal').style.display = 'flex';
    document.getElementById('kbName').focus();
}

// Hide create KB modal
function hideCreateKBModal() {
    document.getElementById('createKBModal').style.display = 'none';
    document.getElementById('createKBForm').reset();
}

// Create knowledge base
async function createKnowledgeBase(event) {
    event.preventDefault();

    const name = document.getElementById('kbName').value;
    const description = document.getElementById('kbDescription').value;

    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });

        if (!response.ok) {
            throw new Error('Failed to create knowledge base');
        }

        hideCreateKBModal();
        loadKnowledgeBases();

    } catch (error) {
        console.error('Error creating knowledge base:', error);
        alert('Failed to create knowledge base. Please try again.');
    }
}

// View knowledge base details
async function viewKnowledgeBase(kbId) {
    currentKBId = kbId;

    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases/${kbId}`);

        if (!response.ok) {
            throw new Error('Failed to load knowledge base');
        }

        const kb = await response.json();

        document.getElementById('kbTitle').textContent = kb.name;
        document.getElementById('docCount').textContent = kb.documents?.length || 0;
        document.getElementById('agentCount').textContent = '0'; // TODO: Get actual count

        // Load documents
        loadDocuments(kbId);

        document.getElementById('viewKBModal').style.display = 'flex';

    } catch (error) {
        console.error('Error loading knowledge base:', error);
        alert('Failed to load knowledge base');
    }
}

// Hide view KB modal
function hideViewKBModal() {
    document.getElementById('viewKBModal').style.display = 'none';
    currentKBId = null;
    hideAddDocumentForm();
}

// Load documents for a knowledge base
async function loadDocuments(kbId) {
    const documentsList = document.getElementById('documentsList');
    documentsList.innerHTML = '<div class="loading">Loading documents...</div>';

    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases/${kbId}/documents`);

        if (!response.ok) {
            throw new Error('Failed to load documents');
        }

        const documents = await response.json();

        if (documents.length === 0) {
            documentsList.innerHTML = `
                <div class="empty-state">
                    <p>No documents yet</p>
                    <p style="font-size: 13px;">Add your first document to get started</p>
                </div>
            `;
            return;
        }

        documentsList.innerHTML = documents.map(doc => `
            <div class="document-item">
                <div class="document-info">
                    <div class="document-title">${doc.title}</div>
                    <div class="document-meta">
                        ${doc.source_type} • ${new Date(doc.created_at).toLocaleDateString()}
                    </div>
                </div>
                <div class="document-actions">
                    <button class="icon-btn" onclick="deleteDocument('${doc.id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading documents:', error);
        documentsList.innerHTML = '<div class="empty-state"><p style="color: #ef4444;">Error loading documents</p></div>';
    }
}

// Show add document form
function showAddDocumentForm() {
    document.getElementById('addDocumentForm').style.display = 'block';
    document.getElementById('docTitle').focus();
}

// Hide add document form
function hideAddDocumentForm() {
    document.getElementById('addDocumentForm').style.display = 'none';
    document.getElementById('addDocumentForm').querySelector('form').reset();
}

// Switch between tabs
function switchTab(tabName) {
    currentSourceType = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Show/hide tab content
    document.getElementById('textTab').style.display = tabName === 'text' ? 'block' : 'none';
    document.getElementById('fileTab').style.display = tabName === 'file' ? 'block' : 'none';
    document.getElementById('urlTab').style.display = tabName === 'url' ? 'block' : 'none';
}

// Add document
async function addDocument(event) {
    event.preventDefault();

    const title = document.getElementById('docTitle').value;
    let content = '';
    let sourceUrl = '';

    if (currentSourceType === 'text') {
        content = document.getElementById('docContent').value;
    } else if (currentSourceType === 'file') {
        const fileInput = document.getElementById('docFile');
        if (fileInput.files.length === 0) {
            alert('Please select a file');
            return;
        }
        // TODO: Handle file upload
        alert('File upload coming soon!');
        return;
    } else if (currentSourceType === 'url') {
        sourceUrl = document.getElementById('docUrl').value;
        // TODO: Handle URL scraping
        alert('URL scraping coming soon!');
        return;
    }

    if (!content) {
        alert('Please provide content');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases/${currentKBId}/documents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                content,
                source_type: currentSourceType,
                source_url: sourceUrl
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add document');
        }

        hideAddDocumentForm();
        loadDocuments(currentKBId);

    } catch (error) {
        console.error('Error adding document:', error);
        alert('Failed to add document. Please try again.');
    }
}

// Delete document
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases/${currentKBId}/documents/${docId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete document');
        }

        loadDocuments(currentKBId);

    } catch (error) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document');
    }
}

// Show KB menu (edit/delete)
function showKBMenu(kbId) {
    // TODO: Implement context menu
    const action = confirm('Delete this knowledge base?');
    if (action) {
        deleteKnowledgeBase(kbId);
    }
}

// Delete knowledge base
async function deleteKnowledgeBase(kbId) {
    try {
        const response = await fetch(`${API_URL}/api/knowledge-bases/${kbId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete knowledge base');
        }

        loadKnowledgeBases();

    } catch (error) {
        console.error('Error deleting knowledge base:', error);
        alert('Failed to delete knowledge base');
    }
}

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideCreateKBModal();
        hideViewKBModal();
    }
});

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});
