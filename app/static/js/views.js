/**
 * View switching functions
 */

function showIntake() {
    document.getElementById('intake-screen')?.classList.remove('hidden');
    document.getElementById('nav-panel')?.classList.add('hidden');
    document.getElementById('split-container')?.classList.add('hidden');
    document.getElementById('sidebar')?.classList.add('hidden');
    const sessionInfo = document.getElementById('session-info');
    if (sessionInfo) sessionInfo.textContent = '';

    // Hide bottom bar
    if (typeof hideBottomBar === 'function') {
        hideBottomBar();
    }
}

function showReviewView() {
    document.getElementById('intake-screen')?.classList.add('hidden');
    document.getElementById('nav-panel')?.classList.remove('hidden');
    document.getElementById('split-container')?.classList.remove('hidden');
    document.getElementById('sidebar')?.classList.remove('hidden');
    // Show full session ID (clickable to copy)
    const sessionInfo = document.getElementById('session-info');
    if (sessionInfo) sessionInfo.textContent = `Session: ${AppState.sessionId}`;

    // Update header filename
    const filenameEl = document.getElementById('header-filename');
    if (filenameEl && AppState.document) {
        const filename = AppState.document.filename || AppState.document.name || 'Untitled Document';
        filenameEl.textContent = filename;
    }

    // Update navigation panel
    if (typeof updateNavPanel === 'function') {
        updateNavPanel();
    }

    // Show and update bottom bar
    if (typeof showBottomBar === 'function') {
        showBottomBar();
    }
    if (typeof updateBottomBar === 'function') {
        updateBottomBar();
    }
}

// Export for use in other modules
window.showIntake = showIntake;
window.showReviewView = showReviewView;
