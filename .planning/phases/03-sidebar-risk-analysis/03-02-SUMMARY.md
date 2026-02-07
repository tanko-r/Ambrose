---
phase: 03-sidebar-risk-analysis
plan: 02
subsystem: ui
tags: [react, accordion, shadcn, risk-card, sidebar, zustand]

# Dependency graph
requires:
  - phase: 02-document-viewer
    provides: sidebar shell with flat risk list, store with riskMap/risks state
  - phase: 03-sidebar-risk-analysis plan 01
    provides: shadcn Accordion component installed, globals.css paragraph state CSS
provides:
  - RiskCard component with severity badge, effective severity arrow, relationships, include/exclude toggle
  - RiskAccordion component wrapping shadcn Accordion with single-expand behavior
  - SeverityBadge exported for reuse across components
  - Refactored sidebar using RiskAccordion instead of flat list
affects:
  - 03-sidebar-risk-analysis plan 04 (wires hover/focus handlers to store)
  - 04-revision-bottom-sheet (uses include/exclude state from RiskAccordion)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AccordionItem per risk with single-expand (type='single' collapsible)"
    - "Local riskInclusions state with default-included semantics"
    - "No-op handlers for cross-component wiring deferred to later plan"

key-files:
  created:
    - frontend/src/components/review/risk-card.tsx
    - frontend/src/components/review/risk-accordion.tsx
  modified:
    - frontend/src/components/review/sidebar.tsx

key-decisions:
  - "Used button toggle for include/exclude instead of Switch (no Switch component installed)"
  - "No-op hover/focus handlers — Plan 04 Wave 2 wires real store connections"
  - "Include/exclude defaults all risks to included (undefined = true)"
  - "Effective severity uses ArrowRight icon between base and effective badges"

patterns-established:
  - "RiskCard pattern: AccordionItem + AccordionTrigger + AccordionContent with severity, description, highlight_text, relationships, toggle"
  - "Deferred cross-component wiring via no-op callbacks to avoid Wave 1 dependency conflicts"

# Metrics
duration: 4min
completed: 2026-02-07
---

# Phase 3 Plan 02: Risk Card + Accordion Components Summary

**Interactive risk accordion with severity badges (effective severity arrows), highlight text blocks, mitigated/amplified relationships, and include/exclude toggles replacing flat sidebar list**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-07T22:22:54Z
- **Completed:** 2026-02-07T22:26:28Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- Built RiskCard component with full risk display: severity badge with effective severity arrow, description, highlight_text excerpt block, mitigated/amplified relationships, and include/exclude toggle
- Built RiskAccordion wrapping RiskCards in shadcn Accordion with single-expand (one risk open at a time)
- Refactored sidebar.tsx to use RiskAccordion, removing old flat RisksTabContent and inline SeverityBadge
- Exported SeverityBadge separately for reuse by other components

## Task Commits

Each task was committed atomically:

1. **Task 1: Create risk-card.tsx and risk-accordion.tsx** - `00e4da3` (feat)
2. **Task 2: Refactor sidebar.tsx to use RiskAccordion** - `0dc5dd5` (feat)

## Files Created/Modified
- `frontend/src/components/review/risk-card.tsx` - RiskCard with severity, description, highlight text, relationships, toggle; SeverityBadge export
- `frontend/src/components/review/risk-accordion.tsx` - RiskAccordion wrapper with single-expand behavior and selection count footer
- `frontend/src/components/review/sidebar.tsx` - Refactored to use RiskAccordion, removed old flat list sub-components

## Decisions Made
- Used a Button-based include/exclude toggle rather than a Switch component (Switch not installed in shadcn)
- Hover and focus handlers are no-ops in this plan — Plan 04 (Wave 2) will wire them to store.hoveredRiskId / focusedRiskId once those store fields exist
- Risk inclusions tracked locally in RiskAccordion state with default-included semantics (undefined = true)
- Used ArrowRight lucide icon between base and effective severity badges for the effective severity arrow display

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RiskAccordion and RiskCard are ready for Plan 04 to wire hover/focus handlers to the Zustand store
- Include/exclude state is local; Phase 4 (revision) will need to read this state — may need to lift to store
- sidebar.tsx is clean and ready for remaining tab implementations (definitions, related clauses)

## Self-Check: PASSED

---
*Phase: 03-sidebar-risk-analysis*
*Completed: 2026-02-07*
