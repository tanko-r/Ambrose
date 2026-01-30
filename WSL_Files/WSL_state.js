/**
 * Global application state
 */

const state = {
    sessionId: null,
    document: null,
    analysis: null,
    selectedParaId: null,
    revisions: {},
    flags: [],
    // Concept map: hierarchical document structure with relationships
    conceptMap: null,
    // Risk map: keyed by paragraph ID, contains risks/opportunities for each clause
    riskMap: null,
    // Change history: tracks all revisions made during the session
    changeHistory: []
};

// Export for use in other modules
window.AppState = state;
