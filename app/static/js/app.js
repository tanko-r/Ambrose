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
            const versionEl = document.getElementById('version-info');
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
    } else if (tabName === 'flags') {
        // Flags tab should always render (can view all flags even without selection)
        renderFlagsTab(AppState.selectedParaId);
    }
}

// Track flag view mode: 'clause' (current clause only) or 'all' (all flags)
let flagViewMode = 'clause';

// Toggle flag view mode
function toggleFlagViewMode() {
    flagViewMode = flagViewMode === 'clause' ? 'all' : 'clause';
    renderFlagsTab(AppState.selectedParaId);
}

// Render flags tab content
function renderFlagsTab(paraId) {
    const container = document.getElementById('flags-content');
    if (!container) return;

    const allFlags = AppState.flags || [];
    const totalFlagCount = allFlags.length;

    // Build toggle header
    let html = `
        <div class="flags-view-toggle">
            <button class="flags-toggle-btn ${flagViewMode === 'clause' ? 'active' : ''}" onclick="setFlagViewMode('clause')">
                This Clause
            </button>
            <button class="flags-toggle-btn ${flagViewMode === 'all' ? 'active' : ''}" onclick="setFlagViewMode('all')">
                All Flags (${totalFlagCount})
            </button>
        </div>
    `;

    if (flagViewMode === 'all') {
        // Show all flags grouped by clause
        html += renderAllFlagsView();
    } else {
        // Show flags for current clause only
        html += renderClauseFlagsView(paraId);
    }

    container.innerHTML = html;
}

// Set flag view mode explicitly
function setFlagViewMode(mode) {
    flagViewMode = mode;
    renderFlagsTab(AppState.selectedParaId);
}

// Render flags for current clause only
function renderClauseFlagsView(paraId) {
    // Handle no clause selected
    if (!paraId) {
        return `
            <div class="empty-state empty-state-small">
                <p>Select a clause to see its flags.</p>
                <p class="empty-state-hint">Or switch to "All Flags" view above.</p>
            </div>
        `;
    }

    const flags = (AppState.flags || []).filter(f => f.para_id === paraId);

    if (flags.length === 0) {
        return `
            <div class="empty-state empty-state-small">
                <p>No flags for this clause.</p>
                <p class="empty-state-hint">Use flag buttons in risk pane or revision sheet.</p>
            </div>
        `;
    }

    let html = '<div class="flags-list">';
    flags.forEach((flag, idx) => {
        html += renderFlagItem(flag, paraId, idx);
    });
    html += '</div>';
    return html;
}

// Get caption for a paragraph (use caption field or first sentence)
function getParaCaption(paraId) {
    const para = AppState.document?.content?.find(p => p.id === paraId);
    if (!para) return '';

    // Use explicit caption if available
    if (para.caption) return para.caption;

    // Otherwise extract first sentence or first ~60 chars
    const text = para.text || '';
    const firstSentenceMatch = text.match(/^[^.!?]+[.!?]/);
    if (firstSentenceMatch && firstSentenceMatch[0].length < 100) {
        return firstSentenceMatch[0].trim();
    }

    // Fallback to first 60 chars
    if (text.length > 60) {
        return text.substring(0, 57).trim() + '...';
    }
    return text.trim();
}

// Render all flags grouped by clause
function renderAllFlagsView() {
    const allFlags = AppState.flags || [];

    if (allFlags.length === 0) {
        return `
            <div class="empty-state empty-state-small">
                <p>No flags in this document.</p>
            </div>
        `;
    }

    // Group flags by paragraph and sort by section reference
    const flagsByPara = {};
    allFlags.forEach(flag => {
        if (!flagsByPara[flag.para_id]) {
            flagsByPara[flag.para_id] = [];
        }
        flagsByPara[flag.para_id].push(flag);
    });

    // Sort paragraphs by section reference
    const sortedParaIds = Object.keys(flagsByPara).sort((a, b) => {
        const refA = flagsByPara[a][0]?.section_ref || '';
        const refB = flagsByPara[b][0]?.section_ref || '';
        return refA.localeCompare(refB, undefined, { numeric: true });
    });

    let html = '<div class="flags-all-list">';
    sortedParaIds.forEach(paraId => {
        const paraFlags = flagsByPara[paraId];
        const sectionRef = paraFlags[0]?.section_ref || 'N/A';
        const caption = getParaCaption(paraId);

        html += `
            <div class="flags-clause-row" onclick="jumpToParagraph('${paraId}')">
                <div class="flags-clause-info">
                    <span class="flags-clause-ref">${escapeHtml(sectionRef)}</span>
                    ${caption ? `<span class="flags-clause-caption">${escapeHtml(caption)}</span>` : ''}
                </div>
                <div class="flags-clause-badges">
        `;

        paraFlags.forEach((flag, idx) => {
            const typeClass = flag.flag_type === 'client' ? 'flag-badge-client' : 'flag-badge-attorney';
            const typeIcon = flag.flag_type === 'client' ? '&#128100;' : '&#9878;';
            html += `<span class="flag-badge ${typeClass}" title="${escapeHtml(flag.note || flag.flag_type)}">${typeIcon}</span>`;
        });

        html += `
                    <button class="flags-expand-btn" onclick="event.stopPropagation(); toggleFlagDetails('${paraId}')" title="Show details">&#9660;</button>
                </div>
            </div>
            <div class="flags-clause-details" id="flag-details-${paraId}" style="display: none;">
        `;

        paraFlags.forEach((flag, idx) => {
            html += renderFlagItemCompact(flag, paraId, idx);
        });

        html += '</div>';
    });
    html += '</div>';

    return html;
}

// Toggle flag details for a clause
function toggleFlagDetails(paraId) {
    const details = document.getElementById(`flag-details-${paraId}`);
    if (details) {
        const isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
    }
}

// Render a compact flag item for the all-flags view
function renderFlagItemCompact(flag, paraId, idx) {
    const typeLabel = flag.flag_type === 'client' ? 'Client' : 'Attorney';
    const typeClass = flag.flag_type === 'client' ? 'flag-client' : 'flag-attorney';

    return `
        <div class="flag-item-compact ${typeClass}">
            <span class="flag-compact-type">${typeLabel}</span>
            ${flag.note ? `<span class="flag-compact-note">${escapeHtml(flag.note)}</span>` : '<span class="flag-compact-note flag-no-note">(no note)</span>'}
            <button class="flag-remove-btn-sm" onclick="event.stopPropagation(); removeFlag('${paraId}', ${idx})" title="Remove">&times;</button>
        </div>
    `;
}

// Render a single flag item
function renderFlagItem(flag, paraId, idx) {
    const typeIcon = flag.flag_type === 'client' ? '&#128100;' : '&#9878;';
    const typeLabel = flag.flag_type === 'client' ? 'Client' : 'Attorney';
    const typeClass = flag.flag_type === 'client' ? 'flag-client' : 'flag-attorney';

    return `
        <div class="flag-item ${typeClass}">
            <div class="flag-item-header">
                <span class="flag-type-icon">${typeIcon}</span>
                <span class="flag-type-label">${typeLabel}</span>
                <button class="flag-remove-btn" onclick="event.stopPropagation(); removeFlag('${paraId}', ${idx})" title="Remove flag">&times;</button>
            </div>
            ${flag.note ? `<div class="flag-note">${escapeHtml(flag.note)}</div>` : ''}
        </div>
    `;
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
window.toggleFlagViewMode = toggleFlagViewMode;
window.setFlagViewMode = setFlagViewMode;
window.toggleFlagDetails = toggleFlagDetails;
window.getParaCaption = getParaCaption;
