/**
 * Sidebar rendering and interactions
 */

// Track which risk is currently expanded (accordion behavior)
let expandedRiskId = null;

// Track risk selection state: 'included', 'excluded', or null (default = included)
// Key format: `${paraId}_${riskId}`
const riskSelectionState = {};

// Get risk selection state
function getRiskSelection(paraId, riskId) {
    const key = `${paraId}_${riskId}`;
    return riskSelectionState[key] || null; // null = default (included)
}

// Set risk selection state
function setRiskSelection(paraId, riskId, state) {
    const key = `${paraId}_${riskId}`;
    if (state === null) {
        delete riskSelectionState[key];
    } else {
        riskSelectionState[key] = state;
    }
    updateSidebarFooter(paraId);
}

// Toggle risk selection: null -> excluded -> included -> null
function toggleRiskSelection(paraId, riskId, action) {
    const current = getRiskSelection(paraId, riskId);
    let newState;

    if (action === 'include') {
        newState = current === 'included' ? null : 'included';
    } else if (action === 'exclude') {
        newState = current === 'excluded' ? null : 'excluded';
    }

    setRiskSelection(paraId, riskId, newState);

    // Re-render to update UI
    const para = AppState.document?.content?.find(p => p.id === paraId);
    if (para) {
        renderSidebarContent(paraId, para);
    }
}

// Get all selected risk IDs for a paragraph (included or default)
function getSelectedRiskIds(paraId) {
    const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];
    return risks
        .filter(risk => {
            const state = getRiskSelection(paraId, risk.risk_id);
            return state !== 'excluded'; // Include if not explicitly excluded
        })
        .map(risk => risk.risk_id);
}

// Check if a risk has been addressed (paragraph has accepted revision)
function isRiskAddressed(paraId, riskId) {
    const revision = AppState.revisions?.[paraId];
    return revision?.accepted === true;
}

// Render sidebar content for selected paragraph
function renderSidebarContent(paraId, para) {
    let html = '';

    // Show risks for this paragraph
    const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];
    if (risks.length > 0) {
        html += '<div class="sidebar-section">';
        html += `<div class="sidebar-section-title">Risks (${risks.length})</div>`;
        html += '<div class="risk-accordion">';

        risks.forEach((risk, idx) => {
            const isExpanded = expandedRiskId === risk.risk_id;
            const isAddressed = isRiskAddressed(paraId, risk.risk_id);
            const selectionState = getRiskSelection(paraId, risk.risk_id);
            const isIncluded = selectionState === 'included';
            const isExcluded = selectionState === 'excluded';
            const isDefault = selectionState === null;

            const relatedClauses = risk.related_para_ids
                ? buildRelatedClausesHtml(risk.related_para_ids, paraId)
                : '';

            // Store problematic text as data attribute (base64 to avoid escaping issues)
            const problematicTextEncoded = btoa(encodeURIComponent(risk.problematic_text || ''));

            html += `
                <div class="risk-item ${isExpanded ? 'expanded' : ''} ${isAddressed ? 'addressed' : ''} ${isExcluded ? 'excluded' : ''} severity-${risk.severity}"
                     data-risk-id="${risk.risk_id}"
                     data-para-id="${paraId}"
                     data-problematic-text="${problematicTextEncoded}">
                    <div class="risk-header">
                        <div class="risk-selection-toggle">
                            <button class="risk-toggle-btn ${isIncluded ? 'active' : ''}"
                                    data-action="include"
                                    title="Include in revision">+</button>
                            <button class="risk-toggle-btn ${isExcluded ? 'active exclude' : ''}"
                                    data-action="exclude"
                                    title="Exclude from revision">&#8856;</button>
                        </div>
                        <div class="risk-header-main" data-action="toggle">
                            <div class="risk-header-left">
                                ${isAddressed ? '<span class="risk-check">&#10003;</span>' : ''}
                                <span class="risk-title">${risk.title || formatRiskType(risk.type)}</span>
                            </div>
                            <div class="risk-header-right">
                                <span class="risk-severity-badge ${risk.severity}">${risk.severity.toUpperCase()}</span>
                                <span class="risk-chevron">${isExpanded ? '&#9650;' : '&#9660;'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="risk-body" style="display: ${isExpanded ? 'block' : 'none'}">
                        ${risk.user_recommendation ? `<div class="risk-recommendation">${escapeHtml(risk.user_recommendation)}</div>` : ''}
                        <div class="risk-description">${escapeHtml(risk.description)}</div>
                        ${relatedClauses}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        html += '</div>';
    }

    // Show opportunities
    const opportunities = AppState.analysis?.opportunities?.filter(o => o.para_id === paraId) || [];
    if (opportunities.length > 0) {
        html += '<div class="sidebar-section">';
        html += '<div class="sidebar-section-title">Opportunities</div>';
        opportunities.forEach(opp => {
            html += `
                <div class="opportunity-card">
                    <div class="opportunity-type">${opp.description}</div>
                    <div class="risk-description">${opp.recommendation}</div>
                </div>
            `;
        });
        html += '</div>';
    }

    // Show revision indicator and open bottom sheet if revision exists
    const revision = AppState.revisions[paraId];
    if (revision) {
        html += '<div class="sidebar-section">';
        html += '<div class="sidebar-section-title">Proposed Revision</div>';
        html += `<div class="revision-indicator ${revision.accepted ? 'accepted' : ''}" onclick="showBottomSheet('${paraId}')">`;
        if (revision.accepted) {
            html += '<span class="revision-status">&#10003; Accepted</span>';
        } else {
            html += '<span class="revision-status">&#9998; Pending Review</span>';
        }
        html += '<span class="revision-view-link">View in panel below &#8595;</span>';
        html += '</div>';
        html += '</div>';

        // Auto-show bottom sheet when selecting a paragraph with revision
        setTimeout(() => showBottomSheet(paraId), 100);
    } else {
        // Hide bottom sheet if no revision for this paragraph
        hideBottomSheet();
    }

    document.getElementById('sidebar-content').innerHTML = html;

    // Update related selection panel
    updateRelatedSelectionPanel(paraId);

    // Update footer with current selection
    updateSidebarFooter(paraId);
}

// Update sidebar footer with selection count and enable/disable button
function updateSidebarFooter(paraId) {
    const footer = document.getElementById('sidebar-footer');
    const footerInfo = document.getElementById('sidebar-footer-info');
    const generateBtn = document.getElementById('btn-generate-revision');
    const flagBtn = document.getElementById('btn-flag-client');

    if (!footer || !paraId) return;

    const selectedRisks = getSelectedRiskIds(paraId);
    const totalRisks = (AppState.analysis?.risk_by_paragraph?.[paraId] || []).length;

    // Update info text
    if (totalRisks > 0) {
        footerInfo.textContent = `${selectedRisks.length} of ${totalRisks} risks selected`;
    } else {
        footerInfo.textContent = '';
    }

    // Enable/disable generate button
    generateBtn.disabled = selectedRisks.length === 0;

    // Store paraId for button handlers
    generateBtn.dataset.paraId = paraId;
    flagBtn.dataset.paraId = paraId;
}

// Update stats display
function updateStats() {
    const riskCount = AppState.analysis?.summary?.total_risks || 0;
    const revisionCount = Object.values(AppState.revisions).filter(r => r.accepted).length;
    const flagCount = AppState.flags.length;

    document.getElementById('stat-risks').textContent = riskCount;
    document.getElementById('stat-revisions').textContent = revisionCount;
    document.getElementById('stat-flags').textContent = flagCount;
}

// Setup event delegation for risk cards (call once on page load)
function setupRiskCardEvents() {
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebarContent) return;

    // Click handler
    sidebarContent.addEventListener('click', (e) => {
        // Check if clicked on include/exclude toggle
        const toggleBtn = e.target.closest('[data-action="include"], [data-action="exclude"]');
        if (toggleBtn) {
            e.stopPropagation();
            const item = toggleBtn.closest('.risk-item');
            if (item) {
                const paraId = item.dataset.paraId;
                const riskId = item.dataset.riskId;
                const action = toggleBtn.dataset.action;
                toggleRiskSelection(paraId, riskId, action);
            }
            return;
        }

        // Check if clicked on risk header (toggle accordion)
        const header = e.target.closest('[data-action="toggle"]');
        if (header) {
            const item = header.closest('.risk-item');
            if (item) {
                const riskId = item.dataset.riskId;
                const paraId = item.dataset.paraId;
                toggleRiskAccordion(riskId, paraId);
            }
            return;
        }

        // Check if clicked on risk item (for focus/highlight)
        const item = e.target.closest('.risk-item');
        if (item) {
            const paraId = item.dataset.paraId;
            const riskId = item.dataset.riskId;
            const problematicText = decodeProblematicText(item.dataset.problematicText);
            focusRisk(paraId, problematicText, riskId);
        }
    });

    // Setup footer button handlers
    setupFooterButtons();

    // Use mouseover/mouseout for delegation (they bubble, unlike mouseenter/mouseleave)
    let currentHoveredItem = null;

    sidebarContent.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.risk-item');
        if (item && item !== currentHoveredItem) {
            currentHoveredItem = item;
            const paraId = item.dataset.paraId;
            const riskId = item.dataset.riskId;
            const problematicText = decodeProblematicText(item.dataset.problematicText);
            highlightProblematicText(paraId, problematicText, riskId);
        }
    });

    sidebarContent.addEventListener('mouseout', (e) => {
        const item = e.target.closest('.risk-item');
        // Only clear if we're actually leaving the item (not just moving between children)
        if (item && !item.contains(e.relatedTarget)) {
            currentHoveredItem = null;
            clearHighlights();
        }
    });
}

// Toggle accordion - expand one, collapse others
function toggleRiskAccordion(riskId, paraId) {
    if (expandedRiskId === riskId) {
        // Collapse current
        expandedRiskId = null;
    } else {
        // Expand this one (will collapse others via re-render)
        expandedRiskId = riskId;
    }

    // Re-render to update accordion state
    const para = AppState.document?.content?.find(p => p.id === paraId);
    if (para) {
        renderSidebarContent(paraId, para);
    }
}

// Decode base64 problematic text
function decodeProblematicText(encoded) {
    if (!encoded) return '';
    try {
        return decodeURIComponent(atob(encoded));
    } catch (e) {
        console.error('Failed to decode problematic text:', e);
        return '';
    }
}

// Setup footer button click handlers
function setupFooterButtons() {
    const generateBtn = document.getElementById('btn-generate-revision');
    const flagBtn = document.getElementById('btn-flag-client');

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const paraId = generateBtn.dataset.paraId;
            if (paraId) {
                const selectedRiskIds = getSelectedRiskIds(paraId);
                // Use the selected related clauses from the quick selection panel
                const selectedRelated = getSelectedRelatedClauseIds();
                generateRevisionForRisks(paraId, selectedRiskIds, selectedRelated);
            }
        });
    }

    if (flagBtn) {
        flagBtn.addEventListener('click', () => {
            const paraId = flagBtn.dataset.paraId;
            if (paraId) {
                showFlagModal(paraId);
            }
        });
    }
}

// Generate revision for selected risks
async function generateRevisionForRisks(paraId, riskIds, includeRelatedIds = []) {
    if (!riskIds || riskIds.length === 0) {
        showToast('No risks selected', 'warning');
        return;
    }

    const msg = includeRelatedIds.length > 0
        ? `Generating revision with ${includeRelatedIds.length} related clause(s)...`
        : `Generating revision for ${riskIds.length} risk(s)...`;
    showToast(msg, 'info');

    // Collect all related clause IDs from selected risks
    const allRelatedIds = new Set();
    const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];
    riskIds.forEach(riskId => {
        const risk = risks.find(r => r.risk_id === riskId);
        if (risk?.related_para_ids) {
            risk.related_para_ids.split(',').forEach(id => allRelatedIds.add(id.trim()));
        }
    });

    try {
        const result = await api('/revise', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                para_id: paraId,
                risk_ids: riskIds,
                include_related_ids: includeRelatedIds  // Related clauses to include in context
            })
        });

        AppState.revisions[paraId] = {
            original: result.original,
            revised: result.revised,
            rationale: result.rationale,
            thinking: result.thinking,
            diff_html: result.diff_html,
            accepted: false,
            riskIds: riskIds,
            includedRelatedIds: includeRelatedIds,
            allRelatedIds: Array.from(allRelatedIds),
            relatedRevisions: result.related_revisions || [],
            relatedSuggestions: result.related_suggestions || []
        };

        renderDocument();
        selectParagraph(paraId);
        updateStats();
        showBottomSheet(paraId); // Show the bottom sheet with revision
        showToast('Revision generated', 'success');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Get paragraph info for related clause display
function getParaInfo(paraId) {
    const para = AppState.document?.content?.find(p => p.id === paraId);
    if (!para) return null;

    // Get first ~80 chars of text as summary
    let summary = para.text?.substring(0, 80) || '';
    if (para.text?.length > 80) summary += '...';

    // Check if this clause has been revised
    const hasRevision = !!AppState.revisions[paraId];
    const isAccepted = hasRevision && AppState.revisions[paraId].accepted;

    return {
        id: paraId,
        sectionRef: para.section_ref || paraId,
        caption: para.caption || '',
        summary: summary,
        hasRevision: hasRevision,
        isAccepted: isAccepted
    };
}

// Build HTML for related clauses section
function buildRelatedClausesHtml(relatedParaIds, currentParaId) {
    if (!relatedParaIds) return '';

    const paraIds = relatedParaIds.split(',').map(id => id.trim()).filter(id => id);
    if (paraIds.length === 0) return '';

    // Check if any related clauses have been revised
    const revisedRelated = paraIds.filter(id => AppState.revisions[id]?.accepted);

    let html = '<div class="related-clauses">';
    html += '<div class="related-clauses-header">';
    html += `<span class="related-clauses-title">Related Clauses (${paraIds.length})</span>`;

    // Show re-analyze button if any related clauses have been revised
    if (revisedRelated.length > 0) {
        html += `<button class="btn btn-xs btn-outline reanalyze-btn"
                         onclick="event.stopPropagation(); reanalyzeClause('${currentParaId}')"
                         title="${revisedRelated.length} related clause(s) revised">
                    &#8635; Re-analyze
                </button>`;
    }
    html += '</div>';

    html += '<div class="related-clauses-list">';
    paraIds.forEach(id => {
        const info = getParaInfo(id);
        if (!info) return;

        const revisionIndicator = info.isAccepted
            ? '<span class="related-revised" title="This clause has been revised">&#10003;</span>'
            : (info.hasRevision ? '<span class="related-pending" title="Revision pending">&#9998;</span>' : '');

        html += `
            <div class="related-clause-card" data-para-id="${id}"
                 onclick="event.stopPropagation(); openClauseViewer('${id}')">
                <div class="related-clause-header">
                    <span class="related-clause-ref">${escapeHtml(info.sectionRef)}</span>
                    ${revisionIndicator}
                    <button class="split-view-btn" onclick="event.stopPropagation(); openSplitView('${currentParaId}', '${id}')" title="Compare side-by-side">
                        &#9707;
                    </button>
                </div>
                ${info.caption ? `<div class="related-clause-caption">${escapeHtml(info.caption)}</div>` : ''}
                <div class="related-clause-summary">${escapeHtml(info.summary)}</div>
            </div>
        `;
    });
    html += '</div>';
    html += '</div>';

    return html;
}

// Clause viewer state
let clauseViewerFocusedId = null;
let clauseViewerEdits = {}; // Track edits by para_id

// Open clause viewer bottom sheet
function openClauseViewer(focusParaId) {
    const sheet = document.getElementById('clause-viewer-sheet');
    const docContainer = document.getElementById('clause-viewer-doc');
    const title = document.getElementById('clause-viewer-title');
    const applyBtn = document.getElementById('btn-apply-clause-edits');
    const flagBtn = document.getElementById('btn-flag-clause');

    clauseViewerFocusedId = focusParaId;
    clauseViewerEdits = {};

    // Get the focused paragraph info
    const focusPara = AppState.document?.content?.find(p => p.id === focusParaId);
    title.textContent = focusPara?.section_ref || 'Related Clause';

    // Render all paragraphs in the viewer
    const paragraphs = AppState.document?.content?.filter(p => p.type === 'paragraph') || [];
    let html = '';

    paragraphs.forEach(para => {
        const isFocused = para.id === focusParaId;
        const hasRevision = !!AppState.revisions[para.id];
        const isAccepted = hasRevision && AppState.revisions[para.id].accepted;

        let classes = ['clause-viewer-para'];
        if (isFocused) classes.push('focused');
        if (hasRevision) classes.push('has-revision');

        // Get display content
        let displayContent;
        if (isAccepted && AppState.revisions[para.id].editedHtml) {
            displayContent = AppState.revisions[para.id].editedHtml;
        } else {
            displayContent = escapeHtml(para.text.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0'));
        }

        html += `
            <div class="${classes.join(' ')}" data-para-id="${para.id}"
                 onclick="focusClauseInViewer('${para.id}')">
                <div class="clause-viewer-para-ref">${escapeHtml(para.section_ref || para.id)}</div>
                <div class="clause-viewer-para-text" data-para-id="${para.id}">${displayContent}</div>
            </div>
        `;
    });

    docContainer.innerHTML = html;

    // Setup editing on focused paragraph
    setupClauseViewerEditing();

    // Wire up buttons
    applyBtn.onclick = applyClauseViewerEdits;
    applyBtn.disabled = true;
    flagBtn.onclick = () => showFlagModal(clauseViewerFocusedId);

    // Show the sheet
    sheet.classList.add('show');

    // Scroll to focused paragraph
    setTimeout(() => {
        const focusedEl = docContainer.querySelector('.focused');
        if (focusedEl) {
            focusedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

// Close clause viewer
function closeClauseViewer() {
    const sheet = document.getElementById('clause-viewer-sheet');
    sheet.classList.remove('show');
    clauseViewerFocusedId = null;
    clauseViewerEdits = {};
}

// Focus a different clause in the viewer
function focusClauseInViewer(paraId) {
    const docContainer = document.getElementById('clause-viewer-doc');

    // Remove previous focus
    docContainer.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
    docContainer.querySelectorAll('.editing').forEach(el => {
        el.classList.remove('editing');
        const textEl = el.querySelector('.clause-viewer-para-text');
        if (textEl) textEl.contentEditable = 'false';
    });

    // Set new focus
    clauseViewerFocusedId = paraId;
    const paraEl = docContainer.querySelector(`[data-para-id="${paraId}"]`);
    if (paraEl) {
        paraEl.classList.add('focused');
        paraEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Update title
    const para = AppState.document?.content?.find(p => p.id === paraId);
    document.getElementById('clause-viewer-title').textContent = para?.section_ref || 'Clause';

    // Setup editing
    setupClauseViewerEditing();
}

// Clause viewer undo stack
let clauseViewerUndoStack = [];

// Setup editing for the focused clause with Word-style track changes
function setupClauseViewerEditing() {
    const docContainer = document.getElementById('clause-viewer-doc');
    const focusedPara = docContainer.querySelector('.focused');
    if (!focusedPara) return;

    const textEl = focusedPara.querySelector('.clause-viewer-para-text');
    if (!textEl) return;

    // Clone to remove existing listeners
    const newTextEl = textEl.cloneNode(true);
    textEl.parentNode.replaceChild(newTextEl, textEl);

    // Make editable
    newTextEl.contentEditable = 'true';
    focusedPara.classList.add('editing');

    // Clear undo stack
    clauseViewerUndoStack = [];

    // Add track changes event handlers
    newTextEl.addEventListener('beforeinput', handleClauseViewerBeforeInput);
    newTextEl.addEventListener('keydown', handleClauseViewerKeydown);
}

// Save undo state for clause viewer
function saveClauseViewerUndo(textEl) {
    clauseViewerUndoStack.push(textEl.innerHTML);
    if (clauseViewerUndoStack.length > 50) clauseViewerUndoStack.shift();
}

// Handle beforeinput for clause viewer - insert with track changes
function handleClauseViewerBeforeInput(e) {
    if (e.inputType === 'insertText' || e.inputType === 'insertParagraph') {
        e.preventDefault();
        const textEl = e.target;
        saveClauseViewerUndo(textEl);

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // If there's a selection, wrap it as deleted first
        if (!range.collapsed) {
            wrapClauseViewerRangeAsDeleted(range);
        }

        const text = e.inputType === 'insertParagraph' ? '\n' : (e.data || '');
        insertClauseViewerText(text);

        markClauseViewerEdited(textEl);
    }
}

// Handle keydown for clause viewer - backspace/delete with track changes
function handleClauseViewerKeydown(e) {
    const textEl = e.target;

    // Handle Ctrl+Z (undo)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (clauseViewerUndoStack.length > 0) {
            textEl.innerHTML = clauseViewerUndoStack.pop();
            markClauseViewerEdited(textEl);
        }
        return;
    }

    // Handle backspace and delete
    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        saveClauseViewerUndo(textEl);

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (!range.collapsed) {
            // Selection exists - wrap as deleted
            wrapClauseViewerRangeAsDeleted(range);
        } else {
            // No selection - select character to delete
            if (e.key === 'Backspace') {
                selectClauseViewerCharBefore(range);
            } else {
                selectClauseViewerCharAfter(range);
            }
            const newRange = selection.getRangeAt(0);
            if (!newRange.collapsed) {
                wrapClauseViewerRangeAsDeleted(newRange);
            }
        }

        markClauseViewerEdited(textEl);
    }
}

// Wrap range as deleted in clause viewer
function wrapClauseViewerRangeAsDeleted(range) {
    const container = range.commonAncestorContainer;
    const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    // If it's user-added text, actually delete it
    if (parent?.classList?.contains('user-addition')) {
        range.deleteContents();
        if (parent.textContent === '') parent.remove();
        return;
    }

    const contents = range.extractContents();
    if (!contents.textContent.trim() && contents.childNodes.length === 0) return;

    const span = document.createElement('span');
    span.className = 'user-deletion';
    span.appendChild(contents);
    range.insertNode(span);

    // Move cursor after
    const selection = window.getSelection();
    const newRange = document.createRange();
    newRange.setStartAfter(span);
    newRange.setEndAfter(span);
    selection.removeAllRanges();
    selection.addRange(newRange);
}

// Select character before cursor in clause viewer
function selectClauseViewerCharBefore(range) {
    const selection = window.getSelection();
    let node = range.startContainer;
    let offset = range.startOffset;

    // Skip user-deletion spans
    while (node) {
        const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (parent?.classList?.contains('user-deletion')) {
            const delSpan = parent;
            if (delSpan.previousSibling) {
                node = delSpan.previousSibling;
                offset = node.nodeType === Node.TEXT_NODE ? node.length : (node.childNodes?.length || 0);
            } else {
                return;
            }
        } else {
            break;
        }
    }

    if (node.nodeType === Node.TEXT_NODE && offset > 0) {
        range.setStart(node, offset - 1);
        range.setEnd(node, offset);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// Select character after cursor in clause viewer
function selectClauseViewerCharAfter(range) {
    const selection = window.getSelection();
    let node = range.startContainer;
    let offset = range.startOffset;

    // Skip user-deletion spans
    while (node) {
        const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (parent?.classList?.contains('user-deletion')) {
            const delSpan = parent;
            if (delSpan.nextSibling) {
                node = delSpan.nextSibling;
                offset = 0;
            } else {
                return;
            }
        } else {
            break;
        }
    }

    if (node.nodeType === Node.TEXT_NODE && offset < node.length) {
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// Insert text with track changes styling in clause viewer
function insertClauseViewerText(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    // If inside user-addition span, append to it
    if (container.nodeType === Node.TEXT_NODE &&
        container.parentElement?.classList?.contains('user-addition')) {
        const offset = range.startOffset;
        const currentText = container.textContent;
        container.textContent = currentText.slice(0, offset) + text + currentText.slice(offset);
        const newRange = document.createRange();
        newRange.setStart(container, offset + text.length);
        newRange.setEnd(container, offset + text.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
        return;
    }

    // Check if previous sibling is user-addition
    const prevNode = range.startContainer.previousSibling ||
        (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startOffset > 0
            ? range.startContainer.childNodes[range.startOffset - 1] : null);

    if (prevNode?.classList?.contains('user-addition')) {
        prevNode.textContent += text;
        const textNode = prevNode.firstChild;
        const newRange = document.createRange();
        newRange.setStart(textNode, textNode.length);
        newRange.setEnd(textNode, textNode.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
        return;
    }

    // Create new span
    const span = document.createElement('span');
    span.className = 'user-addition';
    span.textContent = text;
    range.insertNode(span);

    const newRange = document.createRange();
    newRange.setStart(span.firstChild, span.firstChild.length);
    newRange.setEnd(span.firstChild, span.firstChild.length);
    selection.removeAllRanges();
    selection.addRange(newRange);
}

// Mark clause viewer paragraph as edited
function markClauseViewerEdited(textEl) {
    const paraId = textEl.dataset.paraId;
    clauseViewerEdits[paraId] = {
        html: textEl.innerHTML,
        text: extractFinalTextFromElement(textEl)
    };

    // Enable apply button
    document.getElementById('btn-apply-clause-edits').disabled =
        Object.keys(clauseViewerEdits).length === 0;
}

// Extract final text (keep additions, remove deletions)
function extractFinalTextFromElement(element) {
    let text = '';
    element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('user-deletion') || node.classList?.contains('diff-del')) {
                return;
            }
            text += node.textContent;
        }
    });
    return text;
}

// Apply edits made in clause viewer
async function applyClauseViewerEdits() {
    const editCount = Object.keys(clauseViewerEdits).length;
    if (editCount === 0) {
        showToast('No edits to apply', 'info');
        return;
    }

    // For each edited paragraph, create/update a revision
    for (const [paraId, edit] of Object.entries(clauseViewerEdits)) {
        const para = AppState.document?.content?.find(p => p.id === paraId);
        if (!para) continue;

        // Create or update revision
        if (!AppState.revisions[paraId]) {
            AppState.revisions[paraId] = {
                original: para.text,
                revised: edit.text,
                editedHtml: edit.html,
                rationale: 'User direct edit from clause viewer',
                accepted: false,
                userEdited: true
            };
        } else {
            AppState.revisions[paraId].revised = edit.text;
            AppState.revisions[paraId].editedHtml = edit.html;
            AppState.revisions[paraId].userEdited = true;
        }

        // Save to backend
        try {
            await api('/accept', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: AppState.sessionId,
                    para_id: paraId
                })
            });
            AppState.revisions[paraId].accepted = true;
        } catch (e) {
            console.error('Failed to save revision:', e);
        }
    }

    renderDocument();
    updateStats();
    closeClauseViewer();
    showToast(`Applied edits to ${editCount} clause(s)`, 'success');
}

// Open split view with two clauses side by side
function openSplitView(currentParaId, relatedParaId) {
    const currentPara = AppState.document?.content?.find(p => p.id === currentParaId);
    const relatedPara = AppState.document?.content?.find(p => p.id === relatedParaId);

    if (!currentPara || !relatedPara) {
        showToast('Could not load clause content', 'error');
        return;
    }

    // Create or update split view modal
    let modal = document.getElementById('split-view-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'split-view-modal';
        modal.className = 'split-view-modal';
        document.body.appendChild(modal);
    }

    const currentRevision = AppState.revisions[currentParaId];
    const relatedRevision = AppState.revisions[relatedParaId];

    modal.innerHTML = `
        <div class="split-view-container">
            <div class="split-view-header">
                <h3>Clause Comparison</h3>
                <button class="split-view-close" onclick="closeSplitView()">&times;</button>
            </div>
            <div class="split-view-content">
                <div class="split-view-pane">
                    <div class="split-view-pane-header">
                        <span class="split-view-ref">${escapeHtml(currentPara.section_ref || currentParaId)}</span>
                        <span class="split-view-label">Current</span>
                    </div>
                    <div class="split-view-text">
                        ${currentRevision?.accepted ? currentRevision.editedHtml || currentRevision.diff_html : escapeHtml(currentPara.text)}
                    </div>
                </div>
                <div class="split-view-divider"></div>
                <div class="split-view-pane">
                    <div class="split-view-pane-header">
                        <span class="split-view-ref">${escapeHtml(relatedPara.section_ref || relatedParaId)}</span>
                        <span class="split-view-label">Related</span>
                        ${relatedRevision?.accepted ? '<span class="split-view-revised">Revised</span>' : ''}
                    </div>
                    <div class="split-view-text">
                        ${relatedRevision?.accepted ? relatedRevision.editedHtml || relatedRevision.diff_html : escapeHtml(relatedPara.text)}
                    </div>
                    <div class="split-view-actions">
                        <button class="btn btn-sm btn-secondary" onclick="closeSplitView(); selectParagraph('${relatedParaId}')">
                            Go to this clause
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('show');
}

// Close split view modal
function closeSplitView() {
    const modal = document.getElementById('split-view-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Re-analyze clause based on revised related clauses
async function reanalyzeClause(paraId) {
    showToast('Re-analyzing clause with updated context...', 'info');

    try {
        const result = await api('/reanalyze', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                para_id: paraId
            })
        });

        // Update the risks for this paragraph
        if (result.risks) {
            AppState.analysis.risk_by_paragraph[paraId] = result.risks;
        }

        // Re-render sidebar
        const para = AppState.document?.content?.find(p => p.id === paraId);
        if (para) {
            renderSidebarContent(paraId, para);
        }

        renderDocument();
        updateStats();
        showToast('Clause re-analyzed with updated context', 'success');

    } catch (error) {
        showToast(error.message || 'Re-analysis failed', 'error');
    }
}

// ============ Related Clauses Quick Selection Panel ============

// Track which related clauses are selected for inclusion
const selectedRelatedClauses = new Set();

// Initialize related selection panel events
function setupRelatedSelectionPanel() {
    const panel = document.getElementById('related-selection-panel');
    const header = document.querySelector('.related-selection-header');
    const toggleBtn = document.getElementById('related-selection-toggle');

    if (header) {
        header.addEventListener('click', () => {
            panel.classList.toggle('collapsed');
        });
    }
}

// Update related selection panel based on selected risks
function updateRelatedSelectionPanel(paraId) {
    const panel = document.getElementById('related-selection-panel');
    const list = document.getElementById('related-selection-list');

    if (!panel || !list) return;

    // Collect all related clause IDs from selected risks
    const selectedRiskIds = getSelectedRiskIds(paraId);
    const allRelatedIds = new Set();

    const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];
    selectedRiskIds.forEach(riskId => {
        const risk = risks.find(r => r.risk_id === riskId);
        if (risk?.related_para_ids) {
            risk.related_para_ids.split(',').forEach(id => {
                const trimmed = id.trim();
                if (trimmed && trimmed !== paraId) {
                    allRelatedIds.add(trimmed);
                }
            });
        }
    });

    // Hide panel if no related clauses
    if (allRelatedIds.size === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    // Build the list HTML
    let html = '';
    const sortedIds = Array.from(allRelatedIds).sort();

    sortedIds.forEach(relId => {
        const info = getParaInfo(relId);
        if (!info) return;

        const isChecked = selectedRelatedClauses.has(relId);
        const revisedIndicator = info.isAccepted
            ? '<span class="related-selection-revised">&#10003; Revised</span>'
            : (info.hasRevision ? '<span class="related-selection-revised" style="color: var(--warning)">Pending</span>' : '');

        html += `
            <label class="related-selection-item ${isChecked ? 'checked' : ''}" data-related-id="${relId}">
                <input type="checkbox" ${isChecked ? 'checked' : ''}
                       onchange="toggleRelatedClauseSelection('${relId}', this.checked, '${paraId}')">
                <span class="related-selection-ref">${escapeHtml(info.sectionRef)}</span>
                <span class="related-selection-summary">${escapeHtml(info.summary)}</span>
                ${revisedIndicator}
            </label>
        `;
    });

    if (html === '') {
        html = '<div class="related-selection-empty">No related clauses found</div>';
    }

    list.innerHTML = html;

    // Update footer info to reflect related clauses
    updateFooterWithRelated(paraId);
}

// Toggle related clause selection
function toggleRelatedClauseSelection(relId, checked, paraId) {
    if (checked) {
        selectedRelatedClauses.add(relId);
    } else {
        selectedRelatedClauses.delete(relId);
    }

    // Update the visual state
    const item = document.querySelector(`.related-selection-item[data-related-id="${relId}"]`);
    if (item) {
        item.classList.toggle('checked', checked);
    }

    // Update footer
    updateFooterWithRelated(paraId);
}

// Update footer to show related clause count
function updateFooterWithRelated(paraId) {
    const footerInfo = document.getElementById('sidebar-footer-info');
    if (!footerInfo) return;

    const selectedRisks = getSelectedRiskIds(paraId);
    const totalRisks = (AppState.analysis?.risk_by_paragraph?.[paraId] || []).length;
    const relatedCount = selectedRelatedClauses.size;

    let text = '';
    if (totalRisks > 0) {
        text = `${selectedRisks.length} of ${totalRisks} risks`;
    }
    if (relatedCount > 0) {
        text += text ? ` + ${relatedCount} related` : `${relatedCount} related clauses`;
    }

    footerInfo.textContent = text;
}

// Clear related selection when changing paragraphs
function clearRelatedSelection() {
    selectedRelatedClauses.clear();
}

// Get selected related clause IDs
function getSelectedRelatedClauseIds() {
    return Array.from(selectedRelatedClauses);
}

// Export for use in other modules
window.renderSidebarContent = renderSidebarContent;
window.updateStats = updateStats;
window.setupRiskCardEvents = setupRiskCardEvents;
window.toggleRiskAccordion = toggleRiskAccordion;
window.toggleRiskSelection = toggleRiskSelection;
window.getSelectedRiskIds = getSelectedRiskIds;
window.generateRevisionForRisks = generateRevisionForRisks;
window.openSplitView = openSplitView;
window.closeSplitView = closeSplitView;
window.reanalyzeClause = reanalyzeClause;
window.getParaInfo = getParaInfo;
window.openClauseViewer = openClauseViewer;
window.closeClauseViewer = closeClauseViewer;
window.focusClauseInViewer = focusClauseInViewer;
window.applyClauseViewerEdits = applyClauseViewerEdits;
window.setupRelatedSelectionPanel = setupRelatedSelectionPanel;
window.updateRelatedSelectionPanel = updateRelatedSelectionPanel;
window.toggleRelatedClauseSelection = toggleRelatedClauseSelection;
window.clearRelatedSelection = clearRelatedSelection;
window.getSelectedRelatedClauseIds = getSelectedRelatedClauseIds;
