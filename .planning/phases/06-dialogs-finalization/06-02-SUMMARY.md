---
phase: 06-dialogs-finalization
plan: 02
subsystem: ui
tags: [react, dialog, finalize, export, docx, download, accordion, zustand]

# Dependency graph
requires:
  - phase: 04-revision-bottom-sheet
    provides: "Revision model with accepted state, store revisions slice"
  - phase: 00-scaffolding
    provides: "shadcn Dialog, Accordion, Input, Badge components"
provides:
  - "useFinalize hook (fetchPreview, doExport, download)"
  - "FinalizeDialog component with stats, revision accordion, author name, export/download"
  - "Wired Finalize Redline button in bottom bar"
affects: [06-dialogs-finalization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AbortController cleanup in useEffect for React strict mode"
    - "Blob download via URL.createObjectURL + anchor click"
    - "Store getState() for non-reactive reads in callbacks"

key-files:
  created:
    - "frontend/src/hooks/use-finalize.ts"
    - "frontend/src/components/dialogs/finalize-dialog.tsx"
  modified:
    - "frontend/src/components/review/bottom-bar.tsx"

key-decisions:
  - "FinalizeDialog uses shadcn Dialog (not AlertDialog) for complex content"
  - "Stats computed from store (not just preview) for real-time accuracy"
  - "Fragment wrapper in BottomBar to render dialog outside bar layout"

patterns-established:
  - "Blob download pattern: createObjectURL -> anchor click -> revokeObjectURL"
  - "Preview-then-export two-step flow for finalization"

# Metrics
duration: 5min
completed: 2026-02-10
---

# Phase 6 Plan 02: Finalize & Export Dialog Summary

**Finalize dialog with stats cards, expandable revision accordion, author name input, and dual Word document download (track changes + clean)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-10T05:42:08Z
- **Completed:** 2026-02-10T05:47:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- useFinalize hook providing fetchPreview, doExport, and download methods with full error handling via toast
- FinalizeDialog with 3 stats cards (accepted count, flag count, unreviewed warning), scrollable accordion of accepted revisions with diff_html, configurable author name input, and export/download flow
- Bottom bar Finalize Redline button wired to open dialog, disabled when no accepted revisions

## Task Commits

Each task was committed atomically:

1. **Task 1: useFinalize hook + FinalizeDialog** - `839b415` (feat)
2. **Task 2: Bottom bar Finalize button wiring** - `de7e013` (feat)

**Plan metadata:** pending (docs: complete finalize-export plan)

## Files Created/Modified
- `frontend/src/hooks/use-finalize.ts` - Hook with fetchPreview, doExport, download methods
- `frontend/src/components/dialogs/finalize-dialog.tsx` - Full finalize dialog with stats, accordion, author input, export/download UI
- `frontend/src/components/review/bottom-bar.tsx` - Wired Finalize Redline button with FinalizeDialog

## Decisions Made
- Used shadcn Dialog (not AlertDialog) since finalize dialog has complex content (accordion, stats, inputs)
- Stats (accepted count, flag count, unreviewed count) computed from store for real-time accuracy, not just from preview response
- Fragment wrapper in BottomBar to render FinalizeDialog outside the bar's flex layout div

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Finalize dialog complete and wired to bottom bar
- Plan 06-03 (transmittal dialog, flag dialog, sidebar flag button) can proceed -- it depends on this plan
- Session stays open after export per locked decision

## Self-Check: PASSED

All 3 files found. All 2 commits verified.

---
*Phase: 06-dialogs-finalization*
*Completed: 2026-02-10*
