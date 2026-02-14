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
    sidebarWasVisible: false,  // Track if sidebar was visible before precedent opened
    lockedParaId: null,  // Clause lock: locked paragraph ID
    navigatorLightMode: false  // Navigator light/dark mode preference
};

// Load navigator light mode preference
try {
    precedentPanelState.navigatorLightMode = localStorage.getItem('precedent-nav-light-mode') === 'true';
} catch (e) {}

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

    // Render title tags for both panes
    renderPaneTitleTags();

    // Use HTML rendering for precedent
    renderPrecedentAsHtml();

    // Build and render navigator
    renderPrecedentNavigator();

    // Update status bar
    updatePrecedentStatusBar();
}

/**
 * Render precedent document as high-fidelity HTML
 * Returns true if successful, false if fallback needed
 */
async function renderPrecedentAsHtml() {
    const contentEl = document.getElementById('precedent-content');
    if (!contentEl) return false;

    // Show loading state
    contentEl.innerHTML = `
        <div class="document-loading">
            <div class="loading-spinner"></div>
            <p>Loading precedent document...</p>
        </div>
    `;

    try {
        // Fetch high-fidelity HTML from backend
        const response = await fetch(`/api/precedent/${AppState.sessionId}/html`);
        if (!response.ok) {
            throw new Error(`Failed to load precedent: ${response.status}`);
        }

        const html = await response.text();
        contentEl.innerHTML = html;

        // Setup click handlers for precedent paragraphs
        setupPrecedentClickHandlers(contentEl);

        // Apply related clause highlights
        updatePrecedentHighlights();

        // Setup copy functionality (PREC-04)
        setupPrecedentCopyHandler();

        // Setup scroll observer for active section tracking
        setupPrecedentScrollObserver();

        return true;
    } catch (error) {
        console.error('Precedent HTML rendering failed:', error);
        // Fall back to existing text rendering
        renderPrecedentAsText();
        return false;
    }
}

/**
 * Fallback: Render precedent as plain text
 */
function renderPrecedentAsText() {
    const contentEl = document.getElementById('precedent-content');
    if (!contentEl) return;

    const doc = precedentPanelState.document;
    const contentHtml = buildPrecedentContent(doc?.content || []);
    contentEl.innerHTML = contentHtml;

    // Setup copy functionality (PREC-04)
    setupPrecedentCopyHandler();
    // Setup scroll observer for active section tracking
    setupPrecedentScrollObserver();
}

/**
 * Setup click handlers on paragraphs in HTML-rendered precedent
 */
function setupPrecedentClickHandlers(container) {
    container.querySelectorAll('[data-para-id]').forEach(p => {
        p.classList.add('precedent-paragraph');

        p.addEventListener('click', (e) => {
            e.stopPropagation();
            const paraId = p.dataset.paraId;

            // Update navigator active item
            updateActiveNavItem(paraId);

            // Scroll to section (handles highlight flash)
            scrollToPrecedentSection(paraId);
        });
    });
}

/**
 * Update precedent highlights for related clauses in HTML mode
 */
function updatePrecedentHighlights() {
    const container = document.getElementById('precedent-content');
    if (!container) return;

    // Clear existing highlights
    container.querySelectorAll('.precedent-paragraph.related').forEach(el => {
        el.classList.remove('related');
    });

    // Add highlights for related clauses
    const relatedIds = precedentPanelState.relatedClauseIds || [];
    relatedIds.forEach(id => {
        const para = container.querySelector(`[data-para-id="${id}"]`);
        if (para) {
            para.classList.add('related');
        }
    });
}

/**
 * Render title tags showing filenames in both panes
 */
function renderPaneTitleTags() {
    // Target document title tag
    const targetTag = document.getElementById('target-title-tag');
    if (targetTag && AppState.document) {
        const targetFilename = AppState.document.filename || 'Target Document';
        targetTag.textContent = targetFilename;
        targetTag.title = targetFilename;
    }

    // Precedent document title tag
    const precedentTag = document.getElementById('precedent-title-tag');
    if (precedentTag && precedentPanelState.filename) {
        precedentTag.textContent = precedentPanelState.filename;
        precedentTag.title = precedentPanelState.filename;
    }
}

/**
 * Update the precedent status bar with match info
 */
function updatePrecedentStatusBar() {
    const statusBar = document.getElementById('precedent-status-bar');
    if (!statusBar) return;

    const matchCount = precedentPanelState.relatedClauseIds.length;
    const currentPara = precedentPanelState.currentParaId;

    if (matchCount > 0) {
        statusBar.innerHTML = `<span>${matchCount} match${matchCount !== 1 ? 'es' : ''} for selected clause</span>`;
    } else if (currentPara) {
        statusBar.innerHTML = `<span>No matches found</span>`;
    } else {
        statusBar.innerHTML = `<span>Select a clause to find matches</span>`;
    }
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
 * Render the precedent navigator (right side paragraph-level list)
 * Paragraph-level navigation, search, light/dark mode
 */
function renderPrecedentNavigator() {
    const navigatorEl = document.getElementById('precedent-navigator');
    if (!navigatorEl) return;

    const doc = precedentPanelState.document;
    const paragraphs = doc?.content?.filter(item => item.type === 'paragraph' && item.text?.trim()) || [];
    const relatedIds = precedentPanelState.relatedClauseIds || [];
    const relatedDetails = precedentPanelState.relatedClausesDetails || [];
    const lightMode = precedentPanelState.navigatorLightMode || false;

    // Apply light mode class
    navigatorEl.classList.toggle('light-mode', lightMode);

    // Build a map of para_id to score for quick lookup
    const scoreMap = {};
    relatedDetails.forEach(clause => {
        scoreMap[clause.id] = clause.score || 0;
    });

    let html = `
        <div class="precedent-nav-header">
            <div class="precedent-nav-controls">
                <button class="precedent-nav-mode-btn ${lightMode ? 'active' : ''}"
                        onclick="togglePrecedentNavLightMode()"
                        title="Toggle light/dark mode">
                    <span>&#9728;</span>
                </button>
            </div>
        </div>
        <div class="precedent-nav-search">
            <input type="text" class="precedent-nav-search-input" id="precedent-nav-search"
                   placeholder="Search precedent..." oninput="filterPrecedentNav(this.value)">
        </div>
        <div class="precedent-nav-items" id="precedent-nav-items">
    `;

    if (paragraphs.length === 0) {
        html += '<div class="precedent-nav-empty">No paragraphs found</div>';
    } else {
        paragraphs.forEach(para => {
            const isRelated = relatedIds.includes(para.id);
            const score = scoreMap[para.id] || 0;
            const relatedClass = isRelated ? 'precedent-nav-related matched' : '';

            // Get hierarchy level for indentation
            const level = para.hierarchy?.length || 0;
            const indent = Math.min(level, 3);

            // Truncate text for display
            const displayText = (para.text || '').substring(0, 60) + (para.text?.length > 60 ? '...' : '');

            html += `
                <div class="precedent-nav-para ${relatedClass}"
                     data-level="${indent}"
                     data-para-id="${para.id}"
                     data-search-text="${escapeAttr((para.section_ref || '') + ' ' + (para.text || '').toLowerCase())}"
                     data-score="${score}"
                     onclick="scrollToPrecedentSection('${para.id}')">
                    ${isRelated ? getScoreIndicator(score) : ''}
                    ${para.section_ref ? `<span class="precedent-nav-ref">${escapeHtml(para.section_ref)}</span>` : ''}
                    <span class="precedent-nav-para-text">${escapeHtml(displayText)}</span>
                </div>
            `;
        });
    }

    html += '</div>';

    // Add related count at bottom
    const relatedCount = relatedIds.length;
    if (relatedCount > 0) {
        html += `
            <div class="precedent-related-indicator">
                ${relatedCount} match${relatedCount !== 1 ? 'es' : ''}
            </div>
        `;
    }

    navigatorEl.innerHTML = html;
}

/**
 * Filter precedent navigator by search text
 */
function filterPrecedentNav(searchText) {
    const items = document.querySelectorAll('#precedent-nav-items .precedent-nav-para');
    const lowerSearch = searchText.toLowerCase().trim();

    items.forEach(item => {
        if (!lowerSearch) {
            item.style.display = '';
            return;
        }

        const itemText = item.dataset.searchText || '';
        if (itemText.includes(lowerSearch)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Toggle light/dark mode for precedent navigator
 */
function togglePrecedentNavLightMode() {
    precedentPanelState.navigatorLightMode = !precedentPanelState.navigatorLightMode;

    // Save preference
    try {
        localStorage.setItem('precedent-nav-light-mode', precedentPanelState.navigatorLightMode);
    } catch (e) {}

    // Re-render navigator
    renderPrecedentNavigator();
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
 *
 * NEW: Auto-collapses the risk sidebar when precedent opens to prevent clutter
 * NEW: Adds body class for bottom bar positioning
 * NEW: Animated open with CSS transitions
 */
function openPrecedentPanel() {
    const precedentPane = document.getElementById('precedent-pane');
    if (!precedentPane) return;

    // Auto-collapse the sidebar when precedent opens
    collapseSidebarForPrecedent();

    // Setup for animation: first remove hidden but add opening class
    precedentPane.classList.remove('closing');
    precedentPane.classList.add('opening');
    precedentPane.classList.remove('hidden');

    // Force reflow to ensure transition works
    void precedentPane.offsetWidth;

    // Start animation by removing opening class
    precedentPane.classList.remove('opening');

    precedentPanelState.isOpen = true;

    // Add body class for CSS targeting
    document.body.classList.add('precedent-open');

    // Initialize Split.js if not already
    if (!splitInstance) {
        initializeSplit();
    }

    // Update bottom bar position after DOM updates
    // Need delay for Split.js to finish rendering the pane widths
    setTimeout(() => {
        updateBottomBarPosition();
    }, 50);
}

/**
 * Collapse the sidebar (risk pane) when precedent panel opens
 * Shows a small tab to reopen it
 */
function collapseSidebarForPrecedent() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Track if sidebar was visible before we collapse it
    precedentPanelState.sidebarWasVisible = !sidebar.classList.contains('hidden');

    // Collapse the sidebar
    sidebar.classList.add('sidebar-collapsed');

    // Show the reopen tab
    showSidebarReopenTab();
}

/**
 * Restore the sidebar when precedent panel closes
 */
function restoreSidebarAfterPrecedent() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Remove collapsed state
    sidebar.classList.remove('sidebar-collapsed');

    // Hide the reopen tab
    hideSidebarReopenTab();
}

/**
 * Show the small tab on the right edge to reopen the sidebar
 */
function showSidebarReopenTab() {
    // Check if tab already exists
    let tab = document.getElementById('sidebar-reopen-tab');
    if (!tab) {
        tab = document.createElement('button');
        tab.id = 'sidebar-reopen-tab';
        tab.className = 'sidebar-reopen-tab';
        tab.title = 'Show risk analysis panel';
        tab.innerHTML = '<span class="sidebar-reopen-icon">&#9664;</span><span class="sidebar-reopen-label">Risks</span>';
        tab.onclick = toggleSidebarFromTab;
        document.body.appendChild(tab);
    }
    tab.classList.remove('hidden');
}

/**
 * Hide the sidebar reopen tab
 */
function hideSidebarReopenTab() {
    const tab = document.getElementById('sidebar-reopen-tab');
    if (tab) {
        tab.classList.add('hidden');
    }
}

/**
 * Toggle sidebar visibility from the reopen tab
 */
function toggleSidebarFromTab() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');

    if (isCollapsed) {
        // Expand the sidebar
        sidebar.classList.remove('sidebar-collapsed');
        // Update tab icon to show collapse arrow
        const tab = document.getElementById('sidebar-reopen-tab');
        if (tab) {
            tab.querySelector('.sidebar-reopen-icon').innerHTML = '&#9654;';  // Right arrow
            tab.title = 'Hide risk analysis panel';
        }
    } else {
        // Collapse the sidebar
        sidebar.classList.add('sidebar-collapsed');
        // Update tab icon to show expand arrow
        const tab = document.getElementById('sidebar-reopen-tab');
        if (tab) {
            tab.querySelector('.sidebar-reopen-icon').innerHTML = '&#9664;';  // Left arrow
            tab.title = 'Show risk analysis panel';
        }
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
            onDrag: () => {
                updateBottomBarPosition();
            },
            onDragEnd: (sizes) => {
                saveSplitSizes(sizes);
                updateBottomBarPosition();
            }
        });
    } catch (error) {
        console.error('Failed to initialize Split.js:', error);
    }
}

/**
 * Update bottom bar position based on split pane sizes
 * Keeps bottom bar aligned with main document pane only (not extending under precedent pane)
 */
function updateBottomBarPosition() {
    const bottomBar = document.getElementById('bottom-bar');
    const mainPane = document.getElementById('main-document-pane');

    if (!bottomBar || !mainPane) return;

    // Get main pane right edge position
    const mainPaneRect = mainPane.getBoundingClientRect();

    // Calculate right offset: distance from main pane right edge to window right edge
    const rightOffset = window.innerWidth - mainPaneRect.right;

    // Set right position so bottom bar ends where main pane ends
    // Use setProperty with 'important' to ensure it overrides CSS
    bottomBar.style.setProperty('right', `${rightOffset}px`, 'important');
}

/**
 * Reset bottom bar position when precedent panel closes
 */
function resetBottomBarPosition() {
    const bottomBar = document.getElementById('bottom-bar');
    if (!bottomBar) return;

    // Reset to CSS default (right: var(--sidebar-width))
    bottomBar.style.right = '';
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
 *
 * NEW: Restores the sidebar to its previous state when closing
 * NEW: Animated close with CSS transitions
 */
function closePrecedentPanel() {
    const precedentPane = document.getElementById('precedent-pane');
    if (!precedentPane) return;

    // Save scroll position before closing
    const contentEl = document.getElementById('precedent-content');
    if (contentEl) {
        precedentPanelState.scrollPosition = contentEl.scrollTop;
    }

    // Clear title tags
    const targetTag = document.getElementById('target-title-tag');
    const precedentTag = document.getElementById('precedent-title-tag');
    if (targetTag) targetTag.textContent = '';
    if (precedentTag) precedentTag.textContent = '';

    // Unlock any locked clause
    if (precedentPanelState.lockedParaId) {
        unlockClause();
    }

    // Start closing animation
    precedentPane.classList.add('closing');

    // After animation, hide the pane
    setTimeout(() => {
        precedentPane.classList.add('hidden');
        precedentPane.classList.remove('closing');
        precedentPanelState.isOpen = false;

        // Remove body class
        document.body.classList.remove('precedent-open');

        // Reset bottom bar position
        resetBottomBarPosition();

        // Restore the sidebar
        restoreSidebarAfterPrecedent();

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

    }, 250);  // Match CSS transition duration
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
 * Live scroll: Auto-scrolls to first match when clause changes
 */
async function updatePrecedentRelatedClauses(paraId) {
    if (!precedentPanelState.isOpen || !precedentPanelState.document) return;

    // Skip if clause is locked and different from current lock
    if (precedentPanelState.lockedParaId && precedentPanelState.lockedParaId !== paraId) {
        return;  // Keep showing locked clause's matches
    }

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

    // Update navigator highlights (now paragraph-level)
    const navigatorEl = document.getElementById('precedent-navigator');
    if (navigatorEl) {
        // Remove old related highlights
        navigatorEl.querySelectorAll('.precedent-nav-related').forEach(el => {
            el.classList.remove('precedent-nav-related', 'matched');
        });

        // Add new related highlights
        precedentPanelState.relatedClauseIds.forEach(id => {
            const navItem = navigatorEl.querySelector(`.precedent-nav-para[data-para-id="${id}"]`);
            if (navItem) {
                navItem.classList.add('precedent-nav-related', 'matched');
            }
        });

        // Update related count indicator
        updateRelatedIndicator();
    }

    // Update status bar
    updatePrecedentStatusBar();

    // Update HTML mode highlights
    updatePrecedentHighlights();

    // Live scroll: Auto-scroll to first match after update
    if (precedentPanelState.relatedClauseIds.length > 0) {
        setTimeout(() => {
            const firstId = precedentPanelState.relatedClauseIds[0];
            // Try HTML mode element first, then fall back to plain text mode
            const element = document.querySelector(`[data-para-id="${firstId}"]`) ||
                           document.getElementById(`prec-${firstId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Brief highlight flash
                element.classList.add('precedent-highlight-flash');
                setTimeout(() => element.classList.remove('precedent-highlight-flash'), 1500);

                // Update nav item
                updateActiveNavItem(firstId);
            }
        }, 100);
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


// ============================================
// Clause Lock Feature
// ============================================

/**
 * Toggle clause lock on double-click
 * When locked, precedent matches stay fixed on the locked clause
 * @param {string} paraId - The paragraph ID to lock/unlock
 */
function toggleClauseLock(paraId) {
    if (precedentPanelState.lockedParaId === paraId) {
        // Already locked on this para - unlock it
        unlockClause();
    } else {
        // Lock to this paragraph
        lockClause(paraId);
    }
}

/**
 * Lock the precedent view to a specific clause
 * @param {string} paraId - The paragraph ID to lock
 */
function lockClause(paraId) {
    // Unlock previous if any
    if (precedentPanelState.lockedParaId) {
        const prevEl = document.querySelector(`.para-block[data-para-id="${precedentPanelState.lockedParaId}"]`);
        if (prevEl) {
            prevEl.classList.remove('locked');
        }
    }

    // Lock new clause
    precedentPanelState.lockedParaId = paraId;

    // Update UI - use .para-block selector (main document uses this class)
    const paraEl = document.querySelector(`.para-block[data-para-id="${paraId}"]`);
    if (paraEl) {
        paraEl.classList.add('locked');
    }

    // Update nav outline if visible
    document.querySelectorAll('.nav-outline-item').forEach(item => {
        item.classList.remove('locked');
    });
    const navItem = document.querySelector(`.nav-outline-item[onclick*="${paraId}"]`);
    if (navItem) {
        navItem.classList.add('locked');
    }

    // Update status bar
    updatePrecedentStatusBar();

    showToast('Clause locked - matches will stay fixed', 'info');
}

/**
 * Unlock the currently locked clause
 */
function unlockClause() {
    if (!precedentPanelState.lockedParaId) return;

    const paraId = precedentPanelState.lockedParaId;

    // Remove locked class from paragraph - use .para-block selector
    const paraEl = document.querySelector(`.para-block[data-para-id="${paraId}"]`);
    if (paraEl) {
        paraEl.classList.remove('locked');
    }

    // Remove locked class from nav outline
    document.querySelectorAll('.nav-outline-item.locked').forEach(item => {
        item.classList.remove('locked');
    });

    precedentPanelState.lockedParaId = null;

    // Update status bar
    updatePrecedentStatusBar();

    showToast('Clause unlocked', 'info');
}

/**
 * Check if a clause is currently locked
 * @returns {boolean}
 */
function isClauseLocked() {
    return !!precedentPanelState.lockedParaId;
}

/**
 * Get the currently locked clause ID
 * @returns {string|null}
 */
function getLockedClauseId() {
    return precedentPanelState.lockedParaId;
}

// Update bottom bar on window resize when precedent is open
window.addEventListener('resize', () => {
    if (precedentPanelState.isOpen) {
        updateBottomBarPosition();
    }
});

// Export functions for use in other modules
window.comparePrecedent = comparePrecedent;
window.closePrecedentPanel = closePrecedentPanel;
window.scrollToPrecedentSection = scrollToPrecedentSection;
window.scrollToFirstRelated = scrollToFirstRelated;
window.autoJumpToFirstMatch = autoJumpToFirstMatch;
window.updatePrecedentRelatedClauses = updatePrecedentRelatedClauses;
window.isPrecedentPanelOpen = isPrecedentPanelOpen;
window.getSplitSizes = getSplitSizes;
window.toggleSidebarFromTab = toggleSidebarFromTab;
window.filterPrecedentNav = filterPrecedentNav;
window.togglePrecedentNavLightMode = togglePrecedentNavLightMode;
window.renderPaneTitleTags = renderPaneTitleTags;
window.updatePrecedentStatusBar = updatePrecedentStatusBar;
window.toggleClauseLock = toggleClauseLock;
window.lockClause = lockClause;
window.unlockClause = unlockClause;
window.isClauseLocked = isClauseLocked;
window.getLockedClauseId = getLockedClauseId;
window.updateBottomBarPosition = updateBottomBarPosition;
window.resetBottomBarPosition = resetBottomBarPosition;
window.renderPrecedentAsHtml = renderPrecedentAsHtml;
window.renderPrecedentAsText = renderPrecedentAsText;
window.setupPrecedentClickHandlers = setupPrecedentClickHandlers;
window.updatePrecedentHighlights = updatePrecedentHighlights;
