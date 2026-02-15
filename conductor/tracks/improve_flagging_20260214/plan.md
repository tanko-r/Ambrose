# Implementation Plan - Improve Flagging System

## Phase 1: Core Logic - Multi-Flag Support & Auto-Save
Focus on updating the data model and backend/store logic to handle multiple flags per paragraph and implement the auto-save mechanism.

- [ ] Task: Update Frontend Store and Types for Multi-Flag Support
    - [ ] Write Tests: Define tests for multiple flags in Zustand store
    - [ ] Implement: Update `ReviewState` and `Flag` interface to support multiple flags per `para_id`
- [ ] Task: Implement Auto-Save Logic in FlagBubble
    - [ ] Write Tests: Define unit tests for debounced save calls
    - [ ] Implement: Add debounced `create/update` calls to `FlagBubble.tsx`
- [ ] Task: Add Delete Functionality
    - [ ] Write Tests: Define tests for flag deletion via `trash` icon
    - [ ] Implement: Add trash icon to `FlagBubble` and connect to `remove` action
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Core Logic' (Protocol in workflow.md)

## Phase 2: Visual UX - Refined Connectors & Clean UI
Focus on the SVG connector line curvature and cleaning up the Bubble UI.

- [ ] Task: Implement Curved SVG Connectors
    - [ ] Write Tests: Define coordinate calculation tests
    - [ ] Implement: Update `updateConnector` logic in `document-viewer.tsx` to use cubic bezier curves or "elbow" paths
- [ ] Task: UI Cleanup - Remove Diamond & Decorative Elements
    - [ ] Implement: Delete the diamond shape and refine `FlagBubble` header/spacing
- [ ] Task: Implement Context-Aware Risk Highlighting
    - [ ] Write Tests: Define tests for conditional class application based on focus
    - [ ] Implement: Update `updateParagraphStates` to only show risk categories when `isSelected` is true
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Visual UX' (Protocol in workflow.md)

## Phase 3: Polish & Conflict Management
Ensure multiple flagging experiences don't conflict.

- [ ] Task: Refine Flag Selection Interaction
    - [ ] Implement: Ensure clicking a specific flag icon or highlight focuses *that* specific flag in the bubble
- [ ] Task: Final Polish & Style Reconciliation
    - [ ] Implement: Ensure all highlights and underlines match the revised design principles
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Polish' (Protocol in workflow.md)
