---
phase: 03-sidebar-risk-analysis
plan: 01
subsystem: ui
tags: [zustand, css, react-hooks, polling, risk-analysis, oklch]

# Dependency graph
requires:
  - phase: 02-document-viewer
    provides: document-viewer.tsx with data-para-id elements and updateParagraphStates()
  - phase: 00-scaffolding
    provides: Zustand store, API client, type definitions
provides:
  - hoveredRiskId and focusedRiskId store state for sidebar-document coordination
  - CSS rules for all paragraph visual states (selected, has-risk, has-revision, revision-accepted, flagged)
  - CSS rules for inline risk text highlighting (risk-highlight, risk-highlight-active)
  - useAnalysis hook for analysis polling with incremental risk delivery
affects: [03-02 risk-accordion, 03-03 analysis-overlay, 03-04 document-highlighting, 04-revision-bottom-sheet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polling hook with useRef for race condition prevention (completedRef, lastApiCallIdRef, intervalRef)"
    - "Toggle setter pattern: focusedRiskId clicks same value to null"
    - "oklch color space for all paragraph state CSS"

key-files:
  created:
    - frontend/src/hooks/use-analysis.ts
  modified:
    - frontend/src/lib/store.ts
    - frontend/src/app/globals.css

key-decisions:
  - "Toggle behavior for focusedRiskId (click again to unfocus) matching old sidebar.js pattern"
  - "Polling silently continues on transient errors rather than stopping"
  - "getAnalysis blocks and is the authoritative completion signal; polling is supplementary"

patterns-established:
  - "Polling hook pattern: startPolling/stopPolling with useRef cleanup"
  - "Paragraph state CSS scoped under .document-container [data-para-id]"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 3 Plan 1: Store State + CSS + Analysis Hook Summary

**Zustand hover/focus risk tracking, paragraph visual state CSS rules (oklch), and analysis polling hook with incremental risk delivery**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-07T22:23:28Z
- **Completed:** 2026-02-07T22:28:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added hoveredRiskId and focusedRiskId to UIState with toggle setter for sidebar-document coordination
- Added 50+ lines of paragraph state CSS covering all visual states the document-viewer already toggles
- Created use-analysis.ts hook with 1-second polling, incremental risk delivery, race condition prevention, and cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hover/focus state to store + paragraph CSS** - `c489121` (feat)
2. **Task 2: Create use-analysis.ts polling hook** - `c3ad9eb` (feat)

## Files Created/Modified
- `frontend/src/lib/store.ts` - Added hoveredRiskId, focusedRiskId state + setHoveredRiskId, setFocusedRiskId actions
- `frontend/src/app/globals.css` - Added CSS rules for .selected, .has-risk, .has-revision, .revision-accepted, .flagged, .risk-highlight, .risk-highlight-active
- `frontend/src/hooks/use-analysis.ts` - New polling hook: startAnalysis triggers backend, polls progress at 1s, adds incremental risks, hydrates full results on completion

## Decisions Made
- Toggle behavior for focusedRiskId: clicking same risk ID sets to null (unfocuses), matching the old sidebar.js click-to-lock/unlock pattern
- Polling continues silently on transient errors rather than stopping, preventing flaky network from killing the analysis UX
- getAnalysis() is the authoritative completion signal; polling provides incremental UX updates but does not hydrate full results to avoid races

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Store state ready for risk-accordion.tsx (plan 03-02) to use hoveredRiskId/focusedRiskId
- CSS rules immediately visible once document-viewer.tsx toggles classes on paragraphs
- useAnalysis hook ready for analysis-overlay.tsx (plan 03-03) to call startAnalysis and display progress
- All infrastructure for Phase 3 plans 02-04 is in place

## Self-Check: PASSED

---
*Phase: 03-sidebar-risk-analysis*
*Completed: 2026-02-07*
