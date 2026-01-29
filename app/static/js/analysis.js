/**
 * Analysis overlay and progress tracking
 */

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

// Poll for real analysis progress
async function pollProgress() {
    try {
        const response = await fetch(`/api/analysis/${AppState.sessionId}/progress`);
        const progress = await response.json();

        if (progress.status === 'complete') {
            return true; // Signal completion
        }

        const percent = progress.percent || 0;
        const elapsed = progress.elapsed_seconds || 0;
        const remaining = progress.estimated_remaining_seconds;

        let timeInfo = `Elapsed: ${formatTime(elapsed)}`;
        if (remaining) {
            timeInfo += ` | Est. remaining: ${formatTime(remaining)}`;
        }

        const batchInfo = progress.total_batches
            ? `Batch ${progress.current_batch || 0} of ${progress.total_batches} | ${progress.risks_found || 0} risks found`
            : '';

        updateAnalysisProgress(
            percent,
            progress.current_action || 'Analyzing...',
            progress.current_clause_preview || 'Processing clauses with Claude Opus 4.5',
            `${batchInfo}${batchInfo ? ' | ' : ''}${timeInfo}`
        );

        return false; // Not complete yet
    } catch (e) {
        console.error('Progress poll error:', e);
        return false;
    }
}

// Load analysis with real progress tracking
async function loadAnalysis() {
    showAnalysisOverlay();
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
