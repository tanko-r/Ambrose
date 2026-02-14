# Project State

**Project:** Ambrose (Contract Redlining)
**Branch:** nextjs-migration
**Last Updated:** 2026-02-13

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
| 6 | Dialogs + Finalization | Complete | 100% |
| 7 | Polish + Validation | In Progress | 80% |
| 8 | Cleanup + Cutover | Complete | 100% |

**Note:** v1.0 phases 5 and 7 have remaining plans. Phase 8 complete. v1.1 planning proceeds in parallel.

## Accumulated Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 0 | Next.js 16 + Tailwind v4 + shadcn/ui | Modern stack, Vercel aesthetic |
| 0 | Zustand over Redux | Simpler API for single-user app |
| 5 | react-resizable-panels v4 | Library already installed |
| 6 | Store-sourced revision list in finalize dialog | Store is single source of truth |
| 6 | Transmittal default: flagged items only (revisions opt-in) | Keeps email concise, user controls detail level |
| 6 | Auto-save on new project (no Save/Discard) | Simpler UX, reduces user confusion |
| 6 | Finalized banner informational, not read-only | Less friction for post-finalize edits |
| v1.1 | Railway over Vercel/Fly.io | PaaS simplicity, persistent volumes |
| v1.1 | Gunicorn gthread (not gevent) | asyncio.run() conflicts with gevent monkey-patching |
| v1.1 | proxy.ts over rewrites() | Next.js 16 standalone mode bug #87071 |
| v1.1 | File-based sessions (no Redis/DB) | Single user, adequate for current scale |
| 7 | next-themes with attribute=class, defaultTheme=system | Standard pattern for Tailwind CSS dark mode |
| 7 | Manual localStorage preferences (no Zustand persist) | Cleaner separation, simpler debugging |
| 7 | react-hotkeys-hook for keyboard shortcuts | Mature library with built-in form field protection |
| 7 | Custom DOM events for cross-component shortcut communication | Decouples keyboard hook from specific UI components |
| 7 | useDelayedLoading with 200ms threshold for skeleton screens | Balances avoiding flash vs. perceived responsiveness |
| 7 | Compact mode: CSS class overrides + Tailwind conditional classes | Card spacing only, no font/icon changes per user decision |
| 7 | Filter toggles default all-on, show-all fallback when all off | Safety fallback prevents empty navigator |
| 7 | Darkened muted-foreground oklch 0.525 -> 0.49 | WCAG AA 4.5:1 contrast on white |
| 7 | Darkened severity-high oklch 0.705 -> 0.62 | White text badge contrast 3:1 |
| 7 | AxeAccessibility as separate client component | Tree-shaken in production, cleaner separation |
| 8 | Archive old frontend to _archived/ (not delete) | Preserves history for reference |
| 8 | Track package-lock.json for root concurrently | Reproducible dev tooling installs |
| 8 | Annotate CONCERNS.md references rather than delete | Preserves audit trail and historical context |

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 1 | Flag button on risk card shows red fill when risk is flagged | 2026-02-10 | 081b6c9 |
| 2 | Toggle to hide target doc panel nav bar | 2026-02-10 | 4703579 |
| 3 | Fix layout so app renders fullscreen within viewport | 2026-02-10 | 17ba4c9 |
| 4 | Navigator toggle button shows right arrow and Show text when nav bar is hidden | 2026-02-10 | 3981aa2 |
| 5 | Stop clause generation button for revision sidebar | 2026-02-13 | a32fdab |
| 6 | Fix Critical/High QA items from Phase 7 regression | 2026-02-13 | b2e31f5, 41696b1 |

## Session Continuity

Last session: 2026-02-13
Last activity: 2026-02-13 - Completed quick task 6 (Critical/High QA fixes: theme persistence, keyboard shortcuts, ARIA, contrast, dark mode)
Resume file: None

---
*State updated: 2026-02-13*
