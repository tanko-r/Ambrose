/**
 * View switching functions
 */

function showIntake() {
    document.getElementById('intake-screen').classList.remove('hidden');
    document.getElementById('document-panel').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('btn-finalize').classList.add('hidden');
    document.getElementById('session-info').textContent = '';
}

function showReviewView() {
    document.getElementById('intake-screen').classList.add('hidden');
    document.getElementById('document-panel').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('btn-finalize').classList.remove('hidden');
    document.getElementById('session-info').textContent = `Session: ${AppState.sessionId.slice(0, 8)}...`;
}

// Export for use in other modules
window.showIntake = showIntake;
window.showReviewView = showReviewView;
