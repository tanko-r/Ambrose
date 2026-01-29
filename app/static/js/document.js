/**
 * Document rendering and interaction
 */

// Load document from API
async function loadDocument() {
    const result = await api(`/document/${AppState.sessionId}`);
    AppState.document = result;
    renderDocument();
}

// Render document content
function renderDocument() {
    const container = document.getElementById('document-content');
    const content = AppState.document.content.filter(item => item.type === 'paragraph');

    let html = '<div class="document-title">Contract Under Review</div>';

    content.forEach(para => {
        const hasRisk = AppState.analysis?.risk_by_paragraph?.[para.id]?.length > 0;
        const revision = AppState.revisions[para.id];
        const hasRevision = !!revision;
        const isAccepted = hasRevision && revision.accepted;
        const isFlagged = AppState.flags.some(f => f.para_id === para.id);

        let classes = ['para-block'];
        if (hasRisk) classes.push('has-risk');
        if (hasRevision) classes.push('has-revision');
        if (isAccepted) classes.push('revision-accepted');
        if (isFlagged) classes.push('flagged');
        if (para.id === AppState.selectedParaId) classes.push('selected');

        // Format text content
        let displayContent;

        if (isAccepted && revision.editedHtml) {
            // Show the accepted revision with track changes formatting
            displayContent = revision.editedHtml;
        } else if (isAccepted && revision.diff_html) {
            // Fallback to original diff_html if no user edits
            displayContent = revision.diff_html;
        } else {
            // Show original text
            let displayText = para.text;
            displayText = displayText.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');
            displayContent = escapeHtml(displayText);
        }

        // Build rationale tooltip for accepted revisions
        const rationaleAttr = isAccepted && revision.rationale
            ? `data-rationale="${escapeAttr(revision.rationale)}"`
            : '';

        html += `
            <div class="${classes.join(' ')}" data-para-id="${para.id}" ${rationaleAttr}
                 onclick="selectParagraph('${para.id}')"
                 ${isAccepted ? `onmouseenter="showRevisionTooltip(event, '${para.id}')" onmouseleave="hideRevisionTooltip()"` : ''}>
                ${para.section_ref ? `<div class="para-ref">${para.section_ref}</div>` : ''}
                <div class="para-text ${isAccepted ? 'has-track-changes' : ''}">${displayContent}</div>
                <div class="para-indicators">
                    ${hasRisk ? '<div class="indicator risk" title="Has risks"></div>' : ''}
                    ${hasRevision ? '<div class="indicator revision" title="Has revision"></div>' : ''}
                    ${isFlagged ? '<div class="indicator flag" title="Flagged"></div>' : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Escape attribute value
function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Tooltip element for revision rationale
let tooltipEl = null;

// Show rationale tooltip on hover
function showRevisionTooltip(event, paraId) {
    const revision = AppState.revisions[paraId];
    if (!revision || !revision.rationale) return;

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'revision-tooltip';
        document.body.appendChild(tooltipEl);
    }

    tooltipEl.innerHTML = `<strong>Rationale:</strong> ${escapeHtml(revision.rationale)}`;
    tooltipEl.style.display = 'block';

    // Position near cursor
    const rect = event.target.closest('.para-block').getBoundingClientRect();
    tooltipEl.style.left = `${rect.left}px`;
    tooltipEl.style.top = `${rect.bottom + 5}px`;
    tooltipEl.style.maxWidth = `${rect.width}px`;
}

// Hide rationale tooltip
function hideRevisionTooltip() {
    if (tooltipEl) {
        tooltipEl.style.display = 'none';
    }
}

// Highlight risks in document
function highlightRisks() {
    if (!AppState.analysis) return;

    const riskParas = Object.keys(AppState.analysis.risk_by_paragraph || {});
    riskParas.forEach(paraId => {
        const el = document.querySelector(`[data-para-id="${paraId}"]`);
        if (el) el.classList.add('has-risk');
    });
}

// Select paragraph and show sidebar
async function selectParagraph(paraId) {
    // Clear any focused risk when changing paragraphs
    if (AppState.selectedParaId !== paraId) {
        unfocusRisk();
        // Clear related clause selections when switching paragraphs
        if (typeof clearRelatedSelection === 'function') {
            clearRelatedSelection();
        }
    }

    // Update selection
    document.querySelectorAll('.para-block.selected').forEach(el => el.classList.remove('selected'));
    const el = document.querySelector(`[data-para-id="${paraId}"]`);
    if (el) el.classList.add('selected');

    AppState.selectedParaId = paraId;

    // Find paragraph data
    const para = AppState.document.content.find(p => p.id === paraId);
    if (!para) return;

    // Update sidebar
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('hidden');

    document.getElementById('sidebar-section-title').textContent = para.caption || 'Selected Clause';
    document.getElementById('sidebar-section-ref').textContent = para.section_ref || paraId;

    // Build and render sidebar content
    renderSidebarContent(paraId, para);
}

// Highlighting state
let focusedRiskId = null;
let focusedParaId = null;
let focusedProblematicText = null;

// Highlighting functions
function highlightProblematicText(paraId, problematicText, riskId = null) {
    if (!problematicText) return;

    // Don't clear if we have a focused risk and this is just a hover
    if (focusedRiskId && riskId !== focusedRiskId) return;

    clearHighlightsInternal();

    const paraEl = document.querySelector(`[data-para-id="${paraId}"]`);
    if (!paraEl) return;

    const textEl = paraEl.querySelector('.para-text');
    if (!textEl) return;

    const originalText = textEl.textContent;
    // Normalize the search text (handle tabs/spaces)
    const searchText = problematicText.trim().replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');

    // Find the problematic text in the paragraph (case-insensitive, partial match)
    const lowerOriginal = originalText.toLowerCase();
    const lowerSearch = searchText.toLowerCase();

    // Try exact match first, then partial
    let startIndex = lowerOriginal.indexOf(lowerSearch);

    if (startIndex === -1) {
        // Try matching first 50 chars if full match fails
        const partialSearch = lowerSearch.substring(0, 50);
        startIndex = lowerOriginal.indexOf(partialSearch);
    }

    if (startIndex !== -1) {
        const matchLength = startIndex !== -1 && lowerOriginal.indexOf(lowerSearch) !== -1
            ? searchText.length
            : Math.min(50, searchText.length);

        const before = originalText.substring(0, startIndex);
        const match = originalText.substring(startIndex, startIndex + matchLength);
        const after = originalText.substring(startIndex + matchLength);

        textEl.innerHTML = escapeHtml(before) +
            '<span class="highlight-risk-active">' + escapeHtml(match) + '</span>' +
            escapeHtml(after);

        // Scroll the highlight into view
        const highlightEl = textEl.querySelector('.highlight-risk-active');
        if (highlightEl) {
            highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Internal clear - always clears
function clearHighlightsInternal() {
    document.querySelectorAll('.para-text').forEach(el => {
        if (el.querySelector('.highlight-risk-active')) {
            el.textContent = el.textContent; // Reset to plain text
        }
    });
}

// Public clear - respects focus lock
function clearHighlights() {
    // Don't clear if a risk is focused
    if (focusedRiskId) return;
    clearHighlightsInternal();
}

// Focus/lock a risk card
function focusRisk(paraId, problematicText, riskId) {
    // If clicking the same risk, unfocus it
    if (focusedRiskId === riskId) {
        unfocusRisk();
        return;
    }

    // Unfocus previous
    unfocusRisk();

    // Focus new risk
    focusedRiskId = riskId;
    focusedParaId = paraId;
    focusedProblematicText = problematicText;

    // Update card styling
    const card = document.querySelector(`[data-risk-id="${riskId}"]`);
    if (card) {
        card.classList.add('risk-card-focused');
    }

    // Highlight the text
    highlightProblematicText(paraId, problematicText, riskId);
}

// Unfocus/unlock risk
function unfocusRisk() {
    if (focusedRiskId) {
        const card = document.querySelector(`[data-risk-id="${focusedRiskId}"]`);
        if (card) {
            card.classList.remove('risk-card-focused');
        }
    }
    focusedRiskId = null;
    focusedParaId = null;
    focusedProblematicText = null;
    clearHighlightsInternal();
}

// Export for use in other modules
window.loadDocument = loadDocument;
window.renderDocument = renderDocument;
window.highlightRisks = highlightRisks;
window.selectParagraph = selectParagraph;
window.highlightProblematicText = highlightProblematicText;
window.clearHighlights = clearHighlights;
window.focusRisk = focusRisk;
window.unfocusRisk = unfocusRisk;
window.showRevisionTooltip = showRevisionTooltip;
window.hideRevisionTooltip = hideRevisionTooltip;
window.escapeAttr = escapeAttr;
