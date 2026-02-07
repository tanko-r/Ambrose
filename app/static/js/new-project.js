/**
 * New Project functionality (NEW-01 through NEW-04)
 *
 * Handles:
 * - Confirmation modal for saving/discarding current session
 * - Session save and discard actions
 * - State reset for fresh intake form
 * - Loading saved sessions from recent projects
 */

// Show the new project confirmation modal
async function showNewProjectModal() {
    // Check if there's an active session with work
    if (!AppState.sessionId) {
        // No active session, just reset and show intake
        resetToNewProject();
        return;
    }

    // Check if there's any work to save
    const hasRevisions = Object.keys(AppState.revisions || {}).length > 0;
    const hasFlags = (AppState.flags || []).length > 0;

    if (!hasRevisions && !hasFlags) {
        // No work to save, just reset
        resetToNewProject();
        return;
    }

    // Fetch session info for display
    try {
        const info = await api(`/session/${AppState.sessionId}/info`);
        populateNewProjectModal(info);
        document.getElementById('new-project-modal').classList.add('show');
    } catch (error) {
        // If we can't get info, show modal with basic info
        populateNewProjectModal({
            target_filename: AppState.document?.filename || 'Current Document',
            stats: {
                accepted_revisions: Object.values(AppState.revisions || {}).filter(r => r.accepted).length,
                pending_revisions: Object.values(AppState.revisions || {}).filter(r => !r.accepted).length,
                client_flags: (AppState.flags || []).filter(f => f.flag_type === 'client').length,
                attorney_flags: (AppState.flags || []).filter(f => f.flag_type === 'attorney').length
            }
        });
        document.getElementById('new-project-modal').classList.add('show');
    }
}

// Populate modal with session info
function populateNewProjectModal(info) {
    const docNameEl = document.getElementById('new-project-document-name');
    const statsEl = document.getElementById('new-project-stats');

    if (docNameEl) {
        docNameEl.textContent = `"${info.target_filename || 'Unknown Document'}"`;
    }

    if (statsEl) {
        const stats = info.stats || {};
        const statItems = [];

        const totalRevisions = (stats.accepted_revisions || 0) + (stats.pending_revisions || 0);
        if (totalRevisions > 0) {
            statItems.push(`${stats.accepted_revisions || 0} revision${stats.accepted_revisions !== 1 ? 's' : ''} accepted`);
        }
        if (stats.pending_revisions > 0) {
            statItems.push(`${stats.pending_revisions} revision${stats.pending_revisions !== 1 ? 's' : ''} pending`);
        }
        if (stats.client_flags > 0) {
            statItems.push(`${stats.client_flags} item${stats.client_flags !== 1 ? 's' : ''} flagged for client`);
        }
        if (stats.attorney_flags > 0) {
            statItems.push(`${stats.attorney_flags} item${stats.attorney_flags !== 1 ? 's' : ''} flagged for attorney`);
        }

        if (statItems.length > 0) {
            statsEl.innerHTML = '<ul class="new-project-stats-list">' +
                statItems.map(item => `<li>${item}</li>`).join('') +
                '</ul>';
        } else {
            statsEl.innerHTML = '<p class="new-project-no-changes">No significant changes detected.</p>';
        }
    }
}

// Close the new project modal
function closeNewProjectModal() {
    document.getElementById('new-project-modal').classList.remove('show');
}

// Handle Save action - save session then reset
async function handleNewProjectSave() {
    if (!AppState.sessionId) {
        closeNewProjectModal();
        resetToNewProject();
        return;
    }

    try {
        showToast('Saving session...', 'info');
        await api(`/session/${AppState.sessionId}/save`, {
            method: 'POST'
        });
        showToast('Session saved successfully', 'success');
        closeNewProjectModal();
        resetToNewProject();
    } catch (error) {
        showToast(`Failed to save session: ${error.message}`, 'error');
    }
}

// Handle Discard action - discard session and reset
async function handleNewProjectDiscard() {
    if (!AppState.sessionId) {
        closeNewProjectModal();
        resetToNewProject();
        return;
    }

    try {
        await api(`/session/${AppState.sessionId}`, {
            method: 'DELETE'
        });
        showToast('Session discarded', 'info');
        closeNewProjectModal();
        resetToNewProject();
    } catch (error) {
        // Even if discard fails, still reset UI
        console.warn('Failed to discard session on server:', error);
        closeNewProjectModal();
        resetToNewProject();
    }
}

// Reset application state and show fresh intake form (NEW-03)
function resetToNewProject() {
    // Clear AppState
    AppState.sessionId = null;
    AppState.document = null;
    AppState.analysis = null;
    AppState.selectedParaId = null;
    AppState.revisions = {};
    AppState.flags = [];

    // Clear the intake form
    const intakeForm = document.getElementById('intake-form');
    if (intakeForm) {
        intakeForm.reset();
    }

    // Reset file upload displays
    const targetFilename = document.getElementById('target-filename');
    if (targetFilename) {
        targetFilename.textContent = 'Drop or click to upload';
    }
    const targetUpload = document.getElementById('target-upload');
    if (targetUpload) {
        targetUpload.style.borderColor = '';
        targetUpload.classList.remove('has-file');
    }

    const precedentFilename = document.getElementById('precedent-filename');
    if (precedentFilename) {
        precedentFilename.textContent = 'Drop or click to upload';
    }
    const precedentUpload = document.getElementById('precedent-upload');
    if (precedentUpload) {
        precedentUpload.style.borderColor = '';
        precedentUpload.classList.remove('has-file');
    }

    // Reset aggressiveness display
    const aggrValue = document.getElementById('aggr-value');
    if (aggrValue) {
        aggrValue.textContent = '3';
    }

    // Clear document panel content
    const documentContent = document.getElementById('document-content');
    if (documentContent) {
        documentContent.innerHTML = '';
    }

    // Clear sidebar content
    const sidebarContent = document.getElementById('sidebar-content');
    if (sidebarContent) {
        sidebarContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128269;</div>
                <p>Click on a clause in the document to see its analysis.</p>
            </div>
        `;
    }

    // Clear navigation outline
    const navOutline = document.getElementById('nav-outline');
    if (navOutline) {
        navOutline.innerHTML = '<div class="nav-outline-empty">Load a document to see outline</div>';
    }

    // Clear header filename
    const headerFilename = document.getElementById('header-filename');
    if (headerFilename) {
        headerFilename.textContent = '';
    }

    // Close any open bottom sheets
    const revisionSheet = document.getElementById('revision-sheet');
    if (revisionSheet) {
        revisionSheet.classList.remove('show');
    }
    const clauseViewerSheet = document.getElementById('clause-viewer-sheet');
    if (clauseViewerSheet) {
        clauseViewerSheet.classList.remove('show');
    }

    // Show intake view
    showIntake();

    // Load recent projects list
    loadRecentProjects();
}

// Load and display recent projects in intake form (NEW-04)
async function loadRecentProjects() {
    const recentProjectsContainer = document.getElementById('recent-projects-container');
    if (!recentProjectsContainer) return;

    try {
        const response = await api('/sessions/saved');
        const sessions = response.sessions || [];

        if (sessions.length === 0) {
            recentProjectsContainer.innerHTML = `
                <p class="dashboard-empty">No saved projects yet</p>
            `;
            return;
        }

        // Show up to 6 most recent
        const recentSessions = sessions.slice(0, 6);
        const listHtml = recentSessions.map(session => {
            const filename = session.target_filename || 'Unknown Document';
            const displayName = filename.length > 35 ? filename.substring(0, 32) + '...' : filename;
            const dateStr = formatRelativeDate(session.last_modified || session.created_at);
            const status = session.status || 'unknown';
            const revCount = session.revisions_count || 0;
            const flagCount = session.flags_count || 0;

            return `
                <div class="recent-project-item" onclick="resumeProject('${session.session_id}')" title="${filename}">
                    <span class="recent-project-icon">&#128196;</span>
                    <div class="recent-project-info">
                        <div class="recent-project-name">${displayName}</div>
                        <div class="recent-project-meta">
                            <span class="recent-project-date">${dateStr}</span>
                            <span class="recent-project-stats">${revCount} rev, ${flagCount} flags</span>
                        </div>
                    </div>
                    <span class="recent-project-status status-${status}">${status}</span>
                </div>
            `;
        }).join('');

        recentProjectsContainer.innerHTML = `
            <div class="recent-projects-list">
                ${listHtml}
            </div>
        `;
    } catch (error) {
        console.warn('Failed to load recent projects:', error);
        recentProjectsContainer.innerHTML = `
            <p class="dashboard-empty">Could not load recent projects</p>
        `;
    }
}

// Resume a previously saved project (NEW-04)
async function resumeProject(sessionId) {
    try {
        showToast('Loading project...', 'info');

        // Load the session
        const loadResult = await api(`/session/${sessionId}/load`, {
            method: 'POST'
        });

        AppState.sessionId = sessionId;

        // Load document and analysis
        await loadDocument();

        // Check if analysis exists
        try {
            const analysis = await api(`/analysis/${sessionId}`);
            AppState.analysis = analysis;
            updateStats();
            highlightRisks();
        } catch (e) {
            // Analysis may not exist, that's OK
            console.log('No analysis loaded:', e);
        }

        showToast(`Project loaded: ${loadResult.target_filename}`, 'success');
        showReviewView();
    } catch (error) {
        showToast(`Failed to load project: ${error.message}`, 'error');
    }
}

// Format a date as relative time (e.g., "2 hours ago", "Yesterday")
function formatRelativeDate(isoString) {
    if (!isoString) return 'Unknown';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    // Format as short date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Export functions to global scope
window.showNewProjectModal = showNewProjectModal;
window.closeNewProjectModal = closeNewProjectModal;
window.handleNewProjectSave = handleNewProjectSave;
window.handleNewProjectDiscard = handleNewProjectDiscard;
window.resetToNewProject = resetToNewProject;
window.loadRecentProjects = loadRecentProjects;
window.resumeProject = resumeProject;
