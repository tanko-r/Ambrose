---
phase: 04-revision-bottom-sheet-track-changes
plan: 03
subsystem: ui
tags: [react, zustand, contenteditable, track-changes, revision, drawer, bottom-sheet]

# Dependency graph
requires:
  - phase: 04-02
    provides: "TrackChangesEditor, RevisionActions, RevisionSheet components"
  - phase: 04-01
    provides: "useRevision hook, store extensions, track-changes utils, Drawer/CSS"
provides:
  - "End-to-end revision workflow: generate, view, edit inline, accept/reject/reopen"
  - "Sidebar Generate/View/Regenerate buttons wired to useRevision hook"
  - "RiskAccordion ref-based included-risk-IDs getter for selective revision"
  - "Auto-open bottom sheet when clicking paragraph with existing revision"
  - "BottomBar auto-hide when revision sheet is open"
affects: [05-precedent-split-view, 06-dialogs-finalization, 07-polish-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ref-based callback for cross-component data access without state lifting"
    - "Store getState() reads inside useEffect to avoid infinite loops with revisions"
    - "Rotating verb animation for long-running generation UX"

key-files:
  created: []
  modified:
    - "frontend/src/components/review/sidebar.tsx"
    - "frontend/src/components/review/risk-accordion.tsx"
    - "frontend/src/app/review/[sessionId]/page.tsx"
    - "frontend/src/components/review/bottom-bar.tsx"
    - "frontend/src/components/review/document-viewer.tsx"

key-decisions:
  - "Ref callback pattern for risk IDs avoids lifting riskInclusions state to sidebar"
  - "Store getState() in auto-open effect prevents infinite loop from revision subscription"
  - "BottomBar returns null when sheet is open rather than CSS visibility toggle"

patterns-established:
  - "Ref-based cross-component communication: parent passes MutableRefObject, child assigns getter"
  - "Rotating verb UX pattern for long AI operations (reusable for future analysis/generation)"

# Metrics
duration: 8min
completed: 2026-02-08
---

# Phase 4 Plan 03: Wiring + Integration Summary

**End-to-end revision workflow wired: sidebar Generate/View/Regenerate buttons, auto-open bottom sheet on paragraph click, BottomBar visibility toggle, and risk inclusion filtering**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-07T19:36:00Z (approx)
- **Completed:** 2026-02-07T19:41:00Z (approx)
- **Tasks:** 2 auto tasks completed (+ 1 checkpoint pending)
- **Files modified:** 5

## Accomplishments

- Sidebar Generate Revision button fully wired to useRevision().generate() with included-risk filtering
- RiskAccordion exposes included risk IDs via ref callback pattern (no state lifting needed)
- View Revision / Regenerate buttons conditionally shown when paragraph has existing revision
- Rotating verb animation provides polished UX during long generation calls
- RevisionSheet rendered in review page layout (fixed-position bottom panel)
- BottomBar auto-hides when revision sheet is open to prevent overlap
- Document viewer auto-opens bottom sheet when clicking a paragraph with an existing revision
- Paragraph state classes (has-revision, revision-accepted) correctly reflect store state
- TypeScript compilation and production build both pass cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire sidebar Generate button + risk inclusion flow** - `5050f0a` (feat)
2. **Task 2: Add RevisionSheet to page layout + auto-open + BottomBar visibility** - `bcce70a` (feat)

## Files Created/Modified

- `frontend/src/components/review/sidebar.tsx` - Added useRevision hook, Generate/View/Regenerate buttons, rotating verb animation
- `frontend/src/components/review/risk-accordion.tsx` - Added onIncludedRiskIdsRef prop, ref callback for included risk IDs
- `frontend/src/app/review/[sessionId]/page.tsx` - Added RevisionSheet component rendering
- `frontend/src/components/review/bottom-bar.tsx` - Added bottomSheetOpen check to hide bar when sheet is open
- `frontend/src/components/review/document-viewer.tsx` - Added auto-open useEffect for paragraphs with existing revisions

## Decisions Made

- **Ref callback pattern for risk IDs:** Avoids lifting `riskInclusions` state from RiskAccordion to Sidebar. Parent passes a `MutableRefObject<(() => string[]) | null>` and child assigns its getter function.
- **Store getState() in auto-open effect:** The auto-open useEffect in document-viewer reads `revisions` via `useAppStore.getState()` instead of subscribing to `revisions` as a dependency. This prevents an infinite loop where `setRevisionSheetParaId` triggers RevisionSheet to persist edits via `setRevision`, which would re-trigger the effect.
- **BottomBar returns null when sheet open:** Simpler than CSS visibility toggle; prevents any layout contribution from the bar when the bottom sheet occupies that space.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 matched the plan's action items precisely.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full revision workflow functional end-to-end: select paragraph, generate revision, view diff, edit inline, accept/reject/reopen
- Checkpoint (Task 3) awaits human verification of the complete workflow
- After verification: Phase 4 complete, ready for Phase 5 (Precedent Split View)

## Self-Check: PASSED

- All 5 modified files verified to exist on disk
- Commit `5050f0a` (Task 1) verified in git log
- Commit `bcce70a` (Task 2) verified in git log
- TypeScript compilation passes (`npx tsc --noEmit`)
- Production build passes (`npm run build`)

---
*Phase: 04-revision-bottom-sheet-track-changes*
*Completed: 2026-02-08*
