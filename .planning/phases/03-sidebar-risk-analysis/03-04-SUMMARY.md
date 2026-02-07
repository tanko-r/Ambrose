---
phase: 03-sidebar-risk-analysis
plan: 04
subsystem: ui
tags: [react, treewalker, highlighting, zustand, definitions, related-clauses, flags, sidebar]

# Dependency graph
requires:
  - phase: 03-sidebar-risk-analysis plan 01
    provides: hoveredRiskId/focusedRiskId store state, CSS highlight rules, use-analysis.ts
  - phase: 03-sidebar-risk-analysis plan 02
    provides: risk-card.tsx, risk-accordion.tsx with no-op handlers, sidebar.tsx with tab structure
provides:
  - Risk text highlighting in document-viewer via TreeWalker (hover + focus)
  - risk-accordion wired to store for hover/focus coordination
  - DefinitionsTab showing defined terms relevant to selected paragraph
  - RelatedClausesTab with API fetching, caching, loading skeleton, error handling
  - FlagsTab showing existing flags or Phase 6 placeholder
  - Fully functional sidebar with all four tabs rendering real components
affects:
  - 04-revision-bottom-sheet (sidebar is now fully interactive for risk review)
  - 06-dialogs-finalization (flags tab references Phase 6 for full flagging UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TreeWalker DOM traversal for precise text highlighting within paragraph elements"
    - "requestAnimationFrame-gated useEffect for highlight updates"
    - "useRef Map cache for API response deduplication in RelatedClausesTab"
    - "Cancellation pattern with closure flag in async useEffect"

key-files:
  created:
    - frontend/src/components/review/definitions-tab.tsx
    - frontend/src/components/review/related-clauses-tab.tsx
    - frontend/src/components/review/flags-tab.tsx
  modified:
    - frontend/src/components/review/document-viewer.tsx
    - frontend/src/components/review/risk-accordion.tsx
    - frontend/src/components/review/sidebar.tsx

key-decisions:
  - "Focused risk takes priority over hovered for highlight class selection"
  - "Fallback matching on first 50 chars when full highlight_text not found in DOM"
  - "Related clauses use Map ref cache keyed by paraId to avoid duplicate API calls"
  - "Flags tab shows Phase 6 note as temporary indicator; full UI deferred"
  - "Definitions tab sorts defined-in-paragraph terms first, then referenced terms alphabetically"

patterns-established:
  - "TreeWalker highlight pattern: clear old marks, find text, split+wrap, normalize on cleanup"
  - "Async fetch in useEffect with cancelled flag for race condition prevention"
  - "useRef Map as component-local cache for API results"

# Metrics
duration: 4min
completed: 2026-02-07
---

# Phase 3 Plan 04: Risk Highlighting + Sidebar Tabs Summary

**TreeWalker-based risk text highlighting wired to hover/focus store state, plus definitions, related-clauses, and flags tabs completing the fully interactive sidebar**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-07T22:31:28Z
- **Completed:** 2026-02-07T22:35:16Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments
- Added risk text highlighting to document-viewer.tsx: reads hoveredRiskId/focusedRiskId from store, uses TreeWalker to find and wrap matching text with CSS highlight classes
- Wired risk-accordion.tsx to call setHoveredRiskId/setFocusedRiskId store actions (replacing no-op handlers from Plan 02)
- Created definitions-tab.tsx: filters defined terms by those defined in the paragraph and those referenced in paragraph text, with deduplication and sorting
- Created related-clauses-tab.tsx: fetches from getRelatedClauses API with Map-based cache, loading skeletons, error handling, and no-precedent guard
- Created flags-tab.tsx: shows existing flags with type badges (client/attorney) or empty state with Phase 6 note
- Updated sidebar.tsx: imports all three new tab components, passes sessionId/paraId props, replaces all placeholder EmptyState messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Risk text highlighting + risk-accordion store wiring** - `399b178` (feat)
2. **Task 2: Definitions, related-clauses, flags tabs + sidebar wiring** - `9993673` (feat)

## Files Created/Modified
- `frontend/src/components/review/document-viewer.tsx` - Added hoveredRiskId/focusedRiskId selectors, highlightRiskText with TreeWalker and fallback, requestAnimationFrame useEffect
- `frontend/src/components/review/risk-accordion.tsx` - Wired setHoveredRiskId/setFocusedRiskId from store, added cleanup useEffect on paraId change
- `frontend/src/components/review/definitions-tab.tsx` - New: filters defined terms by paragraph, deduplicates, sorts defined-first then alphabetical
- `frontend/src/components/review/related-clauses-tab.tsx` - New: API fetch with Map cache, loading skeleton, error state, no-precedent guard
- `frontend/src/components/review/flags-tab.tsx` - New: shows existing flags with type badges, empty state placeholder for Phase 6
- `frontend/src/components/review/sidebar.tsx` - Imports new tabs, adds sessionId selector, replaces placeholder content

## Decisions Made
- Focused risk takes priority over hovered risk for highlight class (risk-highlight-active vs risk-highlight)
- Fallback text matching uses first 50 characters if full highlight_text not found in DOM (accounts for LLM-generated text slight mismatches)
- Related clauses tab uses a useRef Map cache keyed by paraId to prevent duplicate API calls for the same paragraph
- Definitions tab shows terms defined in the selected paragraph first, then terms referenced in paragraph text, both sorted alphabetically
- Flags tab includes a "Full flagging UI available in Phase 6" note as the UI is not yet built

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 is now complete: all four sidebar tabs are functional, risk highlighting works end-to-end
- Phase 4 (Revision Bottom Sheet) can now build on the include/exclude risk state and sidebar interaction
- The include/exclude state in RiskAccordion is still local; Phase 4 may need to lift it to the store for revision generation
- Flags tab is a thin stub; Phase 6 will build the full flagging UI

## Self-Check: PASSED

---
*Phase: 03-sidebar-risk-analysis*
*Completed: 2026-02-07*
