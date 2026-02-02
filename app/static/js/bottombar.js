/**
 * Bottom Bar functionality
 * Handles risk filters, navigation, and global actions
 */

// Track active risk filter
let activeRiskFilter = null;

// Track current skip mode: 'risk' or 'unreviewed'
let currentSkipMode = 'risk';

// Initialize bottom bar
function initBottomBar() {
    // No longer need click-outside handler for dropdown
}

// Set skip mode (called by select dropdown)
function setSkipMode(mode) {
    currentSkipMode = mode;
}

// Toggle risk filter and highlight matching clauses in document
function toggleRiskFilter(severity) {
    const btn = document.querySelector(`.risk-filter-btn[data-severity="${severity}"]`);
    const wasActive = btn?.classList.contains('active');

    // Remove all active states
    document.querySelectorAll('.risk-filter-btn').forEach(b => b.classList.remove('active'));

    // Remove all highlight bars from document
    document.querySelectorAll('.para-block').forEach(para => {
        para.classList.remove('risk-highlight-high', 'risk-highlight-medium', 'risk-highlight-low');
    });

    if (wasActive) {
        // Deactivate filter
        activeRiskFilter = null;
        return;
    }

    // Activate this filter
    activeRiskFilter = severity;
    btn?.classList.add('active');

    // Highlight matching clauses in document
    const risks = AppState.analysis?.risk_by_paragraph || {};

    Object.entries(risks).forEach(([paraId, paraRisks]) => {
        const matchingSeverity = paraRisks.some(r => {
            const s = (r.severity || 'medium').toLowerCase();
            if (severity === 'low') return s === 'low' || s === 'info';
            return s === severity;
        });

        if (matchingSeverity) {
            const paraEl = document.querySelector(`.para-block[data-para-id="${paraId}"]`);
            if (paraEl) {
                paraEl.classList.add(`risk-highlight-${severity}`);
            }
        }
    });

    showToast(`Showing ${severity} severity risks`, 'info');
}


// Navigate to previous based on current skip mode
function navigatePrev() {
    if (currentSkipMode === 'risk') {
        jumpToPrevRisk();
    } else {
        jumpToPrevUnreviewed();
    }
}

// Navigate to next based on current skip mode
function navigateNext() {
    if (currentSkipMode === 'risk') {
        jumpToNextRisk();
    } else {
        jumpToNextUnreviewed();
    }
}

// Jump to previous paragraph with risks
function jumpToPrevRisk() {
    const content = AppState.document?.content || [];
    const risks = AppState.analysis?.risk_by_paragraph || {};
    const paragraphs = content.filter(p => p.type === 'paragraph');

    let currentIdx = paragraphs.length;
    if (AppState.selectedParaId) {
        currentIdx = paragraphs.findIndex(p => p.id === AppState.selectedParaId);
    }

    // Find previous paragraph with risks
    for (let i = currentIdx - 1; i >= 0; i--) {
        const para = paragraphs[i];
        if ((risks[para.id] || []).length > 0) {
            jumpToParagraph(para.id);
            return;
        }
    }

    // Wrap around to end
    for (let i = paragraphs.length - 1; i > currentIdx; i--) {
        const para = paragraphs[i];
        if ((risks[para.id] || []).length > 0) {
            jumpToParagraph(para.id);
            showToast('Wrapped to end', 'info');
            return;
        }
    }

    showToast('No more risks found', 'info');
}

// Jump to previous unreviewed paragraph
function jumpToPrevUnreviewed() {
    const content = AppState.document?.content || [];
    const paragraphs = content.filter(p => p.type === 'paragraph');
    const risks = AppState.analysis?.risk_by_paragraph || {};

    let currentIdx = paragraphs.length;
    if (AppState.selectedParaId) {
        currentIdx = paragraphs.findIndex(p => p.id === AppState.selectedParaId);
    }

    // Find previous unreviewed paragraph with risks
    for (let i = currentIdx - 1; i >= 0; i--) {
        const para = paragraphs[i];
        const hasRisks = (risks[para.id] || []).length > 0;
        const isReviewed = AppState.revisions[para.id]?.accepted;

        if (hasRisks && !isReviewed) {
            jumpToParagraph(para.id);
            return;
        }
    }

    // Wrap around
    for (let i = paragraphs.length - 1; i > currentIdx; i--) {
        const para = paragraphs[i];
        const hasRisks = (risks[para.id] || []).length > 0;
        const isReviewed = AppState.revisions[para.id]?.accepted;

        if (hasRisks && !isReviewed) {
            jumpToParagraph(para.id);
            showToast('Wrapped to end', 'info');
            return;
        }
    }

    showToast('All clauses reviewed!', 'success');
}

// Update bottom bar progress and risk counts
function updateBottomBar() {
    const content = AppState.document?.content || [];
    const paragraphs = content.filter(p => p.type === 'paragraph');
    const risks = AppState.analysis?.risk_by_paragraph || {};
    const riskInventory = AppState.analysis?.risk_inventory || [];

    // Count paragraphs with risks
    const withRisks = paragraphs.filter(p => (risks[p.id] || []).length > 0);
    const reviewed = withRisks.filter(p => AppState.revisions[p.id]?.accepted);

    // Update progress
    const progressEl = document.getElementById('bottom-bar-reviewed');
    if (progressEl) {
        progressEl.textContent = `${reviewed.length}/${withRisks.length}`;
    }

    // Count risks by severity
    let high = 0, medium = 0, low = 0;
    riskInventory.forEach(risk => {
        const severity = (risk.severity || 'medium').toLowerCase();
        if (severity === 'high') high++;
        else if (severity === 'medium') medium++;
        else low++;
    });

    // Update filter counts
    const highEl = document.getElementById('filter-high-count');
    const medEl = document.getElementById('filter-medium-count');
    const lowEl = document.getElementById('filter-low-count');

    if (highEl) highEl.textContent = high;
    if (medEl) medEl.textContent = medium;
    if (lowEl) lowEl.textContent = low;
}

// Show bottom bar
function showBottomBar() {
    const bar = document.getElementById('bottom-bar');
    if (bar) bar.classList.remove('hidden');
}

// Hide bottom bar
function hideBottomBar() {
    const bar = document.getElementById('bottom-bar');
    if (bar) bar.classList.add('hidden');
}

// Finalize Redline - Show modal with accepted revisions (FIN-01..FIN-04)
async function finalizeRedline() {
    if (!AppState.sessionId) {
        showToast('No active session', 'error');
        return;
    }

    // Check if there are any accepted revisions
    const acceptedCount = Object.values(AppState.revisions || {}).filter(r => r.accepted).length;
    if (acceptedCount === 0) {
        showToast('No accepted revisions to export. Approve some revisions first.', 'warning');
        return;
    }

    try {
        // Fetch revision preview from API
        const response = await api('/finalize/preview', {
            method: 'POST',
            body: JSON.stringify({ session_id: AppState.sessionId })
        });

        // Show the finalize modal with revision data
        showFinalizeModal(response);
    } catch (error) {
        showToast(`Failed to load revisions: ${error.message}`, 'error');
    }
}

// Show the finalize modal (FIN-04)
function showFinalizeModal(data) {
    const modal = document.getElementById('finalize-modal');
    const revisionsList = document.getElementById('finalize-revisions-list');
    const revisionCount = document.getElementById('finalize-revision-count');

    // Update count
    revisionCount.textContent = data.revision_count;

    // Build revisions list
    if (data.revisions && data.revisions.length > 0) {
        revisionsList.innerHTML = data.revisions.map((rev, index) => `
            <div class="finalize-revision-item">
                <div class="finalize-revision-header">
                    <span class="finalize-revision-number">${index + 1}</span>
                    <span class="finalize-revision-section">${rev.section_ref || 'N/A'}</span>
                    ${rev.section_title ? `<span class="finalize-revision-title">${rev.section_title}</span>` : ''}
                </div>
                <div class="finalize-revision-rationale">${rev.rationale}</div>
                <div class="finalize-revision-diff">
                    ${rev.diff_html || generateSimpleDiff(rev.original, rev.revised)}
                </div>
            </div>
        `).join('');
    } else {
        revisionsList.innerHTML = '<div class="empty-state">No accepted revisions found.</div>';
    }

    // Show modal
    modal.classList.add('show');
}

// Generate simple diff HTML if diff_html not available
function generateSimpleDiff(original, revised) {
    // Truncate for display
    const maxLen = 200;
    const origTrunc = original.length > maxLen ? original.substring(0, maxLen) + '...' : original;
    const revTrunc = revised.length > maxLen ? revised.substring(0, maxLen) + '...' : revised;

    return `<div class="simple-diff">
        <div class="diff-original"><del>${escapeHtml(origTrunc)}</del></div>
        <div class="diff-arrow">&#8595;</div>
        <div class="diff-revised"><ins>${escapeHtml(revTrunc)}</ins></div>
    </div>`;
}

// Escape HTML entities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close finalize modal
function closeFinalizeModal() {
    document.getElementById('finalize-modal').classList.remove('show');
}

// Download track changes document (FIN-01, FIN-03)
async function downloadTrackChanges() {
    if (!AppState.sessionId) {
        showToast('No active session', 'error');
        return;
    }

    try {
        showToast('Generating track changes document...', 'info');

        // First, generate the documents
        const response = await api('/finalize', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                author_name: 'Contract Review Tool'
            })
        });

        // Then download the track changes version
        window.location.href = `/api/download/${AppState.sessionId}/track_changes`;
        showToast('Track changes document downloaded!', 'success');
    } catch (error) {
        showToast(`Download failed: ${error.message}`, 'error');
    }
}

// Download clean document (FIN-02, FIN-03)
async function downloadClean() {
    if (!AppState.sessionId) {
        showToast('No active session', 'error');
        return;
    }

    try {
        showToast('Generating clean document...', 'info');

        // First, generate the documents
        const response = await api('/finalize', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                author_name: 'Contract Review Tool'
            })
        });

        // Then download the clean version
        window.location.href = `/api/download/${AppState.sessionId}/clean`;
        showToast('Clean document downloaded!', 'success');
    } catch (error) {
        showToast(`Download failed: ${error.message}`, 'error');
    }
}

// Generate Transmittal (TRANS-01..TRANS-04)
// Fetches transmittal content from backend and opens email client
async function generateTransmittal() {
    const sessionId = AppState.sessionId;
    if (!sessionId) {
        showToast('No active session', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/transmittal/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to generate transmittal', 'error');
            return;
        }

        // Check if there's any content to send
        if (data.revision_count === 0 && data.flag_count === 0) {
            showToast('No revisions or flags to include in transmittal', 'info');
            // Still allow opening email client with empty transmittal if user wants
        }

        // Build mailto URL with encoded subject and body
        // TRANS-04: Generate Transmittal opens default email client with content prefilled
        const subject = encodeURIComponent(data.subject);
        const body = encodeURIComponent(data.body);
        const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;

        // Open the mailto URL to launch default email client
        window.location.href = mailtoUrl;

        showToast(`Transmittal generated: ${data.revision_count} revisions, ${data.flag_count} flags`, 'success');
    } catch (error) {
        console.error('Error generating transmittal:', error);
        showToast('Failed to generate transmittal', 'error');
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initBottomBar);

// Export functions
window.toggleRiskFilter = toggleRiskFilter;
window.setSkipMode = setSkipMode;
window.navigatePrev = navigatePrev;
window.navigateNext = navigateNext;
window.jumpToPrevRisk = jumpToPrevRisk;
window.jumpToPrevUnreviewed = jumpToPrevUnreviewed;
window.updateBottomBar = updateBottomBar;
window.showBottomBar = showBottomBar;
window.hideBottomBar = hideBottomBar;
window.finalizeRedline = finalizeRedline;
window.generateTransmittal = generateTransmittal;
window.showFinalizeModal = showFinalizeModal;
window.closeFinalizeModal = closeFinalizeModal;
window.downloadTrackChanges = downloadTrackChanges;
window.downloadClean = downloadClean;
