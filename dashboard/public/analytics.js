// Analytics Dashboard JavaScript
const API_URL = window.location.origin;
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();
});

async function loadAnalytics() {
    const days = document.getElementById('dateRange').value;

    try {
        const response = await fetch(`${API_URL}/api/analytics?days=${days}`);
        if (!response.ok) throw new Error('Failed to load analytics');

        const data = await response.json();
        updateStats(data);
        updateCharts(data);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function updateStats(data) {
    document.getElementById('totalCalls').textContent = data.totalCalls || 0;
    document.getElementById('avgDuration').textContent = formatDuration(data.avgDuration || 0);
    document.getElementById('successRate').textContent = `${data.successRate || 0}%`;
    document.getElementById('totalCost').textContent = `$${(data.totalCost || 0).toFixed(2)}`;
}

function updateCharts(data) {
    // Call Volume Chart
    if (charts.callVolume) charts.callVolume.destroy();
    charts.callVolume = new Chart(document.getElementById('callVolumeChart'), {
        type: 'line',
        data: {
            labels: data.dates || [],
            datasets: [{
                label: 'Calls',
                data: data.callCounts || [],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });

    // Status Distribution Chart
    if (charts.status) charts.status.destroy();
    charts.status = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Failed', 'Busy', 'No Answer'],
            datasets: [{
                data: [
                    data.completed || 0,
                    data.failed || 0,
                    data.busy || 0,
                    data.noAnswer || 0
                ],
                backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#6b7280']
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });

    // Duration Trend Chart
    if (charts.duration) charts.duration.destroy();
    charts.duration = new Chart(document.getElementById('durationChart'), {
        type: 'bar',
        data: {
            labels: data.dates || [],
            datasets: [{
                label: 'Avg Duration (seconds)',
                data: data.durations || [],
                backgroundColor: '#3b82f6'
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });

    // Cost Breakdown Chart
    if (charts.cost) charts.cost.destroy();
    charts.cost = new Chart(document.getElementById('costChart'), {
        type: 'pie',
        data: {
            labels: ['LLM', 'TTS', 'STT', 'Telephony'],
            datasets: [{
                data: [
                    data.llmCost || 0,
                    data.ttsCost || 0,
                    data.sttCost || 0,
                    data.telephonyCost || 0
                ],
                backgroundColor: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
