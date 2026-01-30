/**
 * View switching functions
 */

function showIntake() {
    document.getElementById('intake-screen').classList.remove('hidden');
    document.getElementById('nav-panel').classList.add('hidden');
    document.getElementById('document-panel').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('btn-finalize').classList.add('hidden');
    document.getElementById('session-info').textContent = '';

    // Reset nav toggle state
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) navToggle.classList.remove('active');
}

function showReviewView() {
    document.getElementById('intake-screen').classList.add('hidden');
    document.getElementById('nav-panel').classList.remove('hidden');
    document.getElementById('document-panel').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('btn-finalize').classList.remove('hidden');
    document.getElementById('session-info').textContent = `Session: ${AppState.sessionId.slice(0, 8)}...`;

    // Set nav toggle to active
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) navToggle.classList.add('active');

    // Update navigation panel
    if (typeof updateNavPanel === 'function') {
        updateNavPanel();
    }
}

// Export for use in other modules
window.showIntake = showIntake;
window.showReviewView = showReviewView;
