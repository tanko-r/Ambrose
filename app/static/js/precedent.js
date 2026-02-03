/**
 * Precedent Panel - Compare Precedent Feature
 *
 * PREC-01: User can open precedent document in separate panel from sidebar
 * PREC-02: Precedent panel displays full document with navigation
 * PREC-03: System highlights clauses in precedent that relate to current paragraph
 * PREC-04: User can copy text from precedent panel for reference
 */

// Precedent panel state
let precedentPanelState = {
    isOpen: false,
    document: null,
    filename: '',
    sections: [],
    relatedClauseIds: [],
    scrollPosition: 0,
    currentParaId: null
};

/**
 * Open the precedent comparison panel
 * Called when user clicks "Compare Precedent" in sidebar
 *
 * UAT #3: Auto-jumps to first matched clause when panel opens
 */
async function comparePrecedent() {
    if (!AppState.selectedParaId) {
        showToast('Select a clause first', 'warning');
        return;
    }

    if (!AppState.sessionId) {
        showToast('No active session', 'error');
        return;
    }

    // Show loading state
    showToast('Loading precedent document...', 'info');

    try {
        // Fetch precedent document
        const precedentData = await api(`/precedent/${AppState.sessionId}`);

        if (!precedentData.has_precedent) {
            showToast('No precedent document available for this session', 'warning');
            return;
        }

        // Store precedent data
        precedentPanelState.document = precedentData;
        precedentPanelState.filename = precedentData.filename;
        precedentPanelState.sections = precedentData.sections || [];
        precedentPanelState.currentParaId = AppState.selectedParaId;

        // Fetch related clauses for current paragraph
        await fetchRelatedPrecedentClauses(AppState.selectedParaId);

        // Render and show the panel
        renderPrecedentPanel();
        openPrecedentPanel();

        // Auto-jump to first match after panel opens (UAT #3)
        autoJumpToFirstMatch();

    } catch (error) {
        if (error.message && error.message.includes('No precedent')) {
            showToast('No precedent document was uploaded for this review', 'warning');
        } else {
            showToast(error.message || 'Failed to load precedent', 'error');
        }
    }
}

/**
 * Fetch related clauses from precedent for a given paragraph
 */
async function fetchRelatedPrecedentClauses(paraId) {
    try {
        const relatedData = await api(`/precedent/${AppState.sessionId}/related/${paraId}`);
        precedentPanelState.relatedClauseIds = (relatedData.related_clauses || []).map(c => c.id);
        return relatedData.related_clauses || [];
    } catch (error) {
        console.error('Failed to fetch related clauses:', error);
        precedentPanelState.relatedClauseIds = [];
        return [];
    }
}

/**
 * Render the precedent panel content
 */
function renderPrecedentPanel() {
    const panel = document.getElementById('precedent-panel');
    if (!panel) return;

    const doc = precedentPanelState.document;
    if (!doc) return;

    // Build table of contents
    const tocHtml = buildPrecedentTOC(doc.sections || []);

    // Build document content
    const contentHtml = buildPrecedentContent(doc.content || []);

    panel.innerHTML = `
        <div class="precedent-panel-header">
            <div class="precedent-panel-title">
                <span class="precedent-panel-icon">&#128203;</span>
                <span class="precedent-panel-filename">${escapeHtml(precedentPanelState.filename)}</span>
            </div>
            <button class="precedent-panel-close" onclick="closePrecedentPanel()" title="Close panel">&times;</button>
        </div>
        <div class="precedent-panel-body">
            <div class="precedent-panel-toc">
                <div class="precedent-toc-header">
                    <span class="precedent-toc-title">Contents</span>
                    <button class="precedent-toc-collapse" onclick="togglePrecedentTOC()" title="Toggle contents">
                        <span id="precedent-toc-icon">&#9660;</span>
                    </button>
                </div>
                <div class="precedent-toc-list" id="precedent-toc-list">
                    ${tocHtml}
                </div>
            </div>
            <div class="precedent-panel-content" id="precedent-panel-content">
                ${contentHtml}
            </div>
        </div>
        <div class="precedent-panel-footer">
            <span class="precedent-related-count" id="precedent-related-count">
                ${precedentPanelState.relatedClauseIds.length} related clause(s) highlighted
            </span>
            <button class="btn btn-sm btn-secondary" onclick="scrollToFirstRelated()">
                Jump to First Match
            </button>
        </div>
    `;

    // Setup copy functionality for text selection (PREC-04)
    setupPrecedentCopyHandler();
}

/**
 * Build table of contents HTML from sections
 */
function buildPrecedentTOC(sections) {
    if (!sections || sections.length === 0) {
        return '<div class="precedent-toc-empty">No sections found</div>';
    }

    let html = '';
    sections.forEach(section => {
        const level = section.hierarchy?.length || 0;
        const indent = Math.min(level, 3);
        html += `
            <div class="precedent-toc-item" data-level="${indent}"
                 onclick="scrollToPrecedentSection('${section.para_id}')">
                <span class="precedent-toc-ref">${escapeHtml(section.number || '')}</span>
                <span class="precedent-toc-text">${escapeHtml(section.title || '')}</span>
            </div>
        `;
    });

    return html;
}

/**
 * Build document content HTML
 */
function buildPrecedentContent(content) {
    if (!content || content.length === 0) {
        return '<div class="precedent-content-empty">No content available</div>';
    }

    let html = '';
    content.forEach(item => {
        if (item.type === 'paragraph') {
            const isRelated = precedentPanelState.relatedClauseIds.includes(item.id);
            const relatedClass = isRelated ? 'precedent-related' : '';
            const text = item.text || '';

            // Skip empty paragraphs
            if (!text.trim()) return;

            html += `
                <div class="precedent-para ${relatedClass}"
                     id="prec-${item.id}"
                     data-para-id="${item.id}">
                    ${item.section_ref ? `<span class="precedent-para-ref">${escapeHtml(item.section_ref)}</span>` : ''}
                    <div class="precedent-para-text">${escapeHtml(text)}</div>
                </div>
            `;
        } else if (item.type === 'table') {
            html += '<div class="precedent-table-placeholder">[Table content]</div>';
        }
    });

    return html || '<div class="precedent-content-empty">No paragraphs found</div>';
}

/**
 * Open the precedent panel (slide in)
 */
function openPrecedentPanel() {
    const panel = document.getElementById('precedent-panel');
    if (panel) {
        panel.classList.add('open');
        precedentPanelState.isOpen = true;
        document.body.classList.add('precedent-panel-open');
    }
}

/**
 * Close the precedent panel
 */
function closePrecedentPanel() {
    const panel = document.getElementById('precedent-panel');
    if (panel) {
        // Save scroll position before closing
        const contentEl = document.getElementById('precedent-panel-content');
        if (contentEl) {
            precedentPanelState.scrollPosition = contentEl.scrollTop;
        }
        panel.classList.remove('open');
        precedentPanelState.isOpen = false;
        document.body.classList.remove('precedent-panel-open');
    }
}

/**
 * Toggle the table of contents visibility
 */
function togglePrecedentTOC() {
    const tocList = document.getElementById('precedent-toc-list');
    const tocIcon = document.getElementById('precedent-toc-icon');
    if (tocList && tocIcon) {
        tocList.classList.toggle('collapsed');
        tocIcon.innerHTML = tocList.classList.contains('collapsed') ? '&#9654;' : '&#9660;';
    }
}

/**
 * Scroll to a section in the precedent document
 */
function scrollToPrecedentSection(paraId) {
    const element = document.getElementById(`prec-${paraId}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Brief highlight effect
        element.classList.add('precedent-highlight-flash');
        setTimeout(() => element.classList.remove('precedent-highlight-flash'), 1500);
    }
}

/**
 * Auto-jump to first match when panel opens
 * Shows toast with match count and scrolls to first related clause
 *
 * UAT #3: Should auto-jump to first match
 */
function autoJumpToFirstMatch() {
    const matchCount = precedentPanelState.relatedClauseIds.length;

    if (matchCount > 0) {
        // Show match count toast
        showToast(`Found ${matchCount} related clause${matchCount !== 1 ? 's' : ''}`, 'success');

        // Small delay to ensure panel is fully rendered before scrolling
        setTimeout(() => {
            const firstId = precedentPanelState.relatedClauseIds[0];
            const element = document.getElementById(`prec-${firstId}`);
            if (element) {
                // Scroll to first match
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Add highlight flash animation
                element.classList.add('precedent-highlight-flash');
                setTimeout(() => element.classList.remove('precedent-highlight-flash'), 2000);
            }
        }, 100);
    } else {
        showToast('No related clauses found for this paragraph', 'info');
    }
}

/**
 * Scroll to the first related clause in precedent
 * Called when user clicks "Jump to First Match" button
 */
function scrollToFirstRelated() {
    if (precedentPanelState.relatedClauseIds.length > 0) {
        const firstId = precedentPanelState.relatedClauseIds[0];
        scrollToPrecedentSection(firstId);
    } else {
        showToast('No related clauses found', 'info');
    }
}

/**
 * Update related clauses when selected paragraph changes
 */
async function updatePrecedentRelatedClauses(paraId) {
    if (!precedentPanelState.isOpen || !precedentPanelState.document) return;

    precedentPanelState.currentParaId = paraId;

    // Fetch new related clauses
    const relatedClauses = await fetchRelatedPrecedentClauses(paraId);

    // Update highlights in the document
    const contentEl = document.getElementById('precedent-panel-content');
    if (contentEl) {
        // Remove old highlights
        contentEl.querySelectorAll('.precedent-related').forEach(el => {
            el.classList.remove('precedent-related');
        });

        // Add new highlights
        precedentPanelState.relatedClauseIds.forEach(id => {
            const el = document.getElementById(`prec-${id}`);
            if (el) {
                el.classList.add('precedent-related');
            }
        });
    }

    // Update count display
    const countEl = document.getElementById('precedent-related-count');
    if (countEl) {
        countEl.textContent = `${precedentPanelState.relatedClauseIds.length} related clause(s) highlighted`;
    }
}

/**
 * Setup copy handler for text selection (PREC-04)
 */
function setupPrecedentCopyHandler() {
    const contentEl = document.getElementById('precedent-panel-content');
    if (!contentEl) return;

    // Enable text selection (CSS handles this, but ensure it's not disabled)
    contentEl.style.userSelect = 'text';

    // Add context menu with copy option
    contentEl.addEventListener('contextmenu', (e) => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            // Browser default context menu will handle copy
            // Alternatively, we could add a custom copy action
        }
    });

    // Add keyboard shortcut for copy (Ctrl+C / Cmd+C)
    contentEl.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            // Let browser handle the copy
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
                showToast('Text copied to clipboard', 'success');
            }
        }
    });
}

/**
 * Handle click outside to close panel
 */
function setupPrecedentPanelClickOutside() {
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('precedent-panel');
        if (!panel || !precedentPanelState.isOpen) return;

        // Check if click is outside the panel
        if (!panel.contains(e.target) && !e.target.closest('.precedent-clause')) {
            // Don't close if clicking on sidebar or document content
            if (e.target.closest('.sidebar') || e.target.closest('.document-panel')) {
                return;
            }
        }
    });
}

// Initialize click outside handler
document.addEventListener('DOMContentLoaded', setupPrecedentPanelClickOutside);

// Export functions for use in other modules
window.comparePrecedent = comparePrecedent;
window.closePrecedentPanel = closePrecedentPanel;
window.togglePrecedentTOC = togglePrecedentTOC;
window.scrollToPrecedentSection = scrollToPrecedentSection;
window.scrollToFirstRelated = scrollToFirstRelated;
window.autoJumpToFirstMatch = autoJumpToFirstMatch;
window.updatePrecedentRelatedClauses = updatePrecedentRelatedClauses;
