# Project State

**Project:** Ambrose (Contract Redlining)
**Branch:** nextjs-migration
**Last Updated:** 2026-02-11

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Analyze contracts intelligently and generate precise, surgical redlines
**Current focus:** v1.1 Cloud Deployment — defining requirements

## Current Milestone

**v1.1 — Cloud Deployment**

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-11 — Milestone v1.1 started

## Previous Milestone (v1.0)

**v1.0 — Next.js Migration + Feature Completion**

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
| 6 | Dialogs + Finalization | In Progress | 80% |
| 7 | Polish + Validation | Pending | 0% |
| 8 | Cleanup + Cutover | Pending | 0% |

**Note:** v1.0 phases 5-8 have remaining work. v1.1 planning proceeds in parallel.

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
| 3 | TreeWalker for risk text highlighting | Precise DOM text matching within backend-rendered HTML paragraphs |
| 4 | shadcn Drawer (Vaul) for bottom sheet | Official shadcn component with snap points, drag gestures |
| 4 | Pure DOM track-changes utils (no React) | ContentEditable must be managed imperatively |
| 5 | react-resizable-panels v4 direct API | Library already installed |
| 5 | forwardRef + useImperativeHandle for PrecedentContent | Parent needs programmatic scrollToClause access |
| 6 | FlagCategory separate from FlagType | FlagType=client/attorney; FlagCategory=user classification |
| 6 | CSS ::after pseudo-element for flag icons | No extra assets; data-flag-category drives color |
| 6 | Store-sourced revision list in finalize dialog | Eliminates preview fetch; store is single source of truth |
| A | docx-parser-converter for HTML | Pure Python, ~100ms, preserves all formatting |
| B | Conversation forking for parallelism | 30 concurrent forks, ~90s analysis, $2.50/doc |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Flag button on risk card shows red fill when risk is flagged | 2026-02-10 | 081b6c9 | [1-flag-button-on-risk-card-shows-red-fill-](./quick/1-flag-button-on-risk-card-shows-red-fill-/) |
| 2 | Toggle to hide target doc panel nav bar | 2026-02-10 | 4703579 | [2-toggle-to-hide-target-doc-panel-nav-bar](./quick/2-toggle-to-hide-target-doc-panel-nav-bar/) |
| 3 | Fix layout so app renders fullscreen within viewport | 2026-02-10 | 17ba4c9 | [3-fix-layout-so-app-renders-fullscreen-wit](./quick/3-fix-layout-so-app-renders-fullscreen-wit/) |
| 4 | Navigator toggle button shows right arrow and Show text when nav bar is hidden | 2026-02-10 | 3981aa2 | [4-navigator-toggle-button-shows-right-arro](./quick/4-navigator-toggle-button-shows-right-arro/) |

## Session Continuity

Last session: 2026-02-11
Last activity: 2026-02-11 - Started milestone v1.1 Cloud Deployment
Resume file: None

---
*State updated: 2026-02-11*
