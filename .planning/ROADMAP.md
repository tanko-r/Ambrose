# Roadmap: Ambrose (Contract Redlining)

**Created:** 2026-02-01
**Updated:** 2026-02-11
**Branch:** `nextjs-migration`

## Milestones

- **v1.0 Next.js Migration + Feature Completion** - Phases A, B, 0-8 (in progress)
- **v1.1 Cloud Deployment** - Phases 9-13 (planned)

## Phases

<details>
<summary>v1.0 Next.js Migration + Feature Completion (Phases A, B, 0-8)</summary>

### Phase A: High-Fidelity Document Rendering
**Goal**: Exact Word formatting in both document panels
**Status**: Complete
**Requirements**: RENDER-01..04

Pure Python DOCX-to-HTML conversion via docx-parser-converter. Preserves numbering, fonts, indentation, styles. ~100ms conversion with caching. Used in both main panel and precedent panel.

### Phase B: Analysis Acceleration
**Goal**: Analysis time from 30+ min to <2 min
**Status**: Complete

Conversation forking architecture: initial full-document analysis with Claude Opus + 30 parallel batch forks. Pre-filters non-substantive paragraphs. ~90 seconds, ~$2.50/doc with prompt caching. Real-time progress UI.

### Phase 0: Scaffolding + Foundation
**Goal**: Next.js app, types, API client, store, design tokens
**Status**: Complete

Next.js 16 scaffold, 16 shadcn/ui components, Zustand store, typed API client for all 30+ endpoints, design tokens, API proxy config.

### Phase 1: Core Layout + Intake
**Goal**: Header, intake form, recent projects, new project dialog
**Status**: Complete

### Phase 2: Document Viewer + Navigation
**Goal**: HTML rendering, nav panel, sidebar shell, bottom bar
**Status**: Complete

### Phase 3: Sidebar + Risk Analysis
**Goal**: Risk accordion, analysis overlay, hover highlights
**Status**: Complete

### Phase 4: Revision Bottom Sheet + Track Changes
**Goal**: Diff display, accept/reject, inline editing
**Status**: Complete

Plans:
- [x] 04-01-PLAN.md -- Infrastructure: shadcn Drawer, track-changes.ts DOM utils, useRevision hook, store/type extensions, CSS
- [x] 04-02-PLAN.md -- Components: TrackChangesEditor (contentEditable), RevisionSheet (Drawer), RevisionActions
- [x] 04-03-PLAN.md -- Wiring: Generate button, page layout, auto-open, BottomBar visibility

### Phase 5: Precedent Split View
**Goal**: Side-by-side precedent viewing with resizable split pane, related clause highlighting, text selection actions
**Status**: In Progress
**Requirements**: PREC-01..04

Plans:
- [ ] 05-01-PLAN.md -- Foundation: types, store extensions, use-precedent hook, split-layout, CSS
- [ ] 05-02-PLAN.md -- Components: precedent-content, precedent-navigator, precedent-panel, selection tooltip
- [ ] 05-03-PLAN.md -- Integration: page layout, sidebar overlay/collapse, related tab wiring, snippet badge

### Phase 6: Dialogs + Finalization
**Goal**: Complete end-to-end workflow with export, transmittal, and project management
**Status**: In Progress
**Requirements**: FIN-01..04, TRANS-01..04, NEW-01..04

Plans:
- [x] 06-01-PLAN.md -- Flag system: types, backend category, use-flags hook, flag dialog, flags-tab rewrite, margin icons
- [x] 06-02-PLAN.md -- Finalize & export: use-finalize hook, finalize dialog, bottom bar wiring, sidebar flag button
- [ ] 06-03-PLAN.md -- Transmittal + new project: transmittal dialog, new project enhancement, delete dialog
- [ ] 06-04-PLAN.md -- Gap closure: flag card navigation, text selection fixes, flag icon position/tooltip
- [ ] 06-05-PLAN.md -- Gap closure: finalize dialog data sync, UI fixes, export dropdown, author autofill

</details>

---

### Phase 7: Polish + Validation

**Goal**: Deliver production-quality UX polish, accessibility compliance, and visual parity with the original app.

**Depends on**: Phase 6 (core features complete)
**Requirements**: None (polish and validation phase)

**Success Criteria** (what must be TRUE):
  1. Common actions (generate revisions, toggle panels, navigate risks) have keyboard shortcuts that are discoverable
  2. Light/dark mode toggle works correctly and persists across sessions
  3. Compact mode reduces UI density for power users (smaller cards, tighter spacing)
  4. User preferences (theme, mode, filters) persist via localStorage and restore on page load
  5. Bottom bar has working filters to show/hide revisions, flags, and risks
  6. All async operations show loading states, errors display helpful messages, and empty states guide users to next actions
  7. App layout adapts correctly to mobile, tablet, and desktop viewports (responsive design)
  8. Accessibility audit passes: keyboard navigation works, screen reader announces content, ARIA labels present, color contrast meets WCAG 2.1 AA
  9. Next.js UI visually matches the original Flask app (fonts, colors, spacing, component styling)

**Plans**: TBD

---

### Phase 8: Cleanup + Cutover

**Goal**: Remove the old Flask-rendered frontend and finalize the development setup for Next.js-only workflow.

**Depends on**: Phase 7 (UI polish complete and validated)
**Requirements**: None (cleanup phase)

**Success Criteria** (what must be TRUE):
  1. `app/static/` directory is archived (not deleted) and Flask no longer serves static files
  2. Flask backend only serves API endpoints under `/api/*` — no HTML templates or frontend routes
  3. Development startup is streamlined: one command starts both backend and frontend
  4. README.md updated with Next.js setup instructions, tech stack, and development workflow
  5. All references to the old frontend removed from code, docs, and config files

**Plans**: TBD

---

## v1.1 Cloud Deployment

**Milestone Goal:** Make the app deployable to Railway as a two-service project (Flask backend + Next.js frontend) while preserving the local dev workflow.

**Phase Overview:**

| Phase | Name | Goal | Requirements | Status |
|-------|------|------|--------------|--------|
| 9 | Containerization | Both services run in Docker with env-var-driven config | DOCK-01..04, CONF-01, CONF-02, CONF-04 | Not started |
| 10 | API Routing Migration | Frontend routes API via proxy.ts with runtime backend URL | PROX-01, PROX-02, CONF-03 | Not started |
| 11 | Session Resilience | Sessions survive server restarts | SESS-01, SESS-02 | Not started |
| 12 | Railway Deployment | App runs on Railway with persistent storage and health checks | RAIL-01, RAIL-02, RAIL-03 | Not started |
| 13 | Background Analysis | Long-running analysis avoids HTTP timeouts | ASYNC-01, ASYNC-02 | Not started |

---

### Phase 9: Containerization

**Goal**: Both services build and run as Docker containers with all configuration driven by environment variables, while local development works exactly as before.

**Depends on**: v1.0 complete (Phases 5-8)
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, CONF-01, CONF-02, CONF-04

**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts both services and the app is usable at localhost
  2. `python run.py` + `npm run dev` still works exactly as before with zero additional configuration
  3. Backend container uses gunicorn with gthread workers (not the Flask dev server)
  4. Docker images build in under 5 minutes and do not contain node_modules, .git, or data directories

**Plans**: TBD

---

### Phase 10: API Routing Migration

**Goal**: Frontend uses Next.js proxy.ts for all API routing, reading the backend URL from an environment variable at runtime, eliminating the standalone-mode rewrites bug.

**Depends on**: Phase 9
**Requirements**: PROX-01, PROX-02, CONF-03

**Success Criteria** (what must be TRUE):
  1. All API calls from the frontend go through proxy.ts (no rewrites() in next.config.ts)
  2. `npm run dev` routes API calls to localhost:5000 with no env vars set (default fallback)
  3. Setting `BACKEND_URL` env var changes where API calls are routed without rebuilding the frontend

**Plans**: TBD

---

### Phase 11: Session Resilience

**Goal**: Sessions persist across server restarts by auto-loading from disk when not found in memory, with optimized serialization that excludes large parsed document objects.

**Depends on**: Phase 9 (containers must exist to test restart behavior)
**Requirements**: SESS-01, SESS-02

**Success Criteria** (what must be TRUE):
  1. User can restart the backend server and resume their session without re-uploading documents
  2. Session JSON files on disk do not contain parsed_doc or parsed_precedent (keeping file sizes small)
  3. Large objects (parsed_doc, parsed_precedent) are re-derived from source files on session reload

**Plans**: TBD

---

### Phase 12: Railway Deployment

**Goal**: The app runs on Railway as two services with persistent storage, health checks, and automatic restarts.

**Depends on**: Phase 10 (proxy.ts required for standalone mode), Phase 11 (session resilience required for deploy restarts)
**Requirements**: RAIL-01, RAIL-02, RAIL-03

**Success Criteria** (what must be TRUE):
  1. Frontend is accessible at a public Railway URL and API calls reach the Flask backend via private networking
  2. Uploaded documents and session data survive a Railway redeploy
  3. `/api/version` returns git commit info from environment variables (not from .git directory)
  4. Health check endpoints respond correctly and Railway auto-restarts crashed services

**Plans**: TBD

---

### Phase 13: Background Analysis

**Goal**: Analysis endpoints return immediately with a job ID and process in a background thread, avoiding Railway's 15-minute HTTP timeout for large documents.

**Depends on**: Phase 12 (only needed in deployed environment; Railway timeout is the trigger)
**Requirements**: ASYNC-01, ASYNC-02

**Success Criteria** (what must be TRUE):
  1. Analysis request returns immediately with a job ID (no HTTP connection held open for minutes)
  2. Frontend polls for analysis progress and displays incremental status updates
  3. A 50+ page document completes analysis without being killed by HTTP timeout
  4. Existing local development workflow (which does not hit the timeout) still works unchanged

**Plans**: TBD

---

## v1.1 Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| DOCK-01 | Phase 9 | Backend Docker container with gunicorn gthread |
| DOCK-02 | Phase 9 | Frontend Docker container with standalone output |
| DOCK-03 | Phase 9 | docker-compose.yml for local integration testing |
| DOCK-04 | Phase 9 | .dockerignore files prevent bloat |
| CONF-01 | Phase 9 | CORS origins configurable via env var |
| CONF-02 | Phase 9 | Data directory configurable via env var |
| CONF-03 | Phase 10 | Backend URL configurable in frontend via env var |
| CONF-04 | Phase 9 | Local dev workflow works unchanged |
| PROX-01 | Phase 10 | Frontend uses proxy.ts instead of rewrites() |
| PROX-02 | Phase 10 | proxy.ts reads backend URL from env var |
| SESS-01 | Phase 11 | Sessions auto-load from disk on miss |
| SESS-02 | Phase 11 | Large objects excluded from session JSON |
| RAIL-01 | Phase 12 | railway.toml with health checks and restart policy |
| RAIL-02 | Phase 12 | Persistent volume for sessions and uploads |
| RAIL-03 | Phase 12 | Version endpoint via env vars |
| ASYNC-01 | Phase 13 | Analysis returns immediately with job ID |
| ASYNC-02 | Phase 13 | Background thread with progress polling |

**Coverage: 17/17 v1.1 requirements mapped. No orphans.**

---

## Progress

**Execution Order:** 9 -> 10 -> 11 -> 12 -> 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| A. Document Rendering | v1.0 | - | Complete | - |
| B. Analysis Acceleration | v1.0 | - | Complete | - |
| 0. Scaffolding | v1.0 | - | Complete | - |
| 1. Core Layout | v1.0 | - | Complete | - |
| 2. Doc Viewer | v1.0 | - | Complete | - |
| 3. Sidebar + Risk | v1.0 | - | Complete | - |
| 4. Revision Sheet | v1.0 | 3/3 | Complete | - |
| 5. Precedent Split | v1.0 | 0/3 | In progress | - |
| 6. Dialogs + Finalize | v1.0 | 2/5 | In progress | - |
| 7. Polish | v1.0 | 0/? | Not started | - |
| 8. Cleanup | v1.0 | 0/? | Not started | - |
| 9. Containerization | v1.1 | 0/? | Not started | - |
| 10. API Routing | v1.1 | 0/? | Not started | - |
| 11. Session Resilience | v1.1 | 0/? | Not started | - |
| 12. Railway Deploy | v1.1 | 0/? | Not started | - |
| 13. Background Analysis | v1.1 | 0/? | Not started | - |

---

_Roadmap created: 2026-02-01_
_Unified: 2026-02-07 (consolidated GSD + Next.js migration into single roadmap)_
_v1.1 milestone added: 2026-02-11_
