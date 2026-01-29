/**
 * Main application initialization
 */

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Setup drag and drop for file uploads
    setupDragAndDrop();

    // Setup event delegation for risk cards
    setupRiskCardEvents();

    // Setup bottom sheet for revisions
    setupBottomSheet();

    // Setup related clauses selection panel
    setupRelatedSelectionPanel();

    // Show intake screen
    showIntake();

    console.log('Contract Review App initialized');
});
