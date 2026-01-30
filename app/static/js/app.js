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

    // Setup related clauses selection panel
    setupRelatedSelectionPanel();

    // Initialize navigation panel
    initNavigation();

    // Setup sidebar tabs
    setupSidebarTabs();

    // Show intake screen
    showIntake();

    console.log('Contract Review App initialized');
});

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
    } else if (tabName === 'history' && AppState.selectedParaId) {
        renderHistoryTab(AppState.selectedParaId);
    }
}

// Render related clauses tab content
function renderRelatedClausesTab(paraId) {
    const container = document.getElementById('related-clauses-content');
    if (!container) return;

    const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];

    // Collect all related clause IDs
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
                    <button class="split-view-btn" onclick="event.stopPropagation(); openSplitView('${paraId}', '${relId}')" title="Compare side-by-side">
                        &#9707;
                    </button>
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

// Render history tab content
function renderHistoryTab(paraId) {
    const container = document.getElementById('history-content');
    if (!container) return;

    const revision = AppState.revisions[paraId];

    if (!revision) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128337;</div>
                <p>No revision history for this clause.</p>
            </div>
        `;
        return;
    }

    const action = revision.accepted ? 'accepted' : 'pending';
    const timestamp = revision.timestamp ? new Date(revision.timestamp).toLocaleString() : 'Unknown';

    let html = `
        <div class="history-item">
            <div class="history-item-header">
                <span class="history-item-action ${action}">${action.toUpperCase()}</span>
                <span class="history-item-time">${timestamp}</span>
            </div>
            <div class="history-item-text">
                <strong>Rationale:</strong> ${escapeHtml(revision.rationale || 'No rationale provided')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Export functions
window.switchSidebarTab = switchSidebarTab;
window.renderRelatedClausesTab = renderRelatedClausesTab;
window.renderDefinitionsTab = renderDefinitionsTab;
window.filterDefinitions = filterDefinitions;
window.jumpToDefinition = jumpToDefinition;
window.renderHistoryTab = renderHistoryTab;
