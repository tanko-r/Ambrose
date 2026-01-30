/**
 * Reanalysis UI - Affected Clauses Notification and Panel
 *
 * When a user accepts a revision that changes a concept (like adding a basket or cap),
 * the backend returns affected_para_ids - paragraphs with risks that reference that concept.
 * This module provides UI to notify the user and let them navigate to those affected clauses.
 */

// ============ Affected Clauses Banner ============

/**
 * Shows a notification banner when clauses are affected by a revision
 * @param {string[]} affectedParaIds - Array of affected paragraph IDs
 * @param {string} changeSection - Section reference of the changed clause
 */
function showAffectedClausesNotification(affectedParaIds, changeSection) {
    if (!affectedParaIds || affectedParaIds.length === 0) return;

    const banner = document.getElementById('affected-clauses-banner');
    if (!banner) return;

    // Count how many risks might be affected
    let totalAffectedRisks = 0;
    affectedParaIds.forEach(paraId => {
        const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];
        totalAffectedRisks += risks.length;
    });

    const clauseWord = affectedParaIds.length === 1 ? 'clause' : 'clauses';
    const riskWord = totalAffectedRisks === 1 ? 'risk' : 'risks';

    // Store affected IDs as data attribute for the panel
    banner.dataset.affectedIds = JSON.stringify(affectedParaIds);
    banner.dataset.changeSection = changeSection || '';

    banner.innerHTML = `
        <div class="affected-banner-content">
            <div class="affected-banner-icon">&#9888;</div>
            <div class="affected-banner-message">
                <strong>${affectedParaIds.length} ${clauseWord}</strong> may be affected by your revision to ${changeSection ? escapeHtml(changeSection) : 'this clause'}.
                <span class="affected-banner-detail">${totalAffectedRisks} ${riskWord} may have changed severity.</span>
            </div>
            <div class="affected-banner-actions">
                <button class="btn btn-sm btn-warning" onclick="showAffectedClausesPanel()">View Affected</button>
                <button class="btn btn-sm btn-secondary" onclick="dismissAffectedBanner()">Dismiss</button>
            </div>
        </div>
    `;

    // Show with animation
    banner.classList.add('show');
}

/**
 * Dismisses the affected clauses notification banner
 */
function dismissAffectedBanner() {
    const banner = document.getElementById('affected-clauses-banner');
    if (banner) {
        banner.classList.remove('show');
        // Clear data after animation
        setTimeout(() => {
            banner.innerHTML = '';
            delete banner.dataset.affectedIds;
            delete banner.dataset.changeSection;
        }, 300);
    }
}

// ============ Affected Clauses Panel ============

/**
 * Shows a slide-out panel listing affected clauses
 * @param {string} [affectedParaIdsJson] - Optional JSON string of affected para IDs (defaults to banner data)
 */
function showAffectedClausesPanel(affectedParaIdsJson) {
    const panel = document.getElementById('affected-clauses-panel');
    const banner = document.getElementById('affected-clauses-banner');

    if (!panel) return;

    // Get affected IDs from parameter or banner
    let affectedParaIds;
    try {
        if (affectedParaIdsJson) {
            affectedParaIds = JSON.parse(affectedParaIdsJson);
        } else if (banner?.dataset?.affectedIds) {
            affectedParaIds = JSON.parse(banner.dataset.affectedIds);
        }
    } catch (e) {
        console.error('Failed to parse affected para IDs:', e);
        return;
    }

    if (!affectedParaIds || affectedParaIds.length === 0) {
        showToast('No affected clauses to show', 'info');
        return;
    }

    const changeSection = banner?.dataset?.changeSection || '';

    // Build panel content
    let html = `
        <div class="affected-panel-header">
            <div class="affected-panel-title-row">
                <h3 class="affected-panel-title">Affected Clauses</h3>
                <button class="affected-panel-close" onclick="closeAffectedPanel()">&times;</button>
            </div>
            <p class="affected-panel-subtitle">
                These clauses have risks that may be affected by changes to ${changeSection ? escapeHtml(changeSection) : 'the revised clause'}.
                Consider re-analyzing them to see updated risk assessments.
            </p>
        </div>
        <div class="affected-panel-body">
    `;

    affectedParaIds.forEach(paraId => {
        const info = getParaInfo(paraId);
        if (!info) return;

        const risks = AppState.analysis?.risk_by_paragraph?.[paraId] || [];
        const riskCount = risks.length;
        const riskWord = riskCount === 1 ? 'risk' : 'risks';

        // Get the types of risks for this clause
        const riskTypes = [...new Set(risks.map(r => r.type))].slice(0, 3);
        const riskTypesText = riskTypes.map(t => formatRiskType(t)).join(', ');

        html += `
            <div class="affected-clause-item" data-para-id="${paraId}">
                <div class="affected-clause-item-header">
                    <span class="affected-clause-ref">${escapeHtml(info.sectionRef)}</span>
                    ${info.isAccepted ? '<span class="affected-clause-revised">Already Revised</span>' : ''}
                </div>
                ${info.caption ? `<div class="affected-clause-caption">${escapeHtml(info.caption)}</div>` : ''}
                <div class="affected-clause-reason">
                    ${riskCount} ${riskWord}${riskTypesText ? ': ' + escapeHtml(riskTypesText) : ''}
                </div>
                <div class="affected-clause-actions">
                    <button class="btn btn-xs btn-outline" onclick="navigateToClause('${paraId}')">
                        Go to Clause
                    </button>
                    <button class="btn btn-xs btn-primary" onclick="reanalyzeClause('${paraId}'); closeAffectedPanel();">
                        Re-analyze
                    </button>
                </div>
            </div>
        `;
    });

    html += `
        </div>
        <div class="affected-panel-footer">
            <button class="btn btn-secondary" onclick="closeAffectedPanel()">Close</button>
            <button class="btn btn-primary" onclick="reanalyzeAllAffected()">Re-analyze All (${affectedParaIds.length})</button>
        </div>
    `;

    panel.innerHTML = html;
    panel.dataset.affectedIds = JSON.stringify(affectedParaIds);
    panel.classList.add('show');
}

/**
 * Closes the affected clauses panel
 */
function closeAffectedPanel() {
    const panel = document.getElementById('affected-clauses-panel');
    if (panel) {
        panel.classList.remove('show');
        // Clear after animation
        setTimeout(() => {
            panel.innerHTML = '';
            delete panel.dataset.affectedIds;
        }, 300);
    }
}

/**
 * Navigate to a specific clause in the document
 * @param {string} paraId - Paragraph ID to navigate to
 */
function navigateToClause(paraId) {
    // Close the panel
    closeAffectedPanel();
    dismissAffectedBanner();

    // Select the paragraph
    selectParagraph(paraId);

    // Scroll to the paragraph in the document
    const paraEl = document.querySelector(`[data-para-id="${paraId}"]`);
    if (paraEl) {
        paraEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Re-analyze all affected clauses
 */
async function reanalyzeAllAffected() {
    const panel = document.getElementById('affected-clauses-panel');
    if (!panel?.dataset?.affectedIds) return;

    let affectedParaIds;
    try {
        affectedParaIds = JSON.parse(panel.dataset.affectedIds);
    } catch (e) {
        console.error('Failed to parse affected para IDs:', e);
        return;
    }

    if (!affectedParaIds || affectedParaIds.length === 0) return;

    closeAffectedPanel();
    dismissAffectedBanner();

    showToast(`Re-analyzing ${affectedParaIds.length} clause(s)...`, 'info');

    // Re-analyze each clause sequentially
    let successCount = 0;
    for (const paraId of affectedParaIds) {
        try {
            const result = await api('/reanalyze', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: AppState.sessionId,
                    para_id: paraId
                })
            });

            if (result.risks) {
                AppState.analysis.risk_by_paragraph[paraId] = result.risks;
                successCount++;
            }
        } catch (error) {
            console.error(`Failed to re-analyze clause ${paraId}:`, error);
        }
    }

    // Refresh the document and sidebar
    renderDocument();
    if (AppState.selectedParaId) {
        const para = AppState.document?.content?.find(p => p.id === AppState.selectedParaId);
        if (para) {
            renderSidebarContent(AppState.selectedParaId, para);
        }
    }
    updateStats();

    showToast(`Re-analyzed ${successCount} of ${affectedParaIds.length} clause(s)`, 'success');
}

// ============ Full Document Re-Analysis ============

/**
 * Shows full re-analysis confirmation dialog
 * Fetches estimates from server before prompting user
 */
async function showFullReanalysisDialog() {
    try {
        const result = await api('/reanalyze-full', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                confirmed: false
            })
        });

        if (result.requires_confirmation) {
            const confirmed = confirm(
                `Full Document Re-Analysis\n\n` +
                `This will re-analyze all ${result.paragraph_count} paragraphs.\n` +
                `Estimated time: ${result.estimated_minutes} minutes\n` +
                `Estimated cost: ${result.estimated_cost}\n\n` +
                `Proceed?`
            );

            if (confirmed) {
                await triggerFullReanalysis();
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Triggers full document re-analysis after user confirmation
 * Clears existing analysis and initiates new analysis
 */
async function triggerFullReanalysis() {
    showToast('Starting full document re-analysis...', 'info');

    try {
        const result = await api('/reanalyze-full', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                confirmed: true
            })
        });

        showToast(result.message, 'success');

        // Clear local analysis state
        AppState.analysis = null;

        // Trigger new analysis fetch (this will show the analysis overlay)
        await loadAnalysis();

    } catch (error) {
        showToast(`Re-analysis failed: ${error.message}`, 'error');
    }
}

// ============ Export to window ============

window.showAffectedClausesNotification = showAffectedClausesNotification;
window.dismissAffectedBanner = dismissAffectedBanner;
window.showAffectedClausesPanel = showAffectedClausesPanel;
window.closeAffectedPanel = closeAffectedPanel;
window.navigateToClause = navigateToClause;
window.reanalyzeAllAffected = reanalyzeAllAffected;
window.showFullReanalysisDialog = showFullReanalysisDialog;
window.triggerFullReanalysis = triggerFullReanalysis;
