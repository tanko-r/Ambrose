# Project State

**Project:** Ambrose (Contract Redlining)
**Branch:** nextjs-migration
**Last Updated:** 2026-02-07

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Analyze contracts intelligently and generate precise, surgical redlines
**Current focus:** Next.js frontend migration — Phase 3 (Sidebar + Risk Analysis) in progress

## Current Milestone

**v1.0 — Next.js Migration + Feature Completion**

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| A | High-Fidelity Document Rendering | Complete | 100% |
| B | Analysis Acceleration | Complete | 100% |
| 0 | Scaffolding + Foundation | Complete | 100% |
| 1 | Core Layout + Intake | Complete | 100% |
| 2 | Document Viewer + Navigation | Complete | 100% |
| 3 | Sidebar + Risk Analysis | In progress | 75% (plan 3/4) |
| 4 | Revision Bottom Sheet + Track Changes | Pending | 0% |
| 5 | Precedent Split View | Pending | 0% |
| 6 | Dialogs + Finalization | Pending | 0% |
| 7 | Polish + Validation | Pending | 0% |
| 8 | Cleanup + Cutover | Pending | 0% |

**Overall:** 5/11 phases complete, Phase 3 in progress (plan 3 of 4 done)

Progress: [##########          ] 50%

## Next Action

Continue Phase 3: Sidebar + Risk Analysis (plan 04)
- Wire document highlighting: hover/focus risk highlights in document paragraphs
- Connect sidebar risk cards to document scroll/highlight
- Complete Phase 3

## Recent Activity

- 2026-02-07: Phase 3 Plan 03 complete — analysis overlay + review page wiring
- 2026-02-07: Phase 3 Plan 02 complete — risk-card, risk-accordion, sidebar refactor
- 2026-02-07: Phase 3 Plan 01 complete — store state + CSS + analysis hook
- 2026-02-07: Unified roadmap — consolidated GSD v1.0 + Next.js migration
- 2026-02-07: Created `nextjs-migration` branch, committed Phases 0-2
- 2026-02-07: Deleted merged branches (app-redesign-01-29-2026, condensed-context-approach)
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
| 2 | 3 outline modes in nav panel | Linear, By Risk, By Category — different review workflows |
| 3 | Toggle behavior for focusedRiskId | Click same risk to unfocus, matching old sidebar.js pattern |
| 3 | getAnalysis as authoritative completion signal | Polling provides incremental UX; getAnalysis hydrates full results |
| 3 | Silent polling on transient errors | Prevents flaky network from killing analysis UX |
| 3 | Button toggle for include/exclude (no Switch installed) | Simpler; avoids adding new shadcn component for one toggle |
| 3 | No-op hover/focus handlers in Plan 02 | Plan 04 Wave 2 wires real store connections; avoids Wave 1 conflicts |
| 3 | Local useRotatingVerb hook in overlay file | Single consumer, no need for shared hooks/ location |
| 3 | AnalysisOverlay at end of root div | Fixed positioning makes DOM order irrelevant; cleaner JSX |
| A | docx-parser-converter for HTML | Pure Python, ~100ms, preserves all formatting |
| B | Conversation forking for parallelism | 30 concurrent forks, ~90s analysis, $2.50/doc |
| — | Unified roadmap | v1.0 features built in Next.js phases, not separately |

## Session Continuity

Last session: 2026-02-07
Stopped at: Completed 03-03-PLAN.md (analysis overlay + review page wiring)
Resume file: None

---
*State updated: 2026-02-07*
