# Project State

**Project:** Ambrose (Contract Redlining)
**Branch:** nextjs-migration
**Last Updated:** 2026-02-11

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Analyze contracts intelligently and generate precise, surgical redlines
**Current focus:** v1.1 Cloud Deployment -- Phase 9 pending

## Current Milestone

**v1.1 -- Cloud Deployment**

Phase: 9 of 13 (Containerization)
Plan: --
Status: Ready to plan
Last activity: 2026-02-11 -- Roadmap created for v1.1 milestone

## Previous Milestone (v1.0)

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
| 6 | Dialogs + Finalization | In Progress | 80% |
| 7 | Polish + Validation | Pending | 0% |
| 8 | Cleanup + Cutover | Pending | 0% |

**Note:** v1.0 phases 5-8 have remaining work. v1.1 planning proceeds in parallel.

## Accumulated Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 0 | Next.js 16 + Tailwind v4 + shadcn/ui | Modern stack, Vercel aesthetic |
| 0 | Zustand over Redux | Simpler API for single-user app |
| 5 | react-resizable-panels v4 | Library already installed |
| 6 | Store-sourced revision list in finalize dialog | Store is single source of truth |
| v1.1 | Railway over Vercel/Fly.io | PaaS simplicity, persistent volumes |
| v1.1 | Gunicorn gthread (not gevent) | asyncio.run() conflicts with gevent monkey-patching |
| v1.1 | proxy.ts over rewrites() | Next.js 16 standalone mode bug #87071 |
| v1.1 | File-based sessions (no Redis/DB) | Single user, adequate for current scale |

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 1 | Flag button on risk card shows red fill when risk is flagged | 2026-02-10 | 081b6c9 |
| 2 | Toggle to hide target doc panel nav bar | 2026-02-10 | 4703579 |
| 3 | Fix layout so app renders fullscreen within viewport | 2026-02-10 | 17ba4c9 |
| 4 | Navigator toggle button shows right arrow and Show text when nav bar is hidden | 2026-02-10 | 3981aa2 |

## Session Continuity

Last session: 2026-02-11
Last activity: 2026-02-11 - Created v1.1 Cloud Deployment roadmap (Phases 9-13)
Resume file: None

---
*State updated: 2026-02-11*
