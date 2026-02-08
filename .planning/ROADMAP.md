# Roadmap: Ambrose (Contract Redlining)

**Created:** 2026-02-01  
**Updated:** 2026-02-07  
**Milestone:** v1.0 — Next.js Migration + Feature Completion

## Overview

Unified roadmap consolidating the Next.js frontend migration with remaining v1.0 features. The old vanilla JS frontend is being replaced by Next.js + Tailwind + shadcn/ui. Features that were pending in the old GSD roadmap (Finalize Redline, Transmittal, Compare Precedent, New Project) are now built as part of the relevant Next.js migration phases rather than separately.

**Branch:** `nextjs-migration` (all remaining work happens here)

| Phase | Name | Goal | Status |
| --- | --- | --- | --- |
| A | High-Fidelity Document Rendering | Exact Word formatting in both panels | Complete |
| B | Analysis Acceleration | Analysis time from 30+ min to \<2 min | Complete |
| 0 | Scaffolding + Foundation | Next.js app, types, API client, store, design tokens | Complete |
| 1 | Core Layout + Intake | Header, intake form, recent projects, new project dialog | Complete |
| 2 | Document Viewer + Navigation | HTML rendering, nav panel, sidebar shell, bottom bar | Complete |
| 3 | Sidebar + Risk Analysis | Risk accordion, analysis overlay, hover highlights | Complete |
| 4 | Revision Bottom Sheet + Track Changes | Diff display, accept/reject, inline editing | Complete |
| 5 | Precedent Split View | Precedent panel, resizable panes, related clauses | Pending |
| 6 | Dialogs + Finalization | Flag, finalize (Word export), transmittal, new project | Pending |
| 7 | Polish + Validation | Keyboard shortcuts, accessibility, responsive, visual parity | Pending |
| 8 | Cleanup + Cutover | Archive vanilla JS, dev scripts, README update | Pending |

## Completed Work (Prior Roadmap)

### Phase A: High-Fidelity Document Rendering (was GSD Phase 5)

Pure Python DOCX-to-HTML conversion via docx-parser-converter. Preserves numbering, fonts, indentation, styles. ~100ms conversion with caching. Used in both main panel and precedent panel.

### Phase B: Analysis Acceleration (was GSD Phase 6)

Conversation forking architecture: initial full-document analysis with Claude Opus + 30 parallel batch forks. Pre-filters non-substantive paragraphs. ~90 seconds, ~$2.50/doc with prompt caching. Real-time progress UI.

### Phase 0-2: Next.js Migration Foundation (Complete)

*   **Phase 0:** Next.js 16 scaffold, 16 shadcn/ui components, Zustand store, typed API client for all 30+ endpoints, design tokens, API proxy config
*   **Phase 1:** Header with dropdown menus, drag-drop intake form, recent projects list, new project confirmation dialog
*   **Phase 2:** Document viewer (HTML rendering, click handlers, state classes), collapsible navigation panel (3 outline modes, search, severity indicators), sidebar shell (Risks/Related/Definitions/Flags tabs), bottom bar (progress, severity pills, navigation)

### Phase 3: Sidebar + Risk Analysis (Complete)

*   **Phase 3:** Risk accordion with include/exclude toggles, analysis overlay with real-time progress, risk text highlighting via TreeWalker, sidebar tabs (definitions, related clauses, flags)

## Remaining Phases

### Phase 4: Revision Bottom Sheet + Track Changes

**Goal:** Generate and manage redline revisions with track-changes visualization.

**Plans:** 3 plans

Plans:

*   04-01-PLAN.md — Infrastructure: shadcn Drawer, track-changes.ts DOM utils, useRevision hook, store/type extensions, CSS
*   04-02-PLAN.md — Components: TrackChangesEditor (contentEditable), RevisionSheet (Drawer), RevisionActions
*   04-03-PLAN.md — Wiring: Generate button, page layout, auto-open, BottomBar visibility

**Verification:** Generate revision for a risk, see track-changes diff, accept/reject, edit inline

---

### Phase 5: Precedent Split View

**Goal:** Side-by-side precedent viewing with related clause highlighting.

**Covers v1.0 requirements:** PREC-01, PREC-02, PREC-03, PREC-04

**Tasks:**

*   precedent-panel.tsx
*   precedent-navigator.tsx
*   react-resizable-panels integration
*   use-precedent.ts hook

**Verification:** Open precedent view, resize panes, see related clauses highlighted, copy text

---

### Phase 6: Dialogs + Finalization

**Goal:** Complete the end-to-end workflow with export, transmittal, and project management.

**Covers v1.0 requirements:** FIN-01, FIN-02, FIN-03, FIN-04, TRANS-01, TRANS-02, TRANS-03, TRANS-04, NEW-01, NEW-02, NEW-03, NEW-04

**Tasks:**

*   flag-dialog.tsx (flag paragraphs for client review)
*   finalize-dialog.tsx (review accepted revisions, export Word docs with track changes + clean)
*   transmittal-dialog.tsx (generate cover email with revision summary + flags)
*   new-project-dialog.tsx (save/discard current work, return to intake)
*   use-flags.ts hook
*   Backend: Finalize endpoint using python-redlines for track changes Word export

**Verification:** Flag items, finalize to Word (track changes + clean), transmittal email opens, new project resets to intake

---

### Phase 7: Polish + Validation

**Goal:** Production-quality UX polish and accessibility.

**Tasks:**

*   Keyboard shortcuts (navigation, accept/reject, flag)
*   Light/dark mode toggle
*   Compact mode
*   LocalStorage preferences persistence
*   Bottom bar risk filters + prev/next navigation
*   Loading/error/empty states throughout
*   Responsive behavior
*   Accessibility audit (WCAG 2.2 AA)
*   Visual parity check vs old UI
*   Design token audit

**Verification:** Keyboard navigation works, modes toggle, preferences persist, accessible

---

### Phase 8: Cleanup + Cutover

**Goal:** Remove old frontend, finalize dev setup.

**Tasks:**

*   Archive app/static/ to \_archived/
*   Remove Flask send\_from\_directory for index.html
*   Dev startup script (both servers)
*   Update README

**Verification:** Old frontend removed, `npm run dev` + Flask starts cleanly, README accurate

---

## Requirement Traceability

| Requirement | Covered In | Status |
| --- | --- | --- |
| FIN-01..04 | Phase 6 | Pending |
| TRANS-01..04 | Phase 6 | Pending |
| PREC-01..04 | Phase 5 | Pending |
| NEW-01..04 | Phase 6 | Pending |
| RENDER-01..04 | Phase A | Complete |
| ACCEL-01..04 | Phase B | Complete |

---

_Roadmap created: 2026-02-01_  
_Unified: 2026-02-07 (consolidated GSD + Next.js migration into single roadmap)_