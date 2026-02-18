# Implementation Plan - Improve Flagging System

## Phase 1: Core Logic - Multi-Flag Support & Auto-Save
Focus on updating the data model and backend/store logic to handle multiple flags per paragraph and implement the auto-save mechanism.

- [x] Task: Update Frontend Store and Types for Multi-Flag Support [0ee02cf]
    - [x] Write Tests: Define tests for multiple flags in Zustand store [0ee02cf]
    - [x] Implement: Update `ReviewState` and `Flag` interface to support multiple flags per `para_id` [0ee02cf]
- [x] Task: Implement Auto-Save Logic in FlagBubble [0ee02cf]
    - [x] Write Tests: Define unit tests for debounced save calls [0ee02cf]
    - [x] Implement: Add debounced `create/update` calls to `FlagBubble.tsx` [0ee02cf]
- [x] Task: Add Delete Functionality [0ee02cf]
    - [x] Write Tests: Define tests for flag deletion via `trash` icon [0ee02cf]
    - [x] Implement: Add trash icon to `FlagBubble` and connect to `remove` action [0ee02cf]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Core Logic' (Protocol in workflow.md)

## Phase 2: Visual UX - Refined Connectors & Clean UI
Focus on the SVG connector line curvature and cleaning up the Bubble UI.

- [x] Task: Implement Curved SVG Connectors [0ee02cf]
    - [x] Write Tests: Define coordinate calculation tests [0ee02cf]
    - [x] Implement: Update `updateConnector` logic in `document-viewer.tsx` to use cubic bezier curves or "elbow" paths [0ee02cf]
- [x] Task: UI Cleanup - Remove Diamond & Decorative Elements [0ee02cf]
    - [x] Implement: Delete the diamond shape and refine `FlagBubble` header/spacing [0ee02cf]
- [x] Task: Implement Context-Aware Risk Highlighting [0ee02cf]
    - [x] Write Tests: Define tests for conditional class application based on focus [0ee02cf]
    - [x] Implement: Update `updateParagraphStates` to only show risk categories when `isSelected` is true [0ee02cf]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Visual UX' (Protocol in workflow.md)

## Phase 3: Polish & Conflict Management
Ensure multiple flagging experiences don't conflict.

- [x] Task: Refine Flag Selection Interaction [0ee02cf]
    - [x] Implement: Ensure clicking a specific flag icon or highlight focuses *that* specific flag in the bubble [0ee02cf]
- [x] Task: Final Polish & Style Reconciliation [0ee02cf]
    - [x] Implement: Ensure all highlights and underlines match the revised design principles [0ee02cf]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Polish' (Protocol in workflow.md)
