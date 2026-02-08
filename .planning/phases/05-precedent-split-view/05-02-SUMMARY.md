---
phase: 05-precedent-split-view
plan: 02
subsystem: ui
tags: [react, floating-ui, forwardRef, dangerouslySetInnerHTML, lucide-react]

# Dependency graph
requires:
  - phase: 05-precedent-split-view
    provides: "Plan 01: PrecedentSnippet types, Zustand precedent state slice, usePrecedent hook, SplitLayout, CSS animations"
provides:
  - "PrecedentContent: HTML renderer with imperative highlights and scrollToClause via forwardRef"
  - "PrecedentSelectionTooltip: floating actions (Copy, Use in Revision, Flag) on text selection"
  - "PrecedentNavigator: hierarchical paragraph list with search, match filter, position modes"
  - "PrecedentPanel: composed panel with header, lock toggle, close, keyboard shortcuts, layout modes"
affects: [05-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [forwardRef-imperative-handle-scroll, virtual-element-floating-tooltip, navigator-position-modes]

key-files:
  created:
    - frontend/src/components/review/precedent-content.tsx
    - frontend/src/components/review/precedent-selection-tooltip.tsx
    - frontend/src/components/review/precedent-navigator.tsx
    - frontend/src/components/review/precedent-panel.tsx

key-decisions:
  - "refs.setReference with VirtualElement for floating-ui v2 (not setPositionReference)"
  - "useImperativeHandle for scrollToClause in PrecedentContent forwardRef"
  - "PrecedentNavigator position modes use simple conditional rendering (not CSS-only)"
  - "Flag for Reference uses existing flagItem API with attorney default, no category UI"
  - "Overlay navigator uses backdrop click to dismiss"
  - "Pulse tracking via useRef Set diff with 1.5s cleanup timeout"

patterns-established:
  - "PrecedentContent forwardRef: expose scrollToClause to parent via useImperativeHandle"
  - "Selection tooltip: mouseup -> getSelection -> virtual element -> useFloating positioning"
  - "Navigator position modes: right-sidebar (flex-row), bottom-drawer (flex-col), overlay (absolute + backdrop)"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 5 Plan 02: Precedent UI Components Summary

**PrecedentContent HTML renderer with forwardRef scroll, PrecedentSelectionTooltip floating actions via @floating-ui/react-dom, PrecedentNavigator with search/match/position modes, and PrecedentPanel composing all with header/lock/keyboard shortcuts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08T23:40:37Z
- **Completed:** 2026-02-08T23:45:32Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created PrecedentContent with dangerouslySetInnerHTML rendering, requestAnimationFrame click handlers, related-clause highlight classes, and scrollToClause exposed via forwardRef/useImperativeHandle
- Created PrecedentSelectionTooltip with @floating-ui/react-dom virtual element positioning for three actions: Copy, Use in Revision, Flag for Reference (using existing flagItem API with attorney default)
- Created PrecedentNavigator with hierarchical paragraph list, text search, match-only filter toggle, blue dot indicators, pulse animation for new matches, and three position modes with segmented icon toggle
- Created PrecedentPanel composing header (filename + lock toggle + close), content, and navigator with Escape/Ctrl+Shift+P keyboard shortcuts, related clause pulse tracking, and initial scroll target support

## Task Commits

Each task was committed atomically:

1. **Task 1: PrecedentContent + PrecedentSelectionTooltip** - `71d51bf` (feat)
2. **Task 2: PrecedentNavigator** - `c4f299a` (feat)
3. **Task 3: PrecedentPanel** - `b4a08ee` (feat)

## Files Created/Modified

- `frontend/src/components/review/precedent-content.tsx` - Renders precedent HTML with imperative highlights, click handlers, scrollToClause via forwardRef
- `frontend/src/components/review/precedent-selection-tooltip.tsx` - Floating tooltip on text selection with Copy/Use/Flag actions via @floating-ui/react-dom
- `frontend/src/components/review/precedent-navigator.tsx` - Hierarchical paragraph navigator with search, match filter, position modes, pulse highlights
- `frontend/src/components/review/precedent-panel.tsx` - Assembled panel composing header, content, and navigator with lock toggle, keyboard shortcuts

## Decisions Made

- Used `refs.setReference()` with `VirtualElement` (has `getBoundingClientRect`) instead of `setPositionReference` which does not exist in `@floating-ui/react-dom` v2.1.7 -- the plan referenced a different API version
- PrecedentNavigator position modes use conditional rendering in PrecedentPanel rather than CSS-only approach -- simpler, avoids hydration mismatches
- Flag for Reference uses existing `flagItem` API with `flag_type: "attorney"` as default -- no two-category flag UI (Phase 6 responsibility)
- Overlay navigator includes a semi-transparent backdrop for click-to-dismiss behavior
- Pulse tracking uses `useRef<Set<string>>` to diff previous vs current related para IDs with a 1.5s timeout cleanup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected floating-ui virtual element API**
- **Found during:** Task 1 (PrecedentSelectionTooltip)
- **Issue:** Plan specified `refs.setPositionReference()` but @floating-ui/react-dom v2.1.7 only exposes `refs.setReference()` which accepts `Element | VirtualElement`
- **Fix:** Used `refs.setReference({ getBoundingClientRect: () => rect })` instead
- **Files modified:** `frontend/src/components/review/precedent-selection-tooltip.tsx`
- **Verification:** TypeScript compilation passes with zero errors
- **Committed in:** `71d51bf` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix for API mismatch)
**Impact on plan:** Minimal -- corrected an API call name to match the installed library version. No scope creep.

## Issues Encountered

None beyond the floating-ui API mismatch documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four precedent UI components are ready for integration
- Plan 03 can import PrecedentPanel and wire it into the review page via SplitLayout
- PrecedentContent exposes scrollToClause via forwardRef for external navigation triggers
- PrecedentPanel accepts initialScrollTarget prop for scroll-on-open behavior
- Full TypeScript compilation passes cleanly

## Self-Check: PASSED

- All 4 files verified present on disk
- All 3 task commits verified in git log (71d51bf, c4f299a, b4a08ee)
- TypeScript compilation: zero errors

---
*Phase: 05-precedent-split-view*
*Completed: 2026-02-08*
