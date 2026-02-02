/**
 * Main application initialization
 */

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Setup drag and drop for file uploads
    setupDragAndDrop();

    // Setup event delegation for risk cards
    setupRiskCardEvents();

    // Setup bottom sheet for revisions
    setupBottomSheet();

    // Initialize navigation panel
    initNavigation();

    // Setup sidebar tabs
    setupSidebarTabs();

    // Load and display version info
    loadVersionInfo();

    // Show intake screen
    showIntake();

    // Load recent projects (NEW-04)
    if (typeof loadRecentProjects === 'function') {
        loadRecentProjects();
    }

    console.log('Contract Review App initialized');
});

// Load git version info into header
async function loadVersionInfo() {
    try {
        const response = await fetch('/api/version');
        if (response.ok) {
            const data = await response.json();
            const versionEl = document.getElementById('header-version');
            if (versionEl) {
                versionEl.textContent = `${data.branch} @ ${data.commit}`;
                versionEl.title = `Branch: ${data.branch}\nCommit: ${data.commit}`;
            }
        }
    } catch (e) {
        console.log('Could not load version info');
    }
}

// Setup sidebar tab switching
function setupSidebarTabs() {
    // Definition search
    const defSearch = document.getElementById('definition-search');
    if (defSearch) {
        defSearch.addEventListener('input', filterDefinitions);
    }
}

// Switch sidebar tab
function switchSidebarTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.sidebar-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    // Load tab-specific content if needed
    if (tabName === 'related' && AppState.selectedParaId) {
        renderRelatedClausesTab(AppState.selectedParaId);
    } else if (tabName === 'definitions') {
        renderDefinitionsTab();
    } else if (tabName === 'flags' && AppState.selectedParaId) {
        renderFlagsTab(AppState.selectedParaId);
    }
}

// Render flags tab content
function renderFlagsTab(paraId) {
    const container = document.getElementById('flags-content');
    if (!container) return;

    // Find flags for this clause
    const flags = (AppState.flags || []).filter(f => f.para_id === paraId);

    if (flags.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128681;</div>
                <p>No flags for this clause.</p>
                <p class="empty-state-hint">Use the "Flag" button to flag this clause for review.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="flags-list">';
    flags.forEach((flag, idx) => {
        const typeIcon = flag.flag_type === 'client' ? '&#128100;' : '&#9878;';
        const typeLabel = flag.flag_type === 'client' ? 'Client Review' : 'Attorney Review';
        const typeClass = flag.flag_type === 'client' ? 'flag-client' : 'flag-attorney';

        html += `
            <div class="flag-item ${typeClass}">
                <div class="flag-item-header">
                    <span class="flag-type-icon">${typeIcon}</span>
                    <span class="flag-type-label">${typeLabel}</span>
                    <button class="flag-remove-btn" onclick="removeFlag('${paraId}', ${idx})" title="Remove flag">&times;</button>
                </div>
                ${flag.note ? `<div class="flag-note">${escapeHtml(flag.note)}</div>` : ''}
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// Render related clauses tab content
function renderRelatedClausesTab(paraId) {
    const container = document.getElementById('related-clauses-content');
    if (!container) return;

    const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];

    // Collect all related clause IDs from risks
    const relatedIds = new Set();
    risks.forEach(risk => {
        if (risk.related_para_ids) {
            risk.related_para_ids.split(',').forEach(id => {
                const trimmed = id.trim();
                if (trimmed && trimmed !== paraId) {
                    relatedIds.add(trimmed);
                }
            });
        }
    });

    if (relatedIds.size === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128279;</div>
                <p>No related clauses found for this clause.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="related-clauses-list">';
    relatedIds.forEach(relId => {
        const info = getParaInfo(relId);
        if (!info) return;

        const revisionIndicator = info.isAccepted
            ? '<span class="related-revised">&#10003; Revised</span>'
            : (info.hasRevision ? '<span class="related-pending">&#9998; Pending</span>' : '');

        html += `
            <div class="related-clause-card" onclick="openClauseViewer('${relId}')">
                <div class="related-clause-header">
                    <span class="related-clause-ref">${escapeHtml(info.sectionRef)}</span>
                    ${revisionIndicator}
                </div>
                ${info.caption ? `<div class="related-clause-caption">${escapeHtml(info.caption)}</div>` : ''}
                <div class="related-clause-summary">${escapeHtml(info.summary)}</div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// Render definitions tab content
function renderDefinitionsTab() {
    const container = document.getElementById('definitions-list');
    if (!container) return;

    const definedTerms = AppState.document?.defined_terms || [];

    if (definedTerms.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128218;</div>
                <p>No defined terms found in this document.</p>
            </div>
        `;
        return;
    }

    let html = '';
    definedTerms.slice(0, 50).forEach(term => {
        html += `
            <div class="definition-item" onclick="jumpToDefinition('${term.para_id || ''}')">
                <div class="definition-term">"${escapeHtml(term.term || term)}"</div>
                ${term.definition ? `<div class="definition-text">${escapeHtml(term.definition)}</div>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// Filter definitions by search
function filterDefinitions() {
    const searchEl = document.getElementById('definition-search');
    const listEl = document.getElementById('definitions-list');
    const query = (searchEl?.value || '').toLowerCase();

    if (!query) {
        renderDefinitionsTab();
        return;
    }

    const definedTerms = AppState.document?.defined_terms || [];
    const filtered = definedTerms.filter(term => {
        const termText = (term.term || term || '').toLowerCase();
        return termText.includes(query);
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><p>No matching terms found.</p></div>`;
        return;
    }

    let html = '';
    filtered.forEach(term => {
        html += `
            <div class="definition-item" onclick="jumpToDefinition('${term.para_id || ''}')">
                <div class="definition-term">"${escapeHtml(term.term || term)}"</div>
                ${term.definition ? `<div class="definition-text">${escapeHtml(term.definition)}</div>` : ''}
            </div>
        `;
    });

    listEl.innerHTML = html;
}

// Jump to definition in document
function jumpToDefinition(paraId) {
    if (paraId) {
        jumpToParagraph(paraId);
    }
}

// Remove a flag from a clause
function removeFlag(paraId, flagIndex) {
    if (!AppState.flags) return;

    // Find and remove the flag
    const flags = AppState.flags.filter(f => f.para_id === paraId);
    if (flags[flagIndex]) {
        const globalIdx = AppState.flags.indexOf(flags[flagIndex]);
        if (globalIdx > -1) {
            AppState.flags.splice(globalIdx, 1);
        }
    }

    // Re-render the flags tab
    renderFlagsTab(paraId);

    // Update document display
    if (typeof renderDocument === 'function') {
        renderDocument();
    }

    showToast('Flag removed', 'info');
}

// Export functions
window.switchSidebarTab = switchSidebarTab;
window.renderRelatedClausesTab = renderRelatedClausesTab;
window.renderFlagsTab = renderFlagsTab;
window.renderDefinitionsTab = renderDefinitionsTab;
window.filterDefinitions = filterDefinitions;
window.jumpToDefinition = jumpToDefinition;
window.removeFlag = removeFlag;
