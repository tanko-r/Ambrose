/**
 * Global application state
 */

const state = {
    sessionId: null,
    document: null,
    analysis: null,
    selectedParaId: null,
    revisions: {},
    flags: []
};

// Export for use in other modules
window.AppState = state;
