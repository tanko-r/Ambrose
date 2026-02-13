/**
 * Utility functions for Contract Review App
 */

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format risk type for display
function formatRiskType(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Format seconds as mm:ss
function formatTime(seconds) {
    if (!seconds || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Toggle thinking content visibility
function toggleThinking(el) {
    const content = el.nextElementSibling;
    content.classList.toggle('show');
    el.textContent = content.classList.contains('show') ? 'Hide reasoning' : 'Show reasoning...';
}

// Export for use in other modules
window.escapeHtml = escapeHtml;
window.formatRiskType = formatRiskType;
window.formatTime = formatTime;
window.toggleThinking = toggleThinking;
