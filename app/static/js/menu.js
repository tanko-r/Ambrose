/**
 * Application Menu and User Menu functionality
 */

// Initialize menus when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupAppMenu();
    setupUserMenu();
    setupNavEdgeToggle();
});

// App Menu
function setupAppMenu() {
    const btn = document.getElementById('app-menu-btn');
    const dropdown = document.getElementById('app-menu-dropdown');

    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('show');
        closeAllMenus();
        if (!isOpen) {
            dropdown.classList.add('show');
            btn.classList.add('active');
        }
    });
}

// User Menu
function setupUserMenu() {
    const btn = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-menu-dropdown');

    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('show');
        closeAllMenus();
        if (!isOpen) {
            dropdown.classList.add('show');
            btn.classList.add('active');
        }
    });
}

// Close all menus when clicking outside
document.addEventListener('click', () => {
    closeAllMenus();
});

function closeAllMenus() {
    // Close app menu
    const appDropdown = document.getElementById('app-menu-dropdown');
    const appBtn = document.getElementById('app-menu-btn');
    if (appDropdown) appDropdown.classList.remove('show');
    if (appBtn) appBtn.classList.remove('active');

    // Close user menu
    const userDropdown = document.getElementById('user-menu-dropdown');
    const userBtn = document.getElementById('user-menu-btn');
    if (userDropdown) userDropdown.classList.remove('show');
    if (userBtn) userBtn.classList.remove('active');
}

// App menu item handlers
function handleAppMenuItem(action) {
    closeAllMenus();

    switch (action) {
        case 'new-project':
            // NEW-01: Show confirmation modal if there's work to save
            if (typeof showNewProjectModal === 'function') {
                showNewProjectModal();
            } else {
                showToast('New Project - Module not loaded', 'error');
            }
            break;
        case 'document-library':
            showToast('Document Library - Coming soon!', 'info');
            break;
        case 'settings':
            showToast('Settings - Coming soon!', 'info');
            break;
        case 'help':
            showToast('Help documentation coming soon!', 'info');
            break;
        default:
            console.log('Unknown app menu action:', action);
    }
}

// User menu item handlers (placeholder functionality)
function handleUserMenuItem(action) {
    closeAllMenus();

    switch (action) {
        case 'profile':
            showToast('Profile settings - Coming soon!', 'info');
            break;
        case 'preferences':
            showToast('Preferences - Coming soon!', 'info');
            break;
        case 'logout':
            showToast('Logout - Coming soon!', 'info');
            break;
        default:
            console.log('Unknown user menu action:', action);
    }
}

// Session ID copy to clipboard
function copySessionId() {
    const sessionInfo = document.getElementById('session-info');
    if (!sessionInfo) return;

    // Extract session ID from the text (e.g., "Session: test-abc123" -> "test-abc123")
    const text = sessionInfo.textContent || '';
    const sessionId = text.replace('Session: ', '').trim();

    if (!sessionId) {
        showToast('No session ID to copy', 'warning');
        return;
    }

    navigator.clipboard.writeText(sessionId).then(() => {
        showToast('Session ID copied!', 'success');
    }).catch(err => {
        console.error('Failed to copy session ID:', err);
        showToast('Failed to copy session ID', 'error');
    });
}

// Nav Panel Edge Toggle
function setupNavEdgeToggle() {
    const toggle = document.getElementById('nav-edge-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
        toggleNavPanel();
    });
}

// Export functions to global scope
window.handleAppMenuItem = handleAppMenuItem;
window.handleUserMenuItem = handleUserMenuItem;
window.copySessionId = copySessionId;
window.closeAllMenus = closeAllMenus;
