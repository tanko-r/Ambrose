---
phase: 05-precedent-split-view
plan: 01
subsystem: ui
tags: [react, zustand, react-resizable-panels, hooks, css-animations]

# Dependency graph
requires:
  - phase: 04-revision-bottom-sheet
    provides: "Store patterns, review UI infrastructure, track-changes utilities"
  - phase: 03-sidebar-risk-analysis
    provides: "RelatedClausesTab pattern, related clause API integration"
provides:
  - "PrecedentSnippet and NavigatorPosition types"
  - "Zustand precedent state slice with lock, snippet queue, navigator position"
  - "usePrecedent hook for data loading, related clause fetching, lock toggle, snippet CRUD"
  - "SplitLayout resizable pane component with localStorage persistence"
  - "CSS animations (pulse, flash) and precedent highlight classes"
affects: [05-02-PLAN, 05-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [resizable-panels-v4-layout, lock-unlock-clause-view, snippet-queue-pattern, related-clause-cache]

key-files:
  created:
    - frontend/src/hooks/use-precedent.ts
    - frontend/src/components/review/split-layout.tsx
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/lib/store.ts
    - frontend/src/app/globals.css

key-decisions:
  - "react-resizable-panels v4 Group/Panel/Separator API (not shadcn wrapper)"
  - "useDefaultLayout with localStorage for persistent panel sizes"
  - "Map cache in useRef for related clauses (same pattern as RelatedClausesTab)"
  - "Lock/unlock clears cache entry on unlock to force refresh"
  - "crypto.randomUUID with Date.now fallback for snippet IDs"
  - "togglePrecedentPanel clears lock state on close for clean UX"

patterns-established:
  - "usePrecedent hook: centralized precedent data management following useRevision/useDocument patterns"
  - "Lock pattern: lockedParaId + lockedRelatedClauses for frozen clause view with separate allRelatedClauses for navigator pulse"
  - "Snippet queue: client-side PrecedentSnippet array in store for text selection collection"

# Metrics
duration: 6min
completed: 2026-02-08
---

# Phase 5 Plan 01: Precedent Foundation Summary

**Zustand precedent state slice with lock/snippet queue, usePrecedent data hook with cached related clauses, resizable SplitLayout via react-resizable-panels v4, and CSS pulse/flash animations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T23:31:13Z
- **Completed:** 2026-02-08T23:37:18Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Extended types.ts with PrecedentSnippet and NavigatorPosition types for the split view feature
- Extended Zustand store with full PrecedentState interface (7 fields) and 9 new actions (lock, snippets, navigator, panel open/close)
- Created usePrecedent hook with precedent data loading, related clause fetching with Map cache, lock/unlock toggle, and snippet queue CRUD
- Created SplitLayout component using react-resizable-panels v4 with 60/40 default split and localStorage persistence
- Added comprehensive CSS for precedent highlights, pulse/flash animations, sidebar overlay positioning, and navigator indicators

## Task Commits

Each task was committed atomically:

1. **Task 1: Types + Store extensions for precedent state** - `d192a3d` (feat)
2. **Task 2: use-precedent hook** - `4bde874` (feat)
3. **Task 3: SplitLayout component + CSS** - `bebd645` (feat)

## Files Created/Modified

- `frontend/src/lib/types.ts` - Added PrecedentSnippet and NavigatorPosition types
- `frontend/src/lib/store.ts` - Added PrecedentState interface, 9 precedent actions, initialPrecedentState, updated resetSession and togglePrecedentPanel
- `frontend/src/hooks/use-precedent.ts` - New hook: precedent data loading, related clause cache, lock toggle, snippet queue management
- `frontend/src/components/review/split-layout.tsx` - New component: resizable split panes with Group/Panel/Separator, localStorage persistence via useDefaultLayout
- `frontend/src/app/globals.css` - Added related-clause highlights, clause-pulse/clause-flash keyframes, sidebar-overlay, nav-match-dot, resize handle styling

## Decisions Made

- Used react-resizable-panels v4 API directly (Group/Panel/Separator/useDefaultLayout) rather than any shadcn wrapper -- the library is already installed as a direct dependency
- Lock/unlock on toggleLock clears the cache entry for the current paraId to force a fresh API call on unlock, ensuring the user sees up-to-date related clauses
- Snippet IDs use crypto.randomUUID with Date.now fallback for environments where crypto may not be available
- togglePrecedentPanel now clears lockedParaId and lockedRelatedClauses on close, matching the closePrecedentPanel behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All precedent types, store state, data hook, layout component, and CSS are in place
- Plan 02 (components: PrecedentPanel, Navigator, ContentViewer, SelectionTooltip) can import and use all artifacts from this plan
- Plan 03 (integration: wiring into review page, sidebar collapse logic) has the SplitLayout shell ready to wrap the document viewer
- Full TypeScript compilation and Next.js build both pass cleanly

## Self-Check: PASSED

- All 6 files verified present on disk
- All 3 task commits verified in git log (d192a3d, 4bde874, bebd645)
- TypeScript compilation: zero errors
- Next.js build: success

---
*Phase: 05-precedent-split-view*
*Completed: 2026-02-08*
