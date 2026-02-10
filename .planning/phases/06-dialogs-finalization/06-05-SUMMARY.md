---
phase: 06-dialogs-finalization
plan: 05
subsystem: ui, api
tags: [finalize, export, dropdown, localStorage, unaccept, revision-sync]

# Dependency graph
requires:
  - phase: 06-02
    provides: FinalizeDialog component, useFinalize hook, BottomBar wiring
provides:
  - POST /api/unaccept endpoint for reverting accepted revisions
  - Enhanced POST /api/accept with optional edited text payload
  - Store-sourced approved revision list in finalize dialog
  - Export dropdown with Redline/Clean/Both options and auto-download
  - Author name autofill via localStorage persistence
  - "Approved" terminology throughout finalize UI
affects: [07-polish-validation, 08-cleanup-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic update with backend sync rollback (unaccept)"
    - "localStorage persistence for user preferences (author name)"
    - "Store as single source of truth for dialog data (no preview fetch)"

key-files:
  created: []
  modified:
    - app/api/routes.py
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/use-revision.ts
    - frontend/src/components/dialogs/finalize-dialog.tsx

key-decisions:
  - "Store-sourced revision list eliminates preview fetch on dialog open"
  - "Optimistic unaccept with backend rollback on failure"
  - "Auto-download triggered by useEffect after export state change"
  - "Author name persisted to localStorage under 'ambrose-author-name' key"

patterns-established:
  - "Optimistic update with revert: update store immediately, call API, revert on error"
  - "localStorage preference persistence with SSR-safe initialization"

# Metrics
duration: 6min
completed: 2026-02-10
---

# Phase 6 Plan 05: Finalize Dialog Gap Closure Summary

**Store-sourced approved revision list, export dropdown with auto-download, backend unaccept sync, and UI terminology/alignment fixes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-10T19:09:48Z
- **Completed:** 2026-02-10T19:16:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Backend and frontend fully synced on revision accept/unaccept state with optimistic updates
- Finalize dialog uses store as single source of truth -- no more preview fetch on open
- Export button replaced with dropdown offering Redline Only, Clean Only, or Both with auto-download
- All user-facing text says "Approved" instead of "Accepted"
- Author name persists across sessions via localStorage
- Stat boxes redesigned with centered alignment and consistent number display
- Redundant Original/Revised text removed from revision accordion

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend unaccept endpoint + accept with edited text + frontend API wiring** - `62c5555` (feat)
2. **Task 2: Finalize dialog UI fixes + store-sourced revision list + export dropdown + author autofill** - `c10de10` (feat)

## Files Created/Modified
- `app/api/routes.py` - Added POST /api/unaccept endpoint; enhanced /api/accept with optional revised/diff_html fields
- `frontend/src/lib/types.ts` - Added UnacceptRequest/UnacceptResponse; updated AcceptRequest with optional fields
- `frontend/src/lib/api.ts` - Added unacceptRevision API function using FLASK_DIRECT
- `frontend/src/hooks/use-revision.ts` - Async reopen() with backend sync; accept() sends edited text
- `frontend/src/components/dialogs/finalize-dialog.tsx` - Full rework: store-sourced list, approved terminology, centered stats, diff-only accordion, localStorage author, export dropdown

## Decisions Made
- Store-sourced revision list eliminates the preview fetch on dialog open, making the dialog instant and the store the single source of truth
- Optimistic unaccept pattern: update store immediately, sync to backend, revert on API error
- Auto-download triggered by a useEffect watching exported+exportType state, with 500ms delay between dual downloads to prevent browser blocking
- Author name stored in localStorage under 'ambrose-author-name' key with SSR-safe initialization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Finalize dialog is fully functional with all UAT gaps closed
- Export workflow offers flexible options (Redline/Clean/Both)
- Backend and frontend stay in sync on revision state changes
- Ready for Phase 7 polish and Phase 8 cleanup

## Self-Check: PASSED

- All 5 modified files exist on disk
- Commit 62c5555 (Task 1) verified in git log
- Commit c10de10 (Task 2) verified in git log
- TypeScript compilation passes (npx tsc --noEmit)
- Production build passes (npm run build)
