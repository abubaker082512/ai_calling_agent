// Call History JavaScript
const API_URL = window.location.origin;
let allCalls = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCalls();
    setupSearch();
});

async function loadCalls() {
    try {
        // Use analytics API to get call data
        const response = await fetch(`${API_URL}/api/analytics/calls`);
        if (!response.ok) throw new Error('Failed to load calls');

        const data = await response.json();
        allCalls = data.calls || [];
        renderCalls(allCalls);
    } catch (error) {
        console.error('Error loading calls:', error);
        // Show empty state or error
        document.getElementById('emptyState').style.display = 'block';
    }
}

function renderCalls(calls) {
    const tbody = document.getElementById('callsTableBody');
    const emptyState = document.getElementById('emptyState');

    if (!calls || calls.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = calls.map(call => `
        <tr>
            <td>${formatDate(call.created_at)}</td>
            <td>${call.from_number || 'N/A'}</td>
            <td>${call.to_number || 'N/A'}</td>
            <td>${call.agent_name || 'Unknown'}</td>
            <td>${formatDuration(call.duration)}</td>
            <td><span class="status-badge status-${call.status}">${call.status || 'unknown'}</span></td>
            <td>${formatCost(call.total_cost)}</td>
            <td>
                <button class="btn-icon" onclick="viewCall('${call.id}')" title="View Details">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allCalls.filter(call =>
            (call.from_number || '').toLowerCase().includes(query) ||
            (call.to_number || '').toLowerCase().includes(query) ||
            (call.agent_name || '').toLowerCase().includes(query)
        );
        renderCalls(filtered);
    });
}

function filterCalls() {
    const status = document.getElementById('statusFilter').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    let filtered = allCalls;

    if (status) {
        filtered = filtered.filter(call => call.status === status);
    }

    if (startDate) {
        filtered = filtered.filter(call => new Date(call.created_at) >= new Date(startDate));
    }

    if (endDate) {
        filtered = filtered.filter(call => new Date(call.created_at) <= new Date(endDate));
    }

    renderCalls(filtered);
}

function exportCalls() {
    if (allCalls.length === 0) {
        alert('No calls to export');
        return;
    }

    // Create CSV
    const headers = ['Time', 'From', 'To', 'Agent', 'Duration', 'Status', 'Cost'];
    const rows = allCalls.map(call => [
        formatDate(call.created_at),
        call.from_number || '',
        call.to_number || '',
        call.agent_name || '',
        formatDuration(call.duration),
        call.status || '',
        formatCost(call.total_cost)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function viewCall(callId) {
    // Navigate to call details or show modal
    window.location.href = `call-details.html?id=${callId}`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCost(cost) {
    if (!cost) return '$0.00';
    return `$${parseFloat(cost).toFixed(2)}`;
}
