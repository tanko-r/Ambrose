# Project State

**Project:** Ambrose (Contract Redlining)
**Branch:** nextjs-migration
**Last Updated:** 2026-02-10

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Analyze contracts intelligently and generate precise, surgical redlines
**Current focus:** Next.js frontend migration -- Phase 6 Plans 01 and 02 complete, Plan 03 next

## Current Milestone

**v1.0 -- Next.js Migration + Feature Completion**

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| A | High-Fidelity Document Rendering | Complete | 100% |
| B | Analysis Acceleration | Complete | 100% |
| 0 | Scaffolding + Foundation | Complete | 100% |
| 1 | Core Layout + Intake | Complete | 100% |
| 2 | Document Viewer + Navigation | Complete | 100% |
| 3 | Sidebar + Risk Analysis | Complete | 100% |
| 4 | Revision Bottom Sheet + Track Changes | Complete | 100% |
| 5 | Precedent Split View | In Progress | 67% |
| 6 | Dialogs + Finalization | In Progress | 67% |
| 7 | Polish + Validation | Pending | 0% |
| 8 | Cleanup + Cutover | Pending | 0% |

**Overall:** 7/11 phases complete, Phase 6 Plans 01-02 of 03 complete

Progress: [################    ] 80%

## Next Action

Phase 6 Plan 03: Transmittal dialog and finalization wiring
- Depends on Plans 06-01 (flag system) and 06-02 (finalize dialog) -- both complete
- Wire transmittal email generation and remaining finalization integration

## Recent Activity

- 2026-02-10: Phase 6 Plan 01 complete -- FlagCategory type, useFlags hook, FlagDialog, FlagsTab rewrite, margin icons, text selection flagging
- 2026-02-10: Phase 6 Plan 02 complete -- FinalizeDialog with stats, revision accordion, author name, export/download; bottom bar wiring
- 2026-02-08: Phase 5 Plan 03 Tasks 1-3 complete -- SplitLayout in review page, sidebar overlay/collapse, related tab click-to-open, snippet badge
- 2026-02-08: Phase 5 Plan 02 complete -- PrecedentContent, SelectionTooltip, Navigator, Panel components
- 2026-02-08: Phase 5 Plan 01 complete -- types, store precedent slice, usePrecedent hook, SplitLayout, CSS animations
- 2026-02-08: Phase 4 COMPLETE -- Plan 03: wiring + integration (Generate button, auto-open, BottomBar visibility)
- 2026-02-08: Phase 4 Plan 02 complete -- TrackChangesEditor, RevisionActions, RevisionSheet components
- 2026-02-08: Phase 4 Plan 01 complete -- Drawer installed, track-changes utils, useRevision hook, store/CSS extensions
- 2026-02-07: Phase 3 COMPLETE -- Plan 04: risk highlighting + definitions/related/flags tabs
- 2026-02-07: Phase 3 Plan 03 complete -- analysis overlay + review page wiring
- 2026-02-07: Phase 3 Plan 02 complete -- risk-card, risk-accordion, sidebar refactor
- 2026-02-07: Phase 3 Plan 01 complete -- store state + CSS + analysis hook
- 2026-02-07: Unified roadmap -- consolidated GSD v1.0 + Next.js migration
- 2026-02-07: Created `nextjs-migration` branch, committed Phases 0-2
- 2026-02-07: Next.js Phase 2 complete (document viewer, nav panel, sidebar, bottom bar)
- 2026-02-03: GSD Phase 6 complete (analysis acceleration with conversation forking)
- 2026-02-03: GSD Phase 5 complete (high-fidelity document rendering)

## Accumulated Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 0 | Next.js 16 + Tailwind v4 + shadcn/ui | Modern stack, Vercel aesthetic, component library |
| 0 | Zustand over Redux | Simpler API, less boilerplate for single-user app |
| 0 | API proxy via next.config.ts rewrites | Avoids CORS issues; flask-cors as fallback |
| 2 | dangerouslySetInnerHTML for document | Backend renders HTML; useEffect click handlers |
| 2 | 3 outline modes in nav panel | Linear, By Risk, By Category -- different review workflows |
| 3 | Toggle behavior for focusedRiskId | Click same risk to unfocus, matching old sidebar.js pattern |
| 3 | getAnalysis as authoritative completion signal | Polling provides incremental UX; getAnalysis hydrates full results |
| 3 | Silent polling on transient errors | Prevents flaky network from killing analysis UX |
| 3 | Button toggle for include/exclude (no Switch installed) | Simpler; avoids adding new shadcn component for one toggle |
| 3 | No-op hover/focus handlers in Plan 02 | Plan 04 Wave 2 wires real store connections; avoids Wave 1 conflicts |
| 3 | TreeWalker for risk text highlighting | Precise DOM text matching within backend-rendered HTML paragraphs |
| 3 | useRef Map cache for related clauses | Prevents duplicate API calls when revisiting same paragraph |
| 3 | Focused risk priority over hovered | Prevents flicker when clicking a risk while hovering another |
| 3 | Local useRotatingVerb hook in overlay file | Single consumer, no need for shared hooks/ location |
| 3 | AnalysisOverlay at end of root div | Fixed positioning makes DOM order irrelevant; cleaner JSX |
| 4 | shadcn Drawer (Vaul) for bottom sheet | Official shadcn component with snap points, drag gestures, non-modal support |
| 4 | Pure DOM track-changes utils (no React) | ContentEditable must be managed imperatively to avoid cursor jump issues |
| 4 | generatingRevision in store (not local state) | Multiple components need to read loading state (sidebar button, bottom sheet) |
| 4 | editedHtml field on Revision type | Persists user inline edits across paragraph switches |
| 4 | EditorRef passed from parent (RevisionSheet) | Parent needs to read innerHTML for persist-on-close and accept operations |
| 4 | Snap points as fractions [0.25, 0.5, 1] | Responsive across viewport sizes; Vaul handles fraction-to-pixel conversion |
| 4 | Ref callback pattern for risk IDs | Avoids lifting riskInclusions state; parent passes MutableRefObject |
| 4 | Store getState() in auto-open effect | Prevents infinite loop from revision subscription in useEffect |
| 4 | BottomBar returns null when sheet open | Simpler than CSS visibility; prevents layout contribution |
| 5 | react-resizable-panels v4 direct API (not shadcn) | Library already installed; Group/Panel/Separator/useDefaultLayout |
| 5 | useRef Map cache for related clauses in usePrecedent | Same pattern as RelatedClausesTab; prevents duplicate API calls |
| 5 | Lock/unlock clears cache entry to force refresh | Ensures fresh data after unlock |
| 5 | togglePrecedentPanel clears lock state on close | Clean UX; prevents stale lock when reopening |
| 5 | refs.setReference with VirtualElement for floating-ui v2 | setPositionReference doesn't exist in v2.1.7; VirtualElement works |
| 5 | forwardRef + useImperativeHandle for PrecedentContent scroll | Parent PrecedentPanel needs programmatic scrollToClause access |
| 5 | Flag for Reference uses flagItem with attorney default | No category UI until Phase 6; keeps tooltip simple |
| 5 | Navigator position modes via conditional rendering | Simpler than CSS-only; avoids hydration mismatches |
| 5 | Sidebar overlay on LEFT side when precedent open | Avoids interfering with SplitLayout center-right area |
| 5 | Snippet badge via shadcn Popover for removal UI | Consistent with project component library |
| 5 | Manual store.subscribe for navigator persistence | subscribeWithSelector middleware not in store |
| 5 | precedentScrollTarget cleared after scroll + on close | Clean state across panel reopens |
| 6 | FlagCategory separate from FlagType; all UI categories use flag_type='client' | FlagType=client/attorney; FlagCategory=user classification for client review |
| 6 | CSS ::before pseudo-element with SVG data URIs for margin flag icons | No extra assets; data-flag-category attribute drives color via CSS selectors |
| 6 | Floating Flag button on text selection (absolute positioning) | Simpler than portal; avoids z-index complexity in document viewer |
| 6 | FinalizeDialog uses shadcn Dialog (not AlertDialog) | Complex content (accordion, stats, inputs) needs full Dialog |
| 6 | Stats from store, not just preview | Real-time accuracy; preview only has accepted revisions |
| 6 | Fragment wrapper for dialog in BottomBar | Renders dialog outside bar layout div cleanly |
| A | docx-parser-converter for HTML | Pure Python, ~100ms, preserves all formatting |
| B | Conversation forking for parallelism | 30 concurrent forks, ~90s analysis, $2.50/doc |
| -- | Unified roadmap | v1.0 features built in Next.js phases, not separately |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Flag button on risk card shows red fill when risk is flagged | 2026-02-10 | 081b6c9 | [1-flag-button-on-risk-card-shows-red-fill-](./quick/1-flag-button-on-risk-card-shows-red-fill-/) |
| 2 | Toggle to hide target doc panel nav bar | 2026-02-10 | 4703579 | [2-toggle-to-hide-target-doc-panel-nav-bar](./quick/2-toggle-to-hide-target-doc-panel-nav-bar/) |

## Session Continuity

Last session: 2026-02-10
Last activity: 2026-02-10 - Completed quick task 2: Toggle to hide target doc panel nav bar
Resume file: None

---
*State updated: 2026-02-10*
