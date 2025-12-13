// Billing Dashboard JavaScript
const API_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    loadBillingData();
});

async function loadBillingData() {
    try {
        // Get current month's usage
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const response = await fetch(`${API_URL}/api/analytics/costs?year=${year}&month=${month}`);
        if (!response.ok) throw new Error('Failed to load billing data');

        const data = await response.json();
        updateUsage(data);
    } catch (error) {
        console.error('Error loading billing data:', error);
    }
}

function updateUsage(data) {
    // Update usage stats
    document.getElementById('llmTokens').textContent = (data.llmTokens || 0).toLocaleString();
    document.getElementById('llmCost').textContent = `$${(data.llmCost || 0).toFixed(2)}`;

    document.getElementById('ttsChars').textContent = (data.ttsChars || 0).toLocaleString();
    document.getElementById('ttsCost').textContent = `$${(data.ttsCost || 0).toFixed(2)}`;

    document.getElementById('sttMins').textContent = (data.sttMinutes || 0).toFixed(1);
    document.getElementById('sttCost').textContent = `$${(data.sttCost || 0).toFixed(2)}`;

    document.getElementById('callMins').textContent = (data.callMinutes || 0).toFixed(1);
    document.getElementById('callCost').textContent = `$${(data.callCost || 0).toFixed(2)}`;

    // Update total
    const total = (data.llmCost || 0) + (data.ttsCost || 0) + (data.sttCost || 0) + (data.callCost || 0);
    document.getElementById('monthlyTotal').textContent = `$${total.toFixed(2)}`;
}
