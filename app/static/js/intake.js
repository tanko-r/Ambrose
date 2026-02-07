/**
 * Intake form handling and file uploads
 */

// File handling
function handleFileSelect(input, type) {
    const file = input.files[0];
    if (file) {
        const filenameEl = document.getElementById(`${type}-filename`);
        const uploadEl = document.getElementById(`${type}-upload`);
        // Truncate filename if too long
        const displayName = file.name.length > 28 ? file.name.substring(0, 25) + '...' : file.name;
        filenameEl.textContent = displayName;
        filenameEl.title = file.name;
        uploadEl.style.borderColor = 'var(--success)';
        uploadEl.classList.add('has-file');
    }
}

// Setup drag and drop for upload areas
function setupDragAndDrop() {
    document.querySelectorAll('.upload-area').forEach(area => {
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });
        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            const type = area.id.replace('-upload', '');
            const input = document.getElementById(`${type}-file`);
            input.files = e.dataTransfer.files;
            handleFileSelect(input, type);
        });
    });
}

// Intake submission
async function submitIntake(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const targetFile = document.getElementById('target-file').files[0];
    if (!targetFile) {
        showToast('Please upload a target contract', 'error');
        return;
    }
    formData.append('target_file', targetFile);

    const precedentFile = document.getElementById('precedent-file').files[0];
    if (precedentFile) {
        formData.append('precedent_file', precedentFile);
    }

    try {
        showToast('Uploading and parsing document...', 'info');

        const response = await fetch('/api/intake', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        AppState.sessionId = result.session_id;

        showToast(`Document parsed: ${result.paragraph_count} paragraphs`, 'success');

        // Load document and analysis
        await loadDocument();
        await loadAnalysis();

        // Switch to review view
        showReviewView();

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Load a saved test session (skips expensive LLM analysis)
async function loadTestSession() {
    try {
        showToast('Loading saved test session...', 'info');

        const response = await fetch('/api/load-test-session', {
            method: 'POST'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        AppState.sessionId = result.session_id;

        showToast(`Test session loaded: ${result.risks_count} risks`, 'success');

        // Load document from state (already in session)
        await loadDocument();

        // Analysis is already loaded, just update UI
        const analysis = await api(`/analysis/${AppState.sessionId}`);
        AppState.analysis = analysis;
        updateStats();
        highlightRisks();

        // Switch to review view
        showReviewView();

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Export for use in other modules
window.handleFileSelect = handleFileSelect;
window.setupDragAndDrop = setupDragAndDrop;
window.submitIntake = submitIntake;
window.loadTestSession = loadTestSession;
