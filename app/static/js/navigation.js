/**
 * Navigation Panel functionality
 * Handles document outline, review modes, and batch navigation
 */

// Current review mode: 'linear', 'by-risk', 'by-category'
let currentReviewMode = 'linear';

// Track navigation state
let navCollapsed = false;

// Initialize navigation panel
function initNavigation() {
    // Edge toggle is handled in menu.js via setupNavEdgeToggle()

    // Setup keyboard shortcut (Ctrl+B to toggle nav)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleNavPanel();
        }
    });
}

// Toggle navigation panel visibility
function toggleNavPanel() {
    const navPanel = document.getElementById('nav-panel');
    const edgeToggle = document.getElementById('nav-edge-toggle');
    const collapsedToggle = document.getElementById('nav-collapsed-toggle');
    const toggleIcon = edgeToggle?.querySelector('.nav-edge-toggle-icon');

    navCollapsed = !navCollapsed;

    if (navCollapsed) {
        navPanel.classList.add('collapsed');
        document.body.classList.add('nav-collapsed');
        if (toggleIcon) toggleIcon.innerHTML = '&#187;'; // » chevron right
        if (collapsedToggle) collapsedToggle.classList.remove('hidden');
    } else {
        navPanel.classList.remove('collapsed');
        document.body.classList.remove('nav-collapsed');
        if (toggleIcon) toggleIcon.innerHTML = '&#171;'; // « chevron left
        if (collapsedToggle) collapsedToggle.classList.add('hidden');
    }
}

// Set review mode
function setReviewMode(mode) {
    currentReviewMode = mode;

    // Update button states
    document.querySelectorAll('.review-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Re-render outline based on mode
    renderDocumentOutline();

    showToast(`Review mode: ${mode.replace('-', ' ')}`, 'info');
}

// Render document outline in nav panel
function renderDocumentOutline() {
    const container = document.getElementById('nav-outline');
    if (!container) return;

    const content = AppState.document?.content || [];
    const paragraphs = content.filter(p => p.type === 'paragraph');

    if (paragraphs.length === 0) {
        container.innerHTML = '<div class="nav-outline-empty">Load a document to see outline</div>';
        return;
    }

    let html = '';

    if (currentReviewMode === 'by-risk') {
        // Group by risk severity
        html = renderOutlineByRisk(paragraphs);
    } else if (currentReviewMode === 'by-category') {
        // Group by section
        html = renderOutlineByCategory(paragraphs);
    } else {
        // Linear mode - show all in order
        html = renderOutlineLinear(paragraphs);
    }

    container.innerHTML = html;
}

// Render linear outline - compact, hierarchical style
function renderOutlineLinear(paragraphs, filterText = '') {
    let html = '';
    const risks = AppState.analysis?.risk_by_paragraph || {};
    const filter = filterText.toLowerCase().trim();

    // Filter paragraphs if search is active
    let filtered = paragraphs;
    if (filter) {
        filtered = paragraphs.filter(para => {
            const text = (para.text || '').toLowerCase();
            const ref = (para.section_ref || '').toLowerCase();
            return text.includes(filter) || ref.includes(filter);
        });
    }

    if (filtered.length === 0 && filter) {
        return '<div class="nav-outline-no-results">No matching clauses</div>';
    }

    filtered.forEach(para => {
        const paraRisks = risks[para.id] || [];
        const hasRisk = paraRisks.length > 0;
        const isReviewed = AppState.revisions[para.id]?.accepted;
        const isSelected = AppState.selectedParaId === para.id;

        // Determine severity for color coding
        const severities = paraRisks.map(r => r.severity || 'medium');
        let severityClass = '';
        if (severities.includes('high')) severityClass = 'severity-high';
        else if (severities.includes('medium')) severityClass = 'severity-medium';
        else if (severities.includes('low') || severities.includes('info')) severityClass = 'severity-low';

        // Determine hierarchy level from section ref
        const sectionRef = para.section_ref || '';
        const level = Math.min((sectionRef.match(/\./g) || []).length + 1, 4);

        const classes = ['nav-outline-item'];
        if (hasRisk) classes.push('has-risk', severityClass);
        if (isReviewed) classes.push('reviewed');
        if (isSelected) classes.push('active');

        // Shorter text preview for density
        const textPreview = (para.text || '').substring(0, 35).trim();

        html += `
            <div class="${classes.join(' ')}" data-level="${level}" onclick="jumpToParagraph('${para.id}')">
                <span class="nav-outline-ref">${sectionRef || para.id.slice(0, 6)}</span>
                <span class="nav-outline-text">${escapeHtml(textPreview)}${textPreview.length >= 35 ? '...' : ''}</span>
            </div>
        `;
    });

    return html;
}

// Filter outline based on search input
function filterOutline(searchText) {
    const container = document.getElementById('nav-outline');
    if (!container) return;

    const content = AppState.document?.content || [];
    const paragraphs = content.filter(p => p.type === 'paragraph');

    if (paragraphs.length === 0) {
        container.innerHTML = '<div class="nav-outline-empty">Load a document to see outline</div>';
        return;
    }

    // Always use linear rendering for filtered results
    container.innerHTML = renderOutlineLinear(paragraphs, searchText);
}

// Render outline grouped by risk severity
function renderOutlineByRisk(paragraphs) {
    const risks = AppState.analysis?.risk_by_paragraph || {};
    const riskInventory = AppState.analysis?.risk_inventory || [];

    // Group risks by severity
    const byRiskSeverity = { high: [], medium: [], low: [], none: [] };

    paragraphs.forEach(para => {
        const paraRisks = risks[para.id] || [];
        if (paraRisks.length === 0) {
            byRiskSeverity.none.push(para);
        } else {
            // Get highest severity for this para
            const severities = paraRisks.map(r => r.severity || 'medium');
            if (severities.includes('high')) {
                byRiskSeverity.high.push(para);
            } else if (severities.includes('medium')) {
                byRiskSeverity.medium.push(para);
            } else {
                byRiskSeverity.low.push(para);
            }
        }
    });

    let html = '';

    ['high', 'medium', 'low'].forEach(severity => {
        const paras = byRiskSeverity[severity];
        if (paras.length === 0) return;

        html += `<div class="nav-outline-group">
            <div class="nav-outline-group-header severity-${severity}">
                ${severity.toUpperCase()} (${paras.length})
            </div>`;

        paras.slice(0, 10).forEach(para => {
            const isReviewed = AppState.revisions[para.id]?.accepted;
            const isSelected = AppState.selectedParaId === para.id;
            const classes = ['nav-outline-item', 'has-risk'];
            if (isReviewed) classes.push('reviewed');
            if (isSelected) classes.push('active');

            html += `
                <div class="${classes.join(' ')}" onclick="jumpToParagraph('${para.id}')">
                    <span class="nav-outline-ref">${para.section_ref || para.id}</span>
                    <span class="nav-outline-text">${escapeHtml((para.text || '').substring(0, 30))}...</span>
                </div>
            `;
        });

        if (paras.length > 10) {
            html += `<div class="nav-outline-more">+${paras.length - 10} more</div>`;
        }

        html += '</div>';
    });

    return html;
}

// Render outline grouped by category/section
function renderOutlineByCategory(paragraphs) {
    // Group by top-level section
    const bySection = {};

    paragraphs.forEach(para => {
        const sectionRef = para.section_ref || 'Other';
        const topSection = sectionRef.split('.')[0] || 'Other';

        if (!bySection[topSection]) {
            bySection[topSection] = [];
        }
        bySection[topSection].push(para);
    });

    let html = '';
    const risks = AppState.analysis?.risk_by_paragraph || {};

    Object.keys(bySection).sort().forEach(section => {
        const paras = bySection[section];
        const riskCount = paras.filter(p => (risks[p.id] || []).length > 0).length;

        html += `<div class="nav-outline-group">
            <div class="nav-outline-group-header">
                Section ${section}
                ${riskCount > 0 ? `<span class="nav-outline-risk-badge">${riskCount}</span>` : ''}
            </div>`;

        paras.slice(0, 5).forEach(para => {
            const hasRisk = (risks[para.id] || []).length > 0;
            const isReviewed = AppState.revisions[para.id]?.accepted;
            const isSelected = AppState.selectedParaId === para.id;

            const classes = ['nav-outline-item'];
            if (hasRisk) classes.push('has-risk');
            if (isReviewed) classes.push('reviewed');
            if (isSelected) classes.push('active');

            html += `
                <div class="${classes.join(' ')}" onclick="jumpToParagraph('${para.id}')">
                    <span class="nav-outline-ref">${para.section_ref || para.id}</span>
                    <span class="nav-outline-text">${escapeHtml((para.text || '').substring(0, 25))}...</span>
                </div>
            `;
        });

        if (paras.length > 5) {
            html += `<div class="nav-outline-more">+${paras.length - 5} more</div>`;
        }

        html += '</div>';
    });

    return html;
}

// Jump to a specific paragraph with smart scrolling
// Only scrolls if the paragraph is not already visible in the middle third of the viewport
function jumpToParagraph(paraId) {
    selectParagraph(paraId);

    // Scroll document to paragraph if needed (smart scrolling)
    const paraEl = document.querySelector(`.para-block[data-para-id="${paraId}"]`);
    if (paraEl) {
        smartScrollToElement(paraEl);
    }

    // Update outline active state
    document.querySelectorAll('.nav-outline-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.nav-outline-item[onclick*="${paraId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        // Also scroll the nav outline item into view
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Smart scroll: only scroll if element is not in the middle third of viewport
function smartScrollToElement(element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Calculate the middle third boundaries
    const topThird = viewportHeight / 3;
    const bottomThird = viewportHeight * 2 / 3;

    // Check if element is within the middle third
    const elementTop = rect.top;
    const elementBottom = rect.bottom;

    // If the element is mostly visible in the middle third, don't scroll
    const isInMiddleThird = elementTop >= topThird - 50 && elementBottom <= bottomThird + 50;

    if (!isInMiddleThird) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Jump to next paragraph with risks
function jumpToNextRisk() {
    const content = AppState.document?.content || [];
    const risks = AppState.analysis?.risk_by_paragraph || {};
    const paragraphs = content.filter(p => p.type === 'paragraph');

    let currentIdx = -1;
    if (AppState.selectedParaId) {
        currentIdx = paragraphs.findIndex(p => p.id === AppState.selectedParaId);
    }

    // Find next paragraph with risks
    for (let i = currentIdx + 1; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        if ((risks[para.id] || []).length > 0) {
            jumpToParagraph(para.id);
            return;
        }
    }

    // Wrap around to beginning
    for (let i = 0; i <= currentIdx; i++) {
        const para = paragraphs[i];
        if ((risks[para.id] || []).length > 0) {
            jumpToParagraph(para.id);
            showToast('Wrapped to beginning', 'info');
            return;
        }
    }

    showToast('No more risks found', 'info');
}

// Jump to next unreviewed paragraph
function jumpToNextUnreviewed() {
    const content = AppState.document?.content || [];
    const paragraphs = content.filter(p => p.type === 'paragraph');
    const risks = AppState.analysis?.risk_by_paragraph || {};

    let currentIdx = -1;
    if (AppState.selectedParaId) {
        currentIdx = paragraphs.findIndex(p => p.id === AppState.selectedParaId);
    }

    // Find next unreviewed paragraph with risks
    for (let i = currentIdx + 1; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const hasRisks = (risks[para.id] || []).length > 0;
        const isReviewed = AppState.revisions[para.id]?.accepted;

        if (hasRisks && !isReviewed) {
            jumpToParagraph(para.id);
            return;
        }
    }

    // Wrap around
    for (let i = 0; i <= currentIdx; i++) {
        const para = paragraphs[i];
        const hasRisks = (risks[para.id] || []).length > 0;
        const isReviewed = AppState.revisions[para.id]?.accepted;

        if (hasRisks && !isReviewed) {
            jumpToParagraph(para.id);
            showToast('Wrapped to beginning', 'info');
            return;
        }
    }

    showToast('All clauses reviewed!', 'success');
}

// Update navigation progress
function updateNavProgress() {
    const content = AppState.document?.content || [];
    const paragraphs = content.filter(p => p.type === 'paragraph');
    const risks = AppState.analysis?.risk_by_paragraph || {};

    // Count paragraphs with risks
    const withRisks = paragraphs.filter(p => (risks[p.id] || []).length > 0);
    const reviewed = withRisks.filter(p => AppState.revisions[p.id]?.accepted);

    const reviewedCount = document.getElementById('nav-reviewed-count');
    const progressBar = document.getElementById('nav-progress-bar');

    if (reviewedCount) {
        reviewedCount.textContent = `${reviewed.length}/${withRisks.length}`;
    }

    if (progressBar && withRisks.length > 0) {
        const percent = Math.round((reviewed.length / withRisks.length) * 100);
        progressBar.style.width = `${percent}%`;
    }
}

// Update risk summary counts
function updateNavRiskSummary() {
    const riskInventory = AppState.analysis?.risk_inventory || [];

    let high = 0, medium = 0, low = 0;

    riskInventory.forEach(risk => {
        const severity = (risk.severity || 'medium').toLowerCase();
        if (severity === 'high') high++;
        else if (severity === 'medium') medium++;
        else low++;
    });

    const highEl = document.getElementById('nav-high-risks');
    const mediumEl = document.getElementById('nav-medium-risks');
    const lowEl = document.getElementById('nav-low-risks');

    if (highEl) highEl.textContent = high;
    if (mediumEl) mediumEl.textContent = medium;
    if (lowEl) lowEl.textContent = low;
}

// Update all nav panel stats
function updateNavPanel() {
    renderDocumentOutline();
    updateNavProgress();
    updateNavRiskSummary();
}

// Export functions
window.initNavigation = initNavigation;
window.toggleNavPanel = toggleNavPanel;
window.setReviewMode = setReviewMode;
window.renderDocumentOutline = renderDocumentOutline;
window.filterOutline = filterOutline;
window.jumpToParagraph = jumpToParagraph;
window.jumpToNextRisk = jumpToNextRisk;
window.jumpToNextUnreviewed = jumpToNextUnreviewed;
window.updateNavProgress = updateNavProgress;
window.updateNavRiskSummary = updateNavRiskSummary;
window.updateNavPanel = updateNavPanel;
