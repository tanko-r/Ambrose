---
phase: 06-dialogs-finalization
plan: 01
subsystem: ui
tags: [react, zustand, shadcn, flagging, dialog, css]

# Dependency graph
requires:
  - phase: 03-sidebar-risk-analysis
    provides: sidebar tab infrastructure, flag state in store
  - phase: 05-precedent-split-view
    provides: precedent selection tooltip with flagItem call
provides:
  - FlagCategory type and constants (FLAG_CATEGORY_LABELS, FLAG_CATEGORY_COLORS)
  - useFlags hook for flag CRUD operations
  - FlagDialog component for creating flags with category selection
  - Full FlagsTab with listing, management, and creation
  - Document margin flag icons via CSS data attributes
  - Text selection flagging in document viewer
affects: [06-02, 06-03, finalization, transmittal]

# Tech tracking
tech-stack:
  added: []
  patterns: [category-based flag system, data-attribute CSS icons, text-selection floating UI]

key-files:
  created:
    - frontend/src/hooks/use-flags.ts
    - frontend/src/components/dialogs/flag-dialog.tsx
  modified:
    - frontend/src/lib/types.ts
    - app/api/routes.py
    - frontend/src/components/review/flags-tab.tsx
    - frontend/src/components/review/document-viewer.tsx
    - frontend/src/app/globals.css
    - frontend/src/components/review/precedent-selection-tooltip.tsx

key-decisions:
  - "FlagCategory as union type with 4 values, separate from FlagType (client/attorney)"
  - "All user-facing flag categories use flag_type='client' per locked decision"
  - "CSS ::before pseudo-element with SVG data URIs for margin icons, keyed by data-flag-category attribute"
  - "Floating Flag button on text selection using absolute positioning relative to selection bounding rect"

patterns-established:
  - "Category badge color mapping: CATEGORY_BADGE_CLASSES object for consistent flag badge styling"
  - "FlagCard component pattern: reusable card with remove action, section navigation, category badge"
  - "Data attribute driven CSS: data-flag-category enables per-category styling without JS class management"

# Metrics
duration: 7min
completed: 2026-02-10
---

# Phase 6 Plan 01: Flag System Summary

**Four-category flag system with FlagDialog, full FlagsTab listing, document margin icons, and text selection flagging**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-10T05:41:43Z
- **Completed:** 2026-02-10T05:49:15Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Complete flag data model with FlagCategory type, backend category storage, and typed FlagRequest
- useFlags hook providing create/remove/getFlagForPara with toast feedback
- FlagDialog with 2x2 category selector grid (Business Decision, Risk Alert, For Discussion, FYI) and note textarea
- FlagsTab rewrite with full flag listing, category badges, remove actions, and section navigation
- Color-coded margin flag icons in document via CSS pseudo-elements and SVG data URIs
- Text selection flagging: floating Flag button appears on text selection in document viewer

## Task Commits

Each task was committed atomically:

1. **Task 1: Flag data model + backend + hook + dialog** - `e8e7b15` (feat)
2. **Task 2: Flags tab rewrite + document margin icons** - `62778fb` (feat)
3. **Task 3: Text selection flagging + document margin data attributes** - `ea694eb` (feat)

## Files Created/Modified
- `frontend/src/lib/types.ts` - FlagCategory type, FLAG_CATEGORY_LABELS/COLORS constants, category field on Flag/FlagRequest
- `app/api/routes.py` - Backend /flag endpoint reads and stores category field
- `frontend/src/hooks/use-flags.ts` - NEW: useFlags hook with create/remove/getFlagForPara
- `frontend/src/components/dialogs/flag-dialog.tsx` - NEW: FlagDialog with category picker and note input
- `frontend/src/components/review/flags-tab.tsx` - Full rewrite: FlagCard, listing, Add Flag button, remove action
- `frontend/src/components/review/document-viewer.tsx` - data-flag-category attributes, text selection flagging with floating button
- `frontend/src/app/globals.css` - Flag margin icon CSS with 4 category-specific SVG data URIs
- `frontend/src/components/review/precedent-selection-tooltip.tsx` - Added required category field to flagItem call

## Decisions Made
- FlagCategory is a separate type from FlagType -- FlagType distinguishes client vs attorney flags, FlagCategory is the user-facing classification (business-decision, risk-alert, for-discussion, fyi)
- All four user-facing categories use flag_type: 'client' since they are all for client review per the locked decision
- CSS pseudo-elements with inline SVG data URIs for margin icons -- no additional image assets needed, color-coded by data attribute
- Floating Flag button uses absolute positioning relative to the document container, not a portal -- simpler and avoids z-index complexity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed precedent-selection-tooltip missing category field**
- **Found during:** Task 1 (types.ts category addition)
- **Issue:** Adding required `category` to `FlagRequest` interface broke the existing `flagItem` call in `precedent-selection-tooltip.tsx` which didn't pass a category
- **Fix:** Added `category: "fyi"` to the flagItem call in handleFlagForReference
- **Files modified:** frontend/src/components/review/precedent-selection-tooltip.tsx
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** e8e7b15 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary to prevent type error from required field addition. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Flag system complete and ready for transmittal email integration (Plan 03)
- FlagCategory and flag data model ready for finalization pipeline
- All flag entry points working: FlagsTab button, text selection, precedent tooltip

## Self-Check: PASSED

All 8 files verified present. All 3 task commits verified in git log.

---
*Phase: 06-dialogs-finalization*
*Completed: 2026-02-10*
