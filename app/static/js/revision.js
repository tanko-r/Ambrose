/**
 * Revision management and bottom sheet
 */

// Track current paragraph in bottom sheet
let bottomSheetParaId = null;
let originalDiffHtml = null; // Store original diff for reset
let isUserEditing = false;

// Undo stack for track changes
let undoStack = [];
let redoStack = [];

// Show bottom sheet with revision content
function showBottomSheet(paraId) {
    const revision = AppState.revisions[paraId];
    if (!revision) return;

    bottomSheetParaId = paraId;
    isUserEditing = false;
    const sheet = document.getElementById('revision-sheet');
    const diffEl = document.getElementById('revision-diff');
    const rationaleEl = document.getElementById('revision-rationale');
    const actionsEl = document.getElementById('revision-actions');

    // Use edited HTML if available, otherwise fall back to diff_html
    const displayHtml = revision.editedHtml || revision.diff_html || escapeHtml(revision.revised);

    // Store original diff for potential reset (use non-edited version)
    originalDiffHtml = revision.diff_html || escapeHtml(revision.revised);

    // Populate diff - make it contenteditable (unless accepted)
    diffEl.innerHTML = displayHtml;
    diffEl.contentEditable = revision.accepted ? 'false' : 'true';
    diffEl.classList.remove('user-modified');

    // Populate rationale
    if (revision.rationale) {
        rationaleEl.innerHTML = `<strong>Rationale:</strong> ${escapeHtml(revision.rationale)}`;
        rationaleEl.style.display = 'block';
    } else {
        rationaleEl.style.display = 'none';
    }

    // Show related clauses that weren't included (offer to regenerate with them)
    showRelatedClausesOffer(paraId, revision);

    // Show related revisions from the model (if any)
    showRelatedRevisionsPanel(paraId, revision);

    // Update action buttons based on accepted state
    updateRevisionActions(revision.accepted);

    // Wire up action button events
    setupSheetActionButtons();

    // Setup inline editing handlers
    setupInlineEditing(diffEl);

    // Reset to revision tab when opening
    switchRevisionTab('revision');

    // Show the sheet
    sheet.classList.add('show');
}

// Show related clauses offer if there are unincluded related clauses
function showRelatedClausesOffer(paraId, revision) {
    // Get or create the related clauses container
    let relatedContainer = document.getElementById('revision-related-clauses');
    if (!relatedContainer) {
        relatedContainer = document.createElement('div');
        relatedContainer.id = 'revision-related-clauses';
        relatedContainer.className = 'revision-related-clauses';
        const rationaleEl = document.getElementById('revision-rationale');
        rationaleEl.parentNode.insertBefore(relatedContainer, rationaleEl.nextSibling);
    }

    // Get related clauses that weren't included
    const allRelated = revision.allRelatedIds || [];
    const included = revision.includedRelatedIds || [];
    const notIncluded = allRelated.filter(id => !included.includes(id));

    if (notIncluded.length === 0 || revision.accepted) {
        relatedContainer.style.display = 'none';
        return;
    }

    // Build the related clauses UI
    let html = `
        <div class="related-offer-header">
            <span class="related-offer-title">Related Clauses (${notIncluded.length} not included)</span>
            <button class="btn btn-xs btn-primary" onclick="regenerateWithRelated('${paraId}')">
                Regenerate with All
            </button>
        </div>
        <div class="related-offer-list">
    `;

    notIncluded.forEach(relId => {
        const info = getParaInfo(relId);
        if (!info) return;

        const isChecked = selectedRelatedForRegen.has(relId);
        html += `
            <label class="related-offer-item">
                <input type="checkbox" data-related-id="${relId}"
                       ${isChecked ? 'checked' : ''}
                       onchange="toggleRelatedForRegen('${relId}', this.checked)">
                <span class="related-offer-ref">${escapeHtml(info.sectionRef)}</span>
                <span class="related-offer-summary">${escapeHtml(info.summary)}</span>
            </label>
        `;
    });

    html += '</div>';

    if (included.length > 0) {
        html += `<div class="related-offer-included">Already included: ${included.length} clause(s)</div>`;
    }

    relatedContainer.innerHTML = html;
    relatedContainer.style.display = 'block';
}

// Show related revisions panel (modifications to related clauses from the model)
function showRelatedRevisionsPanel(paraId, revision) {
    // Get or create the related revisions panel
    let panel = document.getElementById('related-revisions-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'related-revisions-panel';
        panel.className = 'related-revisions-panel';
        const actionsEl = document.getElementById('revision-actions');
        actionsEl.parentNode.insertBefore(panel, actionsEl);
    }

    const relatedRevisions = revision.relatedRevisions || [];

    if (relatedRevisions.length === 0 || revision.accepted) {
        panel.style.display = 'none';
        return;
    }

    let html = `
        <div class="related-revisions-header">
            <span class="related-revisions-title">Related Clause Modifications (${relatedRevisions.length})</span>
            <span class="related-revisions-hint">These will be applied when you accept</span>
        </div>
        <div class="related-revisions-list">
    `;

    relatedRevisions.forEach((relRev, idx) => {
        const info = getParaInfo(relRev.id);
        const sectionRef = info?.sectionRef || relRev.id;

        html += `
            <div class="related-revision-item" data-rel-idx="${idx}">
                <div class="related-revision-header">
                    <span class="related-revision-ref">${escapeHtml(sectionRef)}</span>
                    <label class="related-revision-include">
                        <input type="checkbox" checked data-rel-id="${relRev.id}"
                               onchange="toggleRelatedRevision('${paraId}', '${relRev.id}', this.checked)">
                        Include
                    </label>
                </div>
                <div class="related-revision-rationale">${escapeHtml(relRev.rationale || '')}</div>
                <div class="related-revision-text" contenteditable="true"
                     data-rel-id="${relRev.id}"
                     oninput="updateRelatedRevisionText('${paraId}', '${relRev.id}', this.innerText)">${escapeHtml(relRev.revised_text || '')}</div>
            </div>
        `;
    });

    html += '</div>';

    panel.innerHTML = html;
    panel.style.display = 'block';
}

// Track which related revisions to include
const relatedRevisionsIncluded = new Map();

// Toggle whether to include a related revision
function toggleRelatedRevision(paraId, relId, include) {
    const key = `${paraId}_${relId}`;
    relatedRevisionsIncluded.set(key, include);
}

// Update text of a related revision (user edit)
function updateRelatedRevisionText(paraId, relId, newText) {
    const revision = AppState.revisions[paraId];
    if (!revision || !revision.relatedRevisions) return;

    const relRev = revision.relatedRevisions.find(r => r.id === relId);
    if (relRev) {
        relRev.revised_text = newText;
        relRev.userEdited = true;
    }
}

// Track which related clauses are selected for regeneration
const selectedRelatedForRegen = new Set();

// Toggle a related clause for regeneration
function toggleRelatedForRegen(relId, checked) {
    if (checked) {
        selectedRelatedForRegen.add(relId);
    } else {
        selectedRelatedForRegen.delete(relId);
    }
}

// Regenerate revision with selected/all related clauses
async function regenerateWithRelated(paraId) {
    const revision = AppState.revisions[paraId];
    if (!revision) return;

    // Get all related clauses that weren't included
    const allRelated = revision.allRelatedIds || [];
    const included = revision.includedRelatedIds || [];
    const notIncluded = allRelated.filter(id => !included.includes(id));

    // Use selected ones, or all if none selected
    const toInclude = selectedRelatedForRegen.size > 0
        ? Array.from(selectedRelatedForRegen)
        : notIncluded;

    // Combine with already included
    const allToInclude = [...new Set([...included, ...toInclude])];

    // Clear selection
    selectedRelatedForRegen.clear();

    // Regenerate with the related clauses
    const riskIds = revision.riskIds || getSelectedRiskIds(paraId);
    await generateRevisionForRisks(paraId, riskIds, allToInclude);
}

// Update action buttons
function updateRevisionActions(accepted) {
    const actionsEl = document.getElementById('revision-actions');

    const flagButtons = `
        <div class="revision-flag-buttons">
            <button class="btn btn-warning btn-sm" onclick="flagFromSheet('client')" title="Flag for Client Review">
                &#9873; Client
            </button>
            <button class="btn btn-outline btn-sm" onclick="flagFromSheet('attorney')" title="Flag for Attorney Review">
                &#9998; Attorney
            </button>
        </div>
    `;

    if (accepted) {
        actionsEl.innerHTML = `
            <span style="color: var(--success); font-weight: 500; margin-right: 1rem;">&#10003; Accepted</span>
            <button class="btn btn-secondary" id="btn-reopen-revision">Reopen</button>
            ${flagButtons}
        `;
    } else {
        actionsEl.innerHTML = `
            <button class="btn btn-success" id="btn-accept-revision">Accept</button>
            <button class="btn btn-outline btn-sm" id="btn-reset-revision" style="display:none;">Reset</button>
            <button class="btn btn-danger" id="btn-reject-revision">Reject</button>
            ${flagButtons}
        `;
    }
}

// Setup inline editing for the diff element
function setupInlineEditing(diffEl, clearUndo = true) {
    // Remove existing listeners by cloning
    const newDiffEl = diffEl.cloneNode(true);
    diffEl.parentNode.replaceChild(newDiffEl, diffEl);

    // Clear undo/redo stacks only on fresh setup
    if (clearUndo) {
        undoStack = [];
        redoStack = [];
    }

    // Handle user input with track changes
    newDiffEl.addEventListener('beforeinput', handleBeforeInput);
    newDiffEl.addEventListener('keydown', handleKeydown);
}

// Save state for undo
function saveUndoState() {
    const diffEl = document.getElementById('revision-diff');
    if (!diffEl) return;

    undoStack.push(diffEl.innerHTML);
    // Limit stack size
    if (undoStack.length > 50) undoStack.shift();
    // Clear redo stack on new action
    redoStack = [];
}

// Undo last action
function undo() {
    const diffEl = document.getElementById('revision-diff');
    if (!diffEl || undoStack.length === 0) return;

    // Save current state to redo stack
    redoStack.push(diffEl.innerHTML);

    // Restore previous state
    diffEl.innerHTML = undoStack.pop();

    // Re-setup editing without clearing undo stack
    setupInlineEditing(diffEl, false);

    markAsModified();
}

// Redo last undone action
function redo() {
    const diffEl = document.getElementById('revision-diff');
    if (!diffEl || redoStack.length === 0) return;

    // Save current state to undo stack
    undoStack.push(diffEl.innerHTML);

    // Restore redo state
    diffEl.innerHTML = redoStack.pop();

    // Re-setup editing without clearing stacks
    setupInlineEditing(diffEl, false);

    markAsModified();
}

// Handle keydown for undo/redo and delete keys
function handleKeydown(e) {
    // Handle Ctrl+Z (undo) and Ctrl+Y (redo)
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
            return;
        }
        if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            redo();
            return;
        }
    }

    // Handle backspace and delete - wrap content as deleted instead of removing
    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        saveUndoState();

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (!range.collapsed) {
            // There's a selection - wrap it as deleted
            wrapRangeAsDeleted(range);
        } else {
            // No selection - need to select the character to delete
            if (e.key === 'Backspace') {
                // Select character before cursor
                selectCharacterBefore(range);
            } else {
                // Select character after cursor
                selectCharacterAfter(range);
            }
            // Now wrap the selection
            const newRange = selection.getRangeAt(0);
            if (!newRange.collapsed) {
                wrapRangeAsDeleted(newRange);
            }
        }

        markAsModified();
    }
}

// Select the character before the cursor
function selectCharacterBefore(range) {
    const selection = window.getSelection();

    // Check if we're in a user-deletion span - skip over it
    let node = range.startContainer;
    let offset = range.startOffset;

    // Skip over user-deletion spans (they're already "deleted")
    while (node) {
        const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (parent?.classList?.contains('user-deletion')) {
            // Move before this deletion span
            const delSpan = parent;
            if (delSpan.previousSibling) {
                if (delSpan.previousSibling.nodeType === Node.TEXT_NODE) {
                    node = delSpan.previousSibling;
                    offset = node.length;
                } else {
                    node = delSpan.previousSibling;
                    offset = node.childNodes?.length || 0;
                }
            } else {
                // At start, nothing to delete
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
    } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
        const prevNode = node.childNodes[offset - 1];
        if (prevNode) {
            range.selectNode(prevNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// Select the character after the cursor
function selectCharacterAfter(range) {
    const selection = window.getSelection();
    let node = range.startContainer;
    let offset = range.startOffset;

    // Skip over user-deletion spans
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
    } else if (node.nodeType === Node.ELEMENT_NODE && offset < node.childNodes.length) {
        const nextNode = node.childNodes[offset];
        if (nextNode) {
            range.selectNode(nextNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// Wrap a range as deleted (strikethrough, keeps text visible)
function wrapRangeAsDeleted(range) {
    // Check if selection is entirely within a user-addition span
    const container = range.commonAncestorContainer;
    const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    if (parent?.classList?.contains('user-addition')) {
        // It's user-added text - actually delete it (not track changes)
        range.deleteContents();
        // Clean up empty spans
        if (parent.textContent === '') {
            parent.remove();
        }
        return;
    }

    // Extract and wrap as deleted
    const contents = range.extractContents();

    // Don't wrap if it's already a deletion or empty
    if (!contents.textContent.trim() && contents.childNodes.length === 0) {
        return;
    }

    const span = document.createElement('span');
    span.className = 'user-deletion';
    span.appendChild(contents);

    range.insertNode(span);

    // Move cursor after the deletion span
    const selection = window.getSelection();
    const newRange = document.createRange();
    newRange.setStartAfter(span);
    newRange.setEndAfter(span);
    selection.removeAllRanges();
    selection.addRange(newRange);
}

// Handle beforeinput for text insertion
function handleBeforeInput(e) {
    if (e.inputType === 'insertText' || e.inputType === 'insertParagraph') {
        e.preventDefault();
        saveUndoState();

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // If there's a selection, wrap it as deleted first
        if (!range.collapsed) {
            wrapRangeAsDeleted(range);
        }

        const text = e.inputType === 'insertParagraph' ? '\n' : (e.data || '');
        insertUserText(text);
    }
}

// Insert user-typed text with blue underline + yellow background
function insertUserText(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Check if cursor is inside a user-addition span - append to it
    let targetSpan = null;
    const container = range.startContainer;

    if (container.nodeType === Node.TEXT_NODE &&
        container.parentElement?.classList?.contains('user-addition')) {
        targetSpan = container.parentElement;

        // Insert at cursor position within the span
        const offset = range.startOffset;
        const currentText = container.textContent;
        container.textContent = currentText.slice(0, offset) + text + currentText.slice(offset);

        // Move cursor after inserted text
        const newRange = document.createRange();
        newRange.setStart(container, offset + text.length);
        newRange.setEnd(container, offset + text.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
    } else {
        // Check if previous sibling is a user-addition span
        const prevNode = getPreviousNode(range);
        if (prevNode?.classList?.contains('user-addition')) {
            // Append to it
            prevNode.textContent += text;
            const textNode = prevNode.firstChild;
            const newRange = document.createRange();
            newRange.setStart(textNode, textNode.length);
            newRange.setEnd(textNode, textNode.length);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Create new span
            const span = document.createElement('span');
            span.className = 'user-addition';
            span.textContent = text;

            range.insertNode(span);

            // Move cursor to end of span
            const newRange = document.createRange();
            newRange.setStart(span.firstChild, span.firstChild.length);
            newRange.setEnd(span.firstChild, span.firstChild.length);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    markAsModified();
}

// Get the previous node relative to range position
function getPreviousNode(range) {
    const container = range.startContainer;
    const offset = range.startOffset;

    if (container.nodeType === Node.TEXT_NODE) {
        if (offset === 0 && container.previousSibling) {
            return container.previousSibling;
        }
    } else if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
        return container.childNodes[offset - 1];
    }
    return null;
}

// Mark the revision as modified by user
function markAsModified() {
    const diffEl = document.getElementById('revision-diff');
    if (!diffEl) return;

    if (!isUserEditing) {
        isUserEditing = true;
        diffEl.classList.add('user-modified');

        // Show reset button
        const resetBtn = document.getElementById('btn-reset-revision');
        if (resetBtn) {
            resetBtn.style.display = 'inline-block';
        }
    }

    // Update the revision object with edited content (always update on each change)
    if (bottomSheetParaId) {
        const revision = AppState.revisions[bottomSheetParaId];
        if (revision) {
            // Save the full HTML with track changes formatting
            revision.editedHtml = diffEl.innerHTML;
            // Extract final text (additions kept, deletions removed)
            revision.revised = extractFinalText(diffEl);
            revision.userEdited = true;
        }
    }
}

// Reset to original diff
function resetRevision() {
    if (!bottomSheetParaId) return;

    const diffEl = document.getElementById('revision-diff');
    diffEl.innerHTML = originalDiffHtml;
    diffEl.classList.remove('user-modified');
    isUserEditing = false;

    // Hide reset button
    const resetBtn = document.getElementById('btn-reset-revision');
    if (resetBtn) {
        resetBtn.style.display = 'none';
    }

    // Restore original revision
    const revision = AppState.revisions[bottomSheetParaId];
    if (revision) {
        revision.userEdited = false;
    }

    // Re-setup editing handlers
    setupInlineEditing(diffEl);

    showToast('Revision reset to original', 'info');
}

// Hide bottom sheet
function hideBottomSheet() {
    const sheet = document.getElementById('revision-sheet');
    sheet.classList.remove('show');
    bottomSheetParaId = null;
}

// Setup bottom sheet action button handlers
function setupSheetActionButtons() {
    const acceptBtn = document.getElementById('btn-accept-revision');
    const resetBtn = document.getElementById('btn-reset-revision');
    const rejectBtn = document.getElementById('btn-reject-revision');
    const reopenBtn = document.getElementById('btn-reopen-revision');

    if (acceptBtn) {
        acceptBtn.onclick = () => {
            if (bottomSheetParaId) acceptRevision(bottomSheetParaId);
        };
    }
    if (resetBtn) {
        resetBtn.onclick = () => {
            resetRevision();
        };
    }
    if (rejectBtn) {
        rejectBtn.onclick = () => {
            if (bottomSheetParaId) rejectRevision(bottomSheetParaId);
        };
    }
    if (reopenBtn) {
        reopenBtn.onclick = () => {
            if (bottomSheetParaId) reopenRevision(bottomSheetParaId);
        };
    }
}

// Setup bottom sheet close and drag handlers (call once on load)
function setupBottomSheet() {
    const sheet = document.getElementById('revision-sheet');
    const closeBtn = document.getElementById('sheet-close');
    const handle = document.getElementById('sheet-handle');

    if (closeBtn) {
        closeBtn.onclick = hideBottomSheet;
    }

    // Click on handle area (not buttons) toggles sheet
    if (handle) {
        handle.addEventListener('click', (e) => {
            if (e.target === handle || e.target.classList.contains('handle-bar') || e.target.classList.contains('sheet-title')) {
                if (sheet.classList.contains('show')) {
                    hideBottomSheet();
                }
            }
        });
    }
}

// Reopen accepted revision for editing
function reopenRevision(paraId) {
    const revision = AppState.revisions[paraId];
    if (!revision) return;

    revision.accepted = false;
    // Keep editedHtml so user can continue from where they left off
    renderDocument();
    showBottomSheet(paraId);
    updateStats();
    showToast('Revision reopened for editing', 'info');
}

// Generate revision for a paragraph
async function generateRevision(paraId, riskId = null) {
    showToast('Generating revision...', 'info');

    try {
        const result = await api('/revise', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                para_id: paraId,
                risk_id: riskId
            })
        });

        AppState.revisions[paraId] = {
            original: result.original,
            revised: result.revised,
            rationale: result.rationale,
            thinking: result.thinking,
            diff_html: result.diff_html,
            accepted: false
        };

        renderDocument();
        selectParagraph(paraId);
        updateStats();
        showToast('Revision generated', 'success');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Revise for specific risk
function reviseForRisk(paraId, riskId) {
    generateRevision(paraId, riskId);
}

// Accept revision
async function acceptRevision(paraId) {
    try {
        // Save the current edited content (with track changes HTML) before accepting
        const diffEl = document.getElementById('revision-diff');
        const revision = AppState.revisions[paraId];

        if (diffEl && revision) {
            // Store the edited HTML with track changes formatting
            revision.editedHtml = diffEl.innerHTML;
            // Also extract the "final" text (additions kept, deletions removed)
            revision.revised = extractFinalText(diffEl);
        }

        await api('/accept', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                para_id: paraId
            })
        });

        revision.accepted = true;

        // Also apply related revisions that are included
        const relatedRevisions = revision.relatedRevisions || [];
        let appliedRelated = 0;

        for (const relRev of relatedRevisions) {
            const key = `${paraId}_${relRev.id}`;
            // Check if user unchecked this related revision (default is included)
            if (relatedRevisionsIncluded.has(key) && !relatedRevisionsIncluded.get(key)) {
                continue;
            }

            // Find the original paragraph
            const relPara = AppState.document?.content?.find(p => p.id === relRev.id);
            if (!relPara) continue;

            // Create a revision for this related clause
            AppState.revisions[relRev.id] = {
                original: relPara.text,
                revised: relRev.revised_text,
                rationale: relRev.rationale || `Harmonization with ${paraId}`,
                diff_html: generateSimpleDiffHtml(relPara.text, relRev.revised_text),
                editedHtml: generateSimpleDiffHtml(relPara.text, relRev.revised_text),
                accepted: true,
                fromRelated: paraId
            };

            // Accept on backend
            await api('/accept', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: AppState.sessionId,
                    para_id: relRev.id
                })
            });

            appliedRelated++;
        }

        // Clear related revision selections
        relatedRevisionsIncluded.clear();

        renderDocument();
        selectParagraph(paraId);
        updateStats();
        showBottomSheet(paraId); // Update bottom sheet to show accepted state

        if (appliedRelated > 0) {
            showToast(`Revision accepted with ${appliedRelated} related clause(s)`, 'success');
        } else {
            showToast('Revision accepted', 'success');
        }

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Generate simple diff HTML for related revisions
function generateSimpleDiffHtml(original, revised) {
    // Simple word-based diff for now
    // Could use diff-match-patch for better results
    if (!original || !revised) return escapeHtml(revised || '');

    // Just show the revised text with underline for now
    // A proper implementation would use diff-match-patch
    return `<span class="diff-ins">${escapeHtml(revised)}</span>`;
}

// Extract final text from edited content (keep additions, remove deletions)
function extractFinalText(element) {
    let text = '';
    element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip user-deletion spans (they're struck through)
            if (node.classList?.contains('user-deletion')) {
                return;
            }
            // Skip original deletions (diff-del)
            if (node.classList?.contains('diff-del')) {
                return;
            }
            // Include everything else (including user-addition spans)
            text += node.textContent;
        }
    });
    return text;
}

// Reject revision
async function rejectRevision(paraId) {
    try {
        await api('/reject', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                para_id: paraId
            })
        });

        delete AppState.revisions[paraId];
        hideBottomSheet(); // Hide the bottom sheet
        renderDocument();
        selectParagraph(paraId);
        updateStats();
        showToast('Revision rejected', 'info');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Finalize document
async function finalize() {
    const acceptedCount = Object.values(AppState.revisions).filter(r => r.accepted).length;
    if (acceptedCount === 0) {
        showToast('No accepted revisions to finalize', 'warning');
        return;
    }

    if (!confirm(`Finalize document with ${acceptedCount} accepted revisions and ${AppState.flags.length} flags?`)) {
        return;
    }

    showToast('Generating final documents...', 'info');

    try {
        const result = await api('/finalize', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId
            })
        });

        showToast(`Done! ${result.changes_made} changes applied.`, 'success');

        // Offer downloads
        if (confirm('Documents generated. Download now?')) {
            window.open(`/api/download/${AppState.sessionId}/docx`, '_blank');
        }

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============ Revision Sheet Tab Functions ============

// Switch between revision sheet tabs
function switchRevisionTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.revision-sheet-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.revision-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `revision-tab-${tabName}`);
    });

    // If switching to details tab, populate the content
    if (tabName === 'details' && bottomSheetParaId) {
        populateDetailsTab(bottomSheetParaId);
    }
}

// Populate the details tab with prompt/response info
function populateDetailsTab(paraId) {
    const revision = AppState.revisions[paraId];
    if (!revision) return;

    const promptEl = document.getElementById('details-prompt');
    const responseEl = document.getElementById('details-response');
    const thinkingEl = document.getElementById('details-thinking');

    // Populate prompt (if available)
    if (promptEl) {
        if (revision.promptSent) {
            promptEl.textContent = revision.promptSent;
        } else {
            promptEl.textContent = '(Prompt data not available. This may be from an earlier revision.)';
        }
    }

    // Populate raw response
    if (responseEl) {
        if (revision.rawResponse) {
            responseEl.textContent = revision.rawResponse;
        } else if (revision.revised) {
            responseEl.textContent = `Revised text:\n\n${revision.revised}`;
        } else {
            responseEl.textContent = '(Response data not available.)';
        }
    }

    // Populate thinking/reasoning
    if (thinkingEl) {
        if (revision.thinking) {
            thinkingEl.textContent = revision.thinking;
        } else {
            thinkingEl.textContent = '(Model thinking not available for this revision.)';
        }
    }
}

// Toggle details section expansion
function toggleDetailsSection(section) {
    const contentEl = document.getElementById(`details-${section}`);
    const toggleEl = document.getElementById(`toggle-${section}`);

    if (contentEl) {
        contentEl.classList.toggle('collapsed');
    }

    if (toggleEl) {
        toggleEl.textContent = contentEl.classList.contains('collapsed') ? '▼' : '▲';
    }
}

// Flag current paragraph from revision sheet
function flagFromSheet(type) {
    if (!bottomSheetParaId) {
        showToast('No paragraph selected', 'error');
        return;
    }
    // Open the flag modal with the current paragraph ID
    showFlagModal(bottomSheetParaId, type);
}

// Export for use in other modules
window.generateRevision = generateRevision;
window.reviseForRisk = reviseForRisk;
window.acceptRevision = acceptRevision;
window.rejectRevision = rejectRevision;
window.finalize = finalize;
window.showBottomSheet = showBottomSheet;
window.hideBottomSheet = hideBottomSheet;
window.setupBottomSheet = setupBottomSheet;
window.resetRevision = resetRevision;
window.reopenRevision = reopenRevision;
window.extractFinalText = extractFinalText;
window.toggleRelatedForRegen = toggleRelatedForRegen;
window.regenerateWithRelated = regenerateWithRelated;
window.switchRevisionTab = switchRevisionTab;
window.populateDetailsTab = populateDetailsTab;
window.toggleDetailsSection = toggleDetailsSection;
window.flagFromSheet = flagFromSheet;
