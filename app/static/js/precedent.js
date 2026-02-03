/**
 * Precedent Panel - Compare Precedent Feature (Split.js Version)
 *
 * PREC-01: User can open precedent document in split pane beside main document
 * PREC-02: Precedent panel displays full document with navigation
 * PREC-03: System highlights clauses in precedent that relate to current paragraph
 * PREC-04: User can copy text from precedent panel for reference
 *
 * UAT FIX #1: Panel now pushes main document left instead of overlaying
 * UAT FIX #2: Precedent has its own section navigator on right side
 */

// Split.js instance management
let splitInstance = null;
const SPLIT_SIZES_KEY = 'precedent-split-sizes';

// Precedent panel state
let precedentPanelState = {
    isOpen: false,
    document: null,
    filename: '',
    sections: [],
    relatedClauseIds: [],
    relatedClausesDetails: [],  // Full match details with scores
    scrollPosition: 0,
    currentParaId: null,
    activeNavItem: null,
    correlationEditMode: false,
    userCorrelations: {}  // User-defined correlations (para_id -> precedent_id mappings)
};

// IntersectionObserver for active section tracking
let precedentScrollObserver = null;

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
 * Stores full match details including scores for navigator highlighting
 */
async function fetchRelatedPrecedentClauses(paraId) {
    try {
        const relatedData = await api(`/precedent/${AppState.sessionId}/related/${paraId}`);
        const relatedClauses = relatedData.related_clauses || [];
        precedentPanelState.relatedClauseIds = relatedClauses.map(c => c.id);
        precedentPanelState.relatedClausesDetails = relatedClauses;  // Store full details with scores
        return relatedClauses;
    } catch (error) {
        console.error('Failed to fetch related clauses:', error);
        precedentPanelState.relatedClauseIds = [];
        precedentPanelState.relatedClausesDetails = [];
        return [];
    }
}

/**
 * Render the precedent panel content into the split pane structure
 */
function renderPrecedentPanel() {
    const doc = precedentPanelState.document;
    if (!doc) return;

    // Render header
    const headerEl = document.getElementById('precedent-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <div class="precedent-header-left">
                <span class="precedent-header-icon">&#128203;</span>
                <span class="precedent-header-filename">${escapeHtml(precedentPanelState.filename)}</span>
            </div>
            <button class="precedent-header-close" onclick="closePrecedentPanel()" title="Close panel">&times;</button>
        `;
    }

    // Build and render document content
    const contentHtml = buildPrecedentContent(doc.content || []);
    const contentEl = document.getElementById('precedent-content');
    if (contentEl) {
        contentEl.innerHTML = contentHtml;
        // Setup copy functionality (PREC-04)
        setupPrecedentCopyHandler();
        // Setup scroll observer for active section tracking
        setupPrecedentScrollObserver();
    }

    // Build and render navigator
    renderPrecedentNavigator();
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
                     data-para-id="${item.id}"
                     data-section-ref="${item.section_ref || ''}">
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
 * Get score indicator based on match confidence
 * Returns colored dot: green (high), yellow (medium), orange (low)
 */
function getScoreIndicator(score) {
    if (score >= 0.6) {
        return '<span class="match-score-dot match-score-high" title="High confidence match"></span>';
    } else if (score >= 0.35) {
        return '<span class="match-score-dot match-score-medium" title="Medium confidence match"></span>';
    } else {
        return '<span class="match-score-dot match-score-low" title="Low confidence match"></span>';
    }
}

/**
 * Render the precedent navigator (right side section list)
 * UAT FIX #2: Precedent has its own section navigator
 * UAT FIX #4: Shows match indicators with score-based coloring
 */
function renderPrecedentNavigator() {
    const navigatorEl = document.getElementById('precedent-navigator');
    if (!navigatorEl) return;

    const sections = precedentPanelState.sections || [];
    const relatedIds = precedentPanelState.relatedClauseIds || [];
    const relatedDetails = precedentPanelState.relatedClausesDetails || [];
    const editMode = precedentPanelState.correlationEditMode;

    // Build a map of para_id to score for quick lookup
    const scoreMap = {};
    relatedDetails.forEach(clause => {
        scoreMap[clause.id] = clause.score || 0;
    });

    let html = `
        <div class="precedent-nav-header">
            <span>Sections</span>
            <button class="precedent-edit-btn ${editMode ? 'active' : ''}"
                    onclick="toggleCorrelationEditMode()"
                    title="${editMode ? 'Exit edit mode' : 'Edit correlations (drag & drop)'}">
                <span class="edit-icon">&#9998;</span>
            </button>
        </div>
    `;

    if (sections.length === 0) {
        html += '<div class="precedent-nav-empty">No sections found</div>';
    } else {
        sections.forEach(section => {
            const level = section.hierarchy?.length || 0;
            const indent = Math.min(level, 3);
            const isRelated = relatedIds.includes(section.para_id);
            const score = scoreMap[section.para_id] || 0;
            const relatedClass = isRelated ? 'precedent-nav-related matched' : '';
            const draggableAttr = editMode ? 'draggable="true"' : '';

            html += `
                <div class="precedent-nav-item ${relatedClass}"
                     data-level="${indent}"
                     data-para-id="${section.para_id}"
                     data-score="${score}"
                     ${draggableAttr}
                     onclick="scrollToPrecedentSection('${section.para_id}')"
                     ${editMode ? `ondragstart="handleNavItemDragStart(event, '${section.para_id}')"` : ''}>
                    ${isRelated ? getScoreIndicator(score) : ''}
                    <span class="precedent-nav-ref">${escapeHtml(section.number || '')}</span>
                    <span class="precedent-nav-text">${escapeHtml(section.title || '')}</span>
                </div>
            `;
        });
    }

    // Add related count at bottom
    const relatedCount = relatedIds.length;
    if (relatedCount > 0) {
        html += `
            <div class="precedent-related-indicator">
                ${relatedCount} related clause${relatedCount !== 1 ? 's' : ''}
            </div>
        `;
    }

    navigatorEl.innerHTML = html;
}

/**
 * Setup IntersectionObserver for tracking active section in navigator
 */
function setupPrecedentScrollObserver() {
    // Cleanup existing observer
    if (precedentScrollObserver) {
        precedentScrollObserver.disconnect();
    }

    const contentEl = document.getElementById('precedent-content');
    if (!contentEl) return;

    const options = {
        root: contentEl,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    precedentScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const paraId = entry.target.dataset.paraId;
                updateActiveNavItem(paraId);
            }
        });
    }, options);

    // Observe all paragraphs
    contentEl.querySelectorAll('.precedent-para').forEach(para => {
        precedentScrollObserver.observe(para);
    });
}

/**
 * Update the active item in the navigator
 */
function updateActiveNavItem(paraId) {
    // Remove active class from previous
    const navigatorEl = document.getElementById('precedent-navigator');
    if (!navigatorEl) return;

    navigatorEl.querySelectorAll('.precedent-nav-item.active').forEach(el => {
        el.classList.remove('active');
    });

    // Find matching nav item (may be section that contains this para)
    const navItem = navigatorEl.querySelector(`.precedent-nav-item[data-para-id="${paraId}"]`);
    if (navItem) {
        navItem.classList.add('active');
        precedentPanelState.activeNavItem = paraId;

        // Scroll nav item into view if needed
        navItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Open the precedent panel using Split.js
 * UAT FIX #1: Panel pushes main document instead of overlaying
 */
function openPrecedentPanel() {
    const precedentPane = document.getElementById('precedent-pane');
    if (!precedentPane) return;

    // Show the precedent pane
    precedentPane.classList.remove('hidden');
    precedentPanelState.isOpen = true;

    // Initialize Split.js if not already
    if (!splitInstance) {
        initializeSplit();
    }
}

/**
 * Initialize Split.js for resizable split panes
 */
function initializeSplit() {
    const mainPane = document.getElementById('main-document-pane');
    const precedentPane = document.getElementById('precedent-pane');

    if (!mainPane || !precedentPane) {
        console.error('Split panes not found');
        return;
    }

    // Check if Split.js is available
    if (typeof Split === 'undefined') {
        console.error('Split.js not loaded');
        return;
    }

    // Load saved sizes or use defaults
    const savedSizes = loadSplitSizes();
    const sizes = savedSizes || [55, 45];

    try {
        splitInstance = Split(['#main-document-pane', '#precedent-pane'], {
            sizes: sizes,
            minSize: [400, 350],
            gutterSize: 6,
            cursor: 'col-resize',
            direction: 'horizontal',
            onDragEnd: (sizes) => {
                saveSplitSizes(sizes);
            }
        });
    } catch (error) {
        console.error('Failed to initialize Split.js:', error);
    }
}

/**
 * Save split sizes to localStorage
 */
function saveSplitSizes(sizes) {
    try {
        localStorage.setItem(SPLIT_SIZES_KEY, JSON.stringify(sizes));
    } catch (e) {
        console.warn('Could not save split sizes:', e);
    }
}

/**
 * Load split sizes from localStorage
 */
function loadSplitSizes() {
    try {
        const saved = localStorage.getItem(SPLIT_SIZES_KEY);
        if (saved) {
            const sizes = JSON.parse(saved);
            if (Array.isArray(sizes) && sizes.length === 2) {
                return sizes;
            }
        }
    } catch (e) {
        console.warn('Could not load split sizes:', e);
    }
    return null;
}

/**
 * Close the precedent panel and destroy Split.js instance
 */
function closePrecedentPanel() {
    const precedentPane = document.getElementById('precedent-pane');
    if (!precedentPane) return;

    // Save scroll position before closing
    const contentEl = document.getElementById('precedent-content');
    if (contentEl) {
        precedentPanelState.scrollPosition = contentEl.scrollTop;
    }

    // Hide the precedent pane
    precedentPane.classList.add('hidden');
    precedentPanelState.isOpen = false;

    // Destroy Split.js instance
    if (splitInstance) {
        splitInstance.destroy();
        splitInstance = null;
    }

    // Cleanup observer
    if (precedentScrollObserver) {
        precedentScrollObserver.disconnect();
        precedentScrollObserver = null;
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

        // Update nav item
        updateActiveNavItem(paraId);
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

                // Update nav item
                updateActiveNavItem(firstId);
            }
        }, 150);
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
    await fetchRelatedPrecedentClauses(paraId);

    // Update highlights in the document content
    const contentEl = document.getElementById('precedent-content');
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

    // Update navigator highlights
    const navigatorEl = document.getElementById('precedent-navigator');
    if (navigatorEl) {
        // Remove old related highlights
        navigatorEl.querySelectorAll('.precedent-nav-related').forEach(el => {
            el.classList.remove('precedent-nav-related');
        });

        // Add new related highlights
        precedentPanelState.relatedClauseIds.forEach(id => {
            const navItem = navigatorEl.querySelector(`.precedent-nav-item[data-para-id="${id}"]`);
            if (navItem) {
                navItem.classList.add('precedent-nav-related');
            }
        });

        // Update related count indicator
        updateRelatedIndicator();
    }
}

/**
 * Update the related count indicator in navigator
 */
function updateRelatedIndicator() {
    const navigatorEl = document.getElementById('precedent-navigator');
    if (!navigatorEl) return;

    // Remove existing indicator
    const existingIndicator = navigatorEl.querySelector('.precedent-related-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    // Add new indicator if there are related clauses
    const relatedCount = precedentPanelState.relatedClauseIds.length;
    if (relatedCount > 0) {
        const indicator = document.createElement('div');
        indicator.className = 'precedent-related-indicator';
        indicator.textContent = `${relatedCount} related clause${relatedCount !== 1 ? 's' : ''}`;
        navigatorEl.appendChild(indicator);
    }
}

/**
 * Setup copy handler for text selection (PREC-04)
 */
function setupPrecedentCopyHandler() {
    const contentEl = document.getElementById('precedent-content');
    if (!contentEl) return;

    // Enable text selection (CSS handles this, but ensure it's not disabled)
    contentEl.style.userSelect = 'text';

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
 * Check if precedent panel is currently open
 */
function isPrecedentPanelOpen() {
    return precedentPanelState.isOpen;
}

/**
 * Get current split sizes
 */
function getSplitSizes() {
    if (splitInstance) {
        return splitInstance.getSizes();
    }
    return null;
}

// Export functions for use in other modules
window.comparePrecedent = comparePrecedent;
window.closePrecedentPanel = closePrecedentPanel;
window.scrollToPrecedentSection = scrollToPrecedentSection;
window.scrollToFirstRelated = scrollToFirstRelated;
window.autoJumpToFirstMatch = autoJumpToFirstMatch;
window.updatePrecedentRelatedClauses = updatePrecedentRelatedClauses;
window.isPrecedentPanelOpen = isPrecedentPanelOpen;
window.getSplitSizes = getSplitSizes;
