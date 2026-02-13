/**
 * Analysis overlay and progress tracking
 * Plan 06-04: Enhanced with incremental results display
 */

// Track which risks have already been displayed to avoid duplicates
let displayedRiskIds = new Set();

// Track last API call ID to only log new calls
let lastApiCallId = 0;

// Legal-themed analysis verbs (cheeky, Anthropic-style)
const analysisVerbs = [
    "Reading the fine print...",
    "Briefing...",
    "Arguing both sides...",
    "Thinking aggressively...",
    "Thinking like opposing counsel...",
    "Finding the loopholes...",
    "Protecting your interests...",
    "Channeling senior partner energy...",
    "Billable hours accumulating...",
    "Citing precedent...",
    "Drafting counterarguments...",
    "Negotiating internally...",
    "Playing devil's advocate...",
    "Reviewing for gotchas...",
    "Checking the defined terms...",
    "Lawyering...",
    "Gut-checking with a colleague...",
    "Getting right on that...",
    "Asking local counsel...",
    "Fixing italicized commas...",
    "Bluebooking...",
    "Praying for relief...",
    "Surreplying...",
    "Cross-referencing...",
    "(Counter)partying...",
    "Pls fixing...",
    "Spacing out...",
    "Considering alternative careers...",
    "Looking for in-house jobs...",
    "Due diligence-ing...",
    "Hypothetical-ing...",
    "Risk-assessing...",
    "Zealously advocating...",
    "Considering the alternatives...",
    "Building your case...",
    "Preparing the markup..."
];

let verbInterval = null;
let currentVerbIndex = 0;

function showAnalysisOverlay() {
    document.getElementById('analysis-overlay').classList.add('show');
    currentVerbIndex = 0;
    updateAnalysisVerb();
    verbInterval = setInterval(updateAnalysisVerb, 2500);
}

function hideAnalysisOverlay() {
    document.getElementById('analysis-overlay').classList.remove('show');
    if (verbInterval) {
        clearInterval(verbInterval);
        verbInterval = null;
    }
}

function updateAnalysisVerb() {
    const verbEl = document.getElementById('analysis-verb');
    verbEl.style.opacity = 0;
    setTimeout(() => {
        verbEl.textContent = analysisVerbs[currentVerbIndex % analysisVerbs.length];
        verbEl.style.opacity = 1;
        currentVerbIndex++;
    }, 200);
}

function updateAnalysisProgress(percent, status, detail, batchInfo) {
    document.getElementById('analysis-progress').style.width = percent + '%';
    if (status) document.getElementById('analysis-status').textContent = status;
    if (detail) document.getElementById('analysis-detail').textContent = detail;
    if (batchInfo) document.getElementById('analysis-batch-info').textContent = batchInfo;
}

/**
 * Update the two-stage progress indicator
 * @param {string} stage - 'initial_analysis', 'parallel_batches', or 'complete'
 */
function updateStageIndicator(stage) {
    const initialStage = document.getElementById('stage-initial');
    const parallelStage = document.getElementById('stage-parallel');

    if (!initialStage || !parallelStage) return;

    // Reset all stages
    initialStage.classList.remove('active', 'complete');
    parallelStage.classList.remove('active', 'complete');

    if (stage === 'initial_analysis') {
        initialStage.classList.add('active');
    } else if (stage === 'parallel_batches') {
        initialStage.classList.add('complete');
        parallelStage.classList.add('active');
    } else if (stage === 'complete') {
        initialStage.classList.add('complete');
        parallelStage.classList.add('complete');
    }
}

/**
 * Update the stage display text from progress data
 * @param {Object} progress - Progress data from API
 */
function updateProgressDisplay(progress) {
    // Update stage display
    const stageDisplay = document.getElementById('analysis-stage-display');
    if (stageDisplay && progress.stage_display) {
        stageDisplay.textContent = progress.stage_display;
    }

    // Update stage indicator
    if (progress.stage) {
        updateStageIndicator(progress.stage);
    }

    // Build detail text
    let details = [];

    // Stage-specific info
    if (progress.stage === 'initial_analysis') {
        if (progress.defined_terms_count) {
            details.push(`${progress.defined_terms_count} defined terms found`);
        }
    } else if (progress.stage === 'parallel_batches') {
        if (progress.current_batch && progress.total_batches) {
            details.push(`Batch ${progress.current_batch}/${progress.total_batches}`);
        }
        if (progress.risks_found) {
            details.push(`${progress.risks_found} risks found`);
        }
    }

    // Elapsed time
    if (progress.elapsed_display) {
        details.push(`Elapsed: ${progress.elapsed_display}`);
    }

    // Skip stats
    if (progress.skip_stats) {
        const skipped = Object.values(progress.skip_stats).reduce((a, b) => a + b, 0);
        if (skipped > 0) {
            details.push(`${skipped} paragraphs filtered`);
        }
    }

    const detailEl = document.getElementById('analysis-detail');
    if (detailEl) {
        detailEl.textContent = details.join(' | ');
    }
}

/**
 * Display incremental risks in the sidebar as they arrive
 * @param {Array} risks - Array of risk objects from incremental results
 */
function displayIncrementalRisks(risks) {
    if (!risks || risks.length === 0) return;

    // Find or create risk container in sidebar
    const sidebar = document.getElementById('sidebar-content');
    if (!sidebar) return;

    risks.forEach(risk => {
        const riskId = risk.risk_id || risk.id || `${risk.para_id}_${risk.type}`;
        if (displayedRiskIds.has(riskId)) return;
        displayedRiskIds.add(riskId);

        // Create risk card element
        const riskElement = createIncrementalRiskCard(risk);
        if (riskElement) {
            sidebar.appendChild(riskElement);
        }
    });
}

/**
 * Create a risk card element for incremental display
 * @param {Object} risk - Risk object
 * @returns {HTMLElement|null}
 */
function createIncrementalRiskCard(risk) {
    const card = document.createElement('div');
    card.className = 'risk-card risk-item-new';
    card.setAttribute('data-risk-id', risk.risk_id || '');
    card.setAttribute('data-para-id', risk.para_id || '');

    const severityClass = `severity-${risk.severity || 'medium'}`;

    card.innerHTML = `
        <div class="risk-header ${severityClass}">
            <span class="risk-severity">${(risk.severity || 'medium').toUpperCase()}</span>
            <span class="risk-title">${escapeHtml(risk.title || 'Risk Identified')}</span>
        </div>
        <div class="risk-body">
            <p class="risk-description">${escapeHtml((risk.description || '').substring(0, 150))}${(risk.description || '').length > 150 ? '...' : ''}</p>
            <div class="risk-para-ref">Para: ${risk.para_id || 'Unknown'}</div>
        </div>
    `;

    // Remove animation class after animation completes
    setTimeout(() => card.classList.remove('risk-item-new'), 500);

    return card;
}

// Poll for real analysis progress with incremental results
async function pollProgress() {
    try {
        // Request incremental risks along with progress, include last API call ID
        const response = await fetch(`/api/analysis/${AppState.sessionId}/progress?include_risks=true&last_api_call_id=${lastApiCallId}`);
        const progress = await response.json();

        // Log any new API calls to browser console
        if (progress.api_calls && progress.api_calls.length > 0) {
            progress.api_calls.forEach(call => {
                // Update last seen ID
                if (call.id >= lastApiCallId) {
                    lastApiCallId = call.id + 1;
                }
                // Log to browser console with nice formatting
                const apiLabel = call.api === 'anthropic' ? '🟣 ANTHROPIC' : '🔵 GEMINI';
                console.log(`${apiLabel} API Call:`, {
                    timestamp: call.timestamp,
                    model: call.model,
                    stage: call.stage,
                    ...(call.batch && { batch: call.batch }),
                    ...(call.paragraphs && { paragraphs: Array.isArray(call.paragraphs) ? call.paragraphs.join(', ') : call.paragraphs }),
                    ...(call.content && { content: call.content }),
                    ...(call.success !== undefined && { success: call.success }),
                    ...(call.risks_found !== undefined && { risks_found: call.risks_found }),
                    ...(call.error && { error: call.error })
                });
            });
        }

        if (progress.status === 'complete') {
            // Clear displayed risks tracker for next analysis
            displayedRiskIds.clear();
            lastApiCallId = 0;
            return true; // Signal completion
        }

        const percent = progress.percent || 0;

        // Update progress bar
        document.getElementById('analysis-progress').style.width = percent + '%';

        // Update stage display and indicator
        updateProgressDisplay(progress);

        // Update current action/status
        const statusEl = document.getElementById('analysis-status');
        if (statusEl) {
            statusEl.textContent = progress.current_action || 'Analyzing...';
        }

        // Display incremental risks as they arrive
        if (progress.incremental_risks && progress.incremental_risks.length > 0) {
            displayIncrementalRisks(progress.incremental_risks);
        }

        return false; // Not complete yet
    } catch (e) {
        console.error('Progress poll error:', e);
        return false;
    }
}

// Load analysis with real progress tracking
async function loadAnalysis() {
    showAnalysisOverlay();
    // Reset API call tracking for new analysis
    lastApiCallId = 0;
    console.log('%c=== Starting Contract Analysis ===', 'color: #4CAF50; font-weight: bold; font-size: 14px');
    console.log('Session:', AppState.sessionId);
    updateAnalysisProgress(2, 'Starting analysis...', 'Connecting to Claude Opus 4.5', '');

    // Start polling for real progress
    const progressInterval = setInterval(async () => {
        const complete = await pollProgress();
        if (complete) {
            clearInterval(progressInterval);
        }
    }, 1000);

    try {
        const result = await api(`/analysis/${AppState.sessionId}`);
        clearInterval(progressInterval);

        const elapsed = result.summary?.elapsed_seconds || 0;
        updateAnalysisProgress(
            100,
            'Analysis complete!',
            `Found ${result.summary.total_risks} risks across ${result.summary.paragraphs_analyzed} clauses`,
            `Total time: ${formatTime(elapsed)}`
        );

        AppState.analysis = result;
        updateStats();
        highlightRisks();

        // Brief pause to show completion
        setTimeout(() => {
            hideAnalysisOverlay();
            showToast(`Analysis complete: ${result.summary.total_risks} risks identified`, 'success');
        }, 1500);

    } catch (error) {
        clearInterval(progressInterval);
        hideAnalysisOverlay();
        showToast(`Analysis failed: ${error.message}`, 'error');
    }
}

// Export for use in other modules
window.showAnalysisOverlay = showAnalysisOverlay;
window.hideAnalysisOverlay = hideAnalysisOverlay;
window.updateAnalysisProgress = updateAnalysisProgress;
window.pollProgress = pollProgress;
window.loadAnalysis = loadAnalysis;
