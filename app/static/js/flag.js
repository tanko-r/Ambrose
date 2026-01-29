/**
 * Flag management for attorney and client review
 */

let flagParaId = null;
let flagType = 'client'; // 'client' or 'attorney'

// Show flag modal with type selection
function showFlagModal(paraId, type = 'client') {
    flagParaId = paraId;
    flagType = type;

    // Update modal title based on type
    const titleEl = document.querySelector('#flag-modal .modal-header h2');
    const labelEl = document.querySelector('#flag-modal .form-label');
    const submitBtn = document.querySelector('#flag-modal .modal-footer .btn-warning, #flag-modal .modal-footer .btn-primary');

    if (type === 'attorney') {
        titleEl.textContent = 'Flag for Attorney Review';
        labelEl.textContent = 'Note for Internal Review:';
        submitBtn.textContent = 'Flag for Attorney';
        submitBtn.className = 'btn btn-primary';
    } else {
        titleEl.textContent = 'Flag for Client Review';
        labelEl.textContent = 'Note for Client (included in transmittal):';
        submitBtn.textContent = 'Flag for Client';
        submitBtn.className = 'btn btn-warning';
    }

    // Update active tab
    document.querySelectorAll('.flag-type-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === type);
    });

    document.getElementById('flag-modal').classList.add('show');
    document.getElementById('flag-note').focus();
}

// Switch flag type via tab
function switchFlagType(type) {
    flagType = type;

    const titleEl = document.querySelector('#flag-modal .modal-header h2');
    const labelEl = document.querySelector('#flag-modal .form-label');
    const submitBtn = document.querySelector('#flag-modal .modal-footer .btn-warning, #flag-modal .modal-footer .btn-primary');

    if (type === 'attorney') {
        titleEl.textContent = 'Flag for Attorney Review';
        labelEl.textContent = 'Note for Internal Review:';
        submitBtn.textContent = 'Flag for Attorney';
        submitBtn.className = 'btn btn-primary';
    } else {
        titleEl.textContent = 'Flag for Client Review';
        labelEl.textContent = 'Note for Client (included in transmittal):';
        submitBtn.textContent = 'Flag for Client';
        submitBtn.className = 'btn btn-warning';
    }

    document.querySelectorAll('.flag-type-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === type);
    });
}

function closeFlagModal() {
    document.getElementById('flag-modal').classList.remove('show');
    document.getElementById('flag-note').value = '';
    flagParaId = null;
    flagType = 'client';
}

async function submitFlag() {
    const note = document.getElementById('flag-note').value;

    try {
        const result = await api('/flag', {
            method: 'POST',
            body: JSON.stringify({
                session_id: AppState.sessionId,
                para_id: flagParaId,
                note: note,
                flag_type: flagType
            })
        });

        AppState.flags.push(result.flag);
        closeFlagModal();
        renderDocument();
        if (flagParaId) selectParagraph(flagParaId);
        updateStats();

        const typeLabel = flagType === 'attorney' ? 'attorney' : 'client';
        showToast(`Item flagged for ${typeLabel} review`, 'success');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Export for use in other modules
window.showFlagModal = showFlagModal;
window.closeFlagModal = closeFlagModal;
window.submitFlag = submitFlag;
window.switchFlagType = switchFlagType;
