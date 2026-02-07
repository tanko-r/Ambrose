---
phase: 03-sidebar-risk-analysis
plan: 03
subsystem: ui
tags: [react, overlay, progress-bar, animation, shadcn, lucide-react, zustand]

# Dependency graph
requires:
  - phase: 03-sidebar-risk-analysis/01
    provides: useAnalysis hook, analysisStatus/analysisStage/analysisPercent/stageDisplay store state
  - phase: 00-scaffolding
    provides: Zustand store, shadcn/ui Progress component, type definitions
provides:
  - AnalysisOverlay component showing real-time analysis progress with two-stage indicator
  - Auto-start analysis integration in review page
  - Visual feedback during 60-90 second analysis process
affects: [03-04 document-highlighting, 04-revision-bottom-sheet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRotatingVerb custom hook with setInterval + fade transition for cycling messages"
    - "StageIcon helper mapping AnalysisStage to Loader2/Check/Circle icons"
    - "Fixed full-screen overlay with backdrop-blur-sm and bg-background/80"

key-files:
  created:
    - frontend/src/components/review/analysis-overlay.tsx
  modified:
    - frontend/src/app/review/[sessionId]/page.tsx

key-decisions:
  - "Local useRotatingVerb hook kept in overlay file rather than shared hooks/ — single consumer"
  - "StageIcon uses activeWhen/completeWhen arrays for flexible stage-to-icon mapping"
  - "AnalysisOverlay placed at end of root div in page.tsx — fixed positioning makes DOM order irrelevant"

patterns-established:
  - "Full-screen overlay pattern: fixed inset-0 z-50 with backdrop blur and centered card"
  - "Auto-start hook pattern: useEffect watching loading + status to trigger once"

# Metrics
duration: 2.5min
completed: 2026-02-07
---

# Phase 3 Plan 3: Analysis Overlay + Review Page Wiring Summary

**Full-screen analysis progress overlay with two-stage indicator, progress bar, rotating legal verbs, and auto-start integration in review page**

## Performance

- **Duration:** 2.5 min
- **Started:** 2026-02-07T22:31:07Z
- **Completed:** 2026-02-07T22:33:37Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 1

## Accomplishments
- Created analysis-overlay.tsx with full-screen backdrop-blur overlay that renders only during analysis
- Two-stage indicator (Initial Analysis / Parallel Batches) with animated spinner, checkmark, and dot icons from lucide-react
- shadcn Progress bar with real-time percentage display from store
- useRotatingVerb hook cycling through 19 legal-themed messages every 2.5s with 200ms fade transition
- Wired useAnalysis hook into review page with auto-start on document load
- AnalysisOverlay rendered at page level, self-hides when analysis completes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create analysis-overlay.tsx with progress and rotating verbs** - `0a1963a` (feat)
2. **Task 2: Wire analysis overlay and hook into review page** - `2930383` (feat)

## Files Created/Modified
- `frontend/src/components/review/analysis-overlay.tsx` - New overlay component: reads analysisStatus/stage/percent/stageDisplay from store, renders two-stage indicator with icons, Progress bar, stage text, and rotating verbs with fade
- `frontend/src/app/review/[sessionId]/page.tsx` - Added useAnalysis + AnalysisOverlay imports, auto-start useEffect, overlay rendering at end of root div

## Decisions Made
- useRotatingVerb hook is local to analysis-overlay.tsx rather than in hooks/ since it has exactly one consumer
- StageIcon helper uses activeWhen/completeWhen arrays to avoid deeply nested ternaries for stage-to-icon mapping
- AnalysisOverlay placed after BottomBar in JSX but uses fixed positioning so DOM order is irrelevant

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analysis overlay fully functional: shows progress during analysis, hides on completion
- Review page auto-triggers analysis on document load, preventing user from needing to click anything
- Ready for Plan 03-04: document highlighting + hover/focus wiring between sidebar and document

## Self-Check: PASSED

---
*Phase: 03-sidebar-risk-analysis*
*Completed: 2026-02-07*
