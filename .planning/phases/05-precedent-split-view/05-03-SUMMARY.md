---
phase: 05-precedent-split-view
plan: 03
subsystem: ui
tags: [react, zustand, split-layout, sidebar-overlay, precedent-integration, popover]

# Dependency graph
requires:
  - phase: 05-precedent-split-view
    provides: "Plan 01: SplitLayout, Zustand precedent state, usePrecedent hook, CSS animations"
  - phase: 05-precedent-split-view
    provides: "Plan 02: PrecedentPanel, PrecedentContent, PrecedentNavigator, SelectionTooltip"
provides:
  - "Review page with SplitLayout wrapping DocumentViewer and PrecedentPanel"
  - "Sidebar with three modes: normal, collapsed (left/right tab), overlay (z-40)"
  - "Related clause cards clickable to open precedent panel scrolled to clause"
  - "Snippet badge on Generate button with removal popover"
  - "precedentScrollTarget store field for clause-click-to-open flow"
  - "Navigator position persistence to localStorage"
affects: [06-dialogs-finalization]

# Tech tracking
tech-stack:
  added: [shadcn-popover, @radix-ui/react-popover]
  patterns: [sidebar-overlay-collapse, snippet-injection-on-generate, store-subscribe-persistence]

key-files:
  created:
    - frontend/src/components/ui/popover.tsx
  modified:
    - frontend/src/app/review/[sessionId]/page.tsx
    - frontend/src/components/review/sidebar.tsx
    - frontend/src/components/review/related-clauses-tab.tsx
    - frontend/src/components/review/precedent-panel.tsx
    - frontend/src/lib/store.ts

key-decisions:
  - "Sidebar uses fixed overlay on LEFT side (z-40) when precedent is open, not affecting SplitLayout"
  - "Auto-collapse sidebar on precedent open via useEffect on precedentPanelOpen"
  - "Snippet badge uses shadcn Popover (newly installed) for removal dropdown"
  - "Precedent snippets passed as customInstruction to generate() call"
  - "Navigator position persisted via manual store.subscribe diff (not subscribeWithSelector)"
  - "precedentScrollTarget cleared in PrecedentPanel after initial scroll, also on closePrecedentPanel"

patterns-established:
  - "Sidebar three-mode pattern: normal aside, collapsed restore tab (left or right), overlay with backdrop"
  - "Store subscribe persistence: useEffect with prev-value diff for localStorage sync"
  - "Snippet injection: snippets collected via precedent tooltip -> queued in store -> injected as customInstruction on generate"

# Metrics
duration: 6min
completed: 2026-02-08
---

# Phase 5 Plan 03: Precedent Integration + Wiring Summary

**Wired SplitLayout into review page, implemented sidebar overlay/collapse on precedent open, made related clause cards clickable to open precedent with scroll target, and added snippet badge on Generate button with Popover removal UI**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T23:48:24Z
- **Completed:** 2026-02-08T23:54:31Z
- **Tasks:** 3 of 4 (Task 4 is human verification checkpoint)
- **Files modified:** 6 (+ 1 created)

## Accomplishments

- Integrated SplitLayout into the review page, wrapping DocumentViewer with PrecedentPanel as the precedent slot; navigator position initialized from and persisted to localStorage
- Sidebar now has three modes based on precedent state: normal (380px aside), collapsed (left-edge or right-edge restore tab), and overlay (fixed z-40 on left with backdrop dismiss)
- Related clause cards are now clickable buttons that set a scroll target in the store and open the precedent panel; similarity percentages removed per user decision; "Open Precedent" link shown when no matches found
- Snippet badge on Generate button shows count of queued precedent snippets with a Popover for viewing and removing individual snippets; snippets are passed as customInstruction when generating revisions
- Added precedentScrollTarget field to Zustand store with setter and cleanup on panel close

## Task Commits

Each task was committed atomically:

1. **Task 1: Review page layout -- integrate SplitLayout and PrecedentPanel** - `7915c0c` (feat)
2. **Task 2: Sidebar overlay/collapse when precedent is open** - `8c65397` (feat)
3. **Task 3: Related tab opens precedent + snippet badge on Generate button** - `def197e` (feat)

**Task 4:** Human verification checkpoint -- pending

## Files Created/Modified

- `frontend/src/app/review/[sessionId]/page.tsx` - Imports SplitLayout + PrecedentPanel, wraps DocumentViewer, initializes/persists navigator position, reads precedentScrollTarget
- `frontend/src/components/review/sidebar.tsx` - Three-mode sidebar (normal/collapsed/overlay), auto-collapse on precedent open, snippet badge with Popover, snippet injection on generate
- `frontend/src/components/review/related-clauses-tab.tsx` - Clickable clause cards with ArrowRight affordance, "Open Precedent" link, similarity percentages removed, store selectors moved above early returns
- `frontend/src/components/review/precedent-panel.tsx` - Clears precedentScrollTarget after initial scroll
- `frontend/src/lib/store.ts` - Added precedentScrollTarget field, setPrecedentScrollTarget action, cleared on closePrecedentPanel
- `frontend/src/components/ui/popover.tsx` - New shadcn Popover component (installed via shadcn CLI)

## Decisions Made

- Sidebar overlay positioned on the LEFT side when precedent is open (not the right), using `fixed top-[49px] left-0 bottom-0 z-40` -- this avoids interfering with the SplitLayout which occupies the center-right area
- Auto-collapse uses a `useEffect` watching `precedentPanelOpen`, with eslint-disable for intentional dep exclusion to only trigger on the precedent state change
- Snippet badge uses the shadcn Popover component (newly installed) rather than a custom dropdown -- consistent with the project's shadcn-based component library
- Navigator position persistence uses a manual `store.subscribe` with previous-value comparison because the Zustand store doesn't have `subscribeWithSelector` middleware installed
- Related clause `useAppStore` selectors for `openPrecedentPanel` and `setPrecedentScrollTarget` were moved above early returns to comply with React hooks rules (Rule 1 - Bug auto-fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React hooks rule violation in RelatedClausesTab**
- **Found during:** Task 3
- **Issue:** Store selectors (`openPrecedentPanel`, `setPrecedentScrollTarget`) were initially placed after conditional early returns, violating React's rules of hooks
- **Fix:** Moved the `useAppStore` selector calls to the top of the component, alongside the existing `hasPrecedent` selector
- **Files modified:** `frontend/src/components/review/related-clauses-tab.tsx`
- **Verification:** TypeScript compilation passes; hooks are now unconditionally called
- **Committed in:** `def197e` (Task 3 commit)

**2. [Rule 1 - Bug] Fixed Zustand subscribe API usage**
- **Found during:** Task 1
- **Issue:** Initial implementation used `useAppStore.subscribe(selector, callback)` overload which requires `subscribeWithSelector` middleware not present in the store
- **Fix:** Used basic `subscribe(callback)` with manual previous-value comparison for navigator position persistence
- **Files modified:** `frontend/src/app/review/[sessionId]/page.tsx`
- **Verification:** TypeScript compilation passes; localStorage persistence works correctly
- **Committed in:** `7915c0c` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All precedent split view features are wired end-to-end
- Task 4 human verification checkpoint is pending -- requires running both servers and testing the full workflow
- After human approval, Phase 5 is complete and Phase 6 (Dialogs + Finalization) can begin
- Full TypeScript compilation passes cleanly (zero errors)

## Self-Check: PASSED

- All 6 modified/created files verified present on disk
- All 3 task commits verified in git log (7915c0c, 8c65397, def197e)
- TypeScript compilation: zero errors

---
*Phase: 05-precedent-split-view*
*Completed: 2026-02-08 (Tasks 1-3; Task 4 pending human verification)*
