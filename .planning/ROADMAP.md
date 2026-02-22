# Roadmap: Ambrose (Contract Redlining)

**Created:** 2026-02-01
**Updated:** 2026-02-22 (Phase 13 revised)
**Branch:** `nextjs-migration`

## Milestones

- **v1.0 Next.js Migration + Feature Completion** - Phases A, B, 0-8, 8.1 (in progress)
- **v1.1 Users and Deployment** - Phases 9-13 (planned)

## Phases

<details>
<summary>v1.0 Next.js Migration + Feature Completion (Phases A, B, 0-8, 8.1)</summary>

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
- [x] 05-01-PLAN.md -- Foundation: types, store extensions, use-precedent hook, split-layout, CSS
- [x] 05-02-PLAN.md -- Components: precedent-content, precedent-navigator, precedent-panel, selection tooltip
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

**Plans:** 5 plans

Plans:
- [ ] 07-01-PLAN.md -- Theme infrastructure (next-themes, dark mode CSS, preferences, settings dialog)
- [ ] 07-02-PLAN.md -- Keyboard shortcuts, command palette (Cmd/Ctrl+K), help dialog
- [ ] 07-03-PLAN.md -- Loading/error/empty states, bottom bar filters, compact mode visuals
- [ ] 07-04-PLAN.md -- Small screen warning, accessibility ARIA pass, axe-core, color contrast
- [ ] 07-05-PLAN.md -- Verification checkpoint (human verify all deliverables)

---

### Phase 8: Cleanup + Cutover

**Goal**: Remove the old Flask-rendered frontend and finalize the development setup for Next.js-only workflow.
**Status**: Complete
**Completed**: 2026-02-13

**Depends on**: Phase 7 (UI polish complete and validated)
**Requirements**: None (cleanup phase)

**Success Criteria** (what must be TRUE):
  1. `app/static/` directory is archived (not deleted) and Flask no longer serves static files
  2. Flask backend only serves API endpoints under `/api/*` — no HTML templates or frontend routes
  3. Development startup is streamlined: one command starts both backend and frontend
  4. README.md updated with Next.js setup instructions, tech stack, and development workflow
  5. All references to the old frontend removed from code, docs, and config files

**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md -- Archive old frontend, strip Flask static serving, add concurrently dev script
- [x] 08-02-PLAN.md -- Update all documentation to reflect Next.js-only architecture

---

### Phase 8.1: Documentation Sync + Verification

**Goal**: Close v1.0 audit gaps — verify unconfirmed features (transmittal, new project), update stale tracking documents, and create missing verification files.

**Depends on**: Phase 8 (all feature code complete)
**Requirements**: TRANS-01..04, NEW-01..04 (verify and mark complete)
**Gap Closure**: Closes all gaps from v1.0 milestone audit

**Success Criteria** (what must be TRUE):
  1. Transmittal feature (TRANS-01..04) human-verified working in browser
  2. New project workflow (NEW-01..04) human-verified working in browser
  3. REQUIREMENTS.md: TRANS-01..04 and NEW-01..04 marked complete
  4. ROADMAP.md: Plan checkboxes accurate for phases 5, 6, 7
  5. STATE.md: Progress percentages reflect actual execution status
  6. VERIFICATION.md files created for phases 5, 6, 7

**Plans:** 3 plans

Plans:
- [ ] 08.1-01-PLAN.md -- Human verification of transmittal and new project features
- [ ] 08.1-02-PLAN.md -- Create VERIFICATION.md files for phases 5, 6, 7
- [ ] 08.1-03-PLAN.md -- Update tracking documents (REQUIREMENTS, ROADMAP, STATE)

---

## v1.1 Users and Deployment

**Milestone Goal:** Transform the single-user local tool into a multi-user cloud application — individual attorney workspaces with Clerk authentication, PostgreSQL persistent storage, Docker containers, and Railway deployment. Every session and document is isolated per user; the app handles long-running analysis without HTTP timeouts.

**Phase Overview:**

| Phase | Name | Goal | Requirements | Status |
|-------|------|------|--------------|--------|
| 9 | DB + Async Analysis | PostgreSQL persistence, non-blocking analysis | DB-01..04, ASYNC-01..02 | Complete |
| 10 | Clerk Frontend Auth | Sign-in/up UI, OAuth, route protection | AUTH-01..08, PROT-02 | Complete |
| 11 | Flask Auth Middleware | JWT verification, token forwarding, CORS | PROT-01, PROT-03, CONF-01, CONF-03 | Complete |
| 12 | Workspace Isolation + Storage Config | Complete    | 2026-02-22 | Complete |
| 13 | 2/3 | In Progress|  | Not started |

**Execution Order:** 9 and 10 can run in parallel. 11 requires both 9 and 10. 12 requires 9, 10, and 11. 13 requires all prior phases.

---

### Phase 9: Database + Async Analysis

**Goal**: Sessions persist in PostgreSQL across server restarts, and analysis runs as a non-blocking background job so Railway's HTTP timeout cannot kill it.

**Depends on**: v1.0 complete (Phases 8.1)
**Status**: Complete
**Completed**: 2026-02-19
**Requirements**: DB-01, DB-02, DB-03, DB-04, ASYNC-01, ASYNC-02

**Success Criteria** (what must be TRUE):
  1. User can close and reopen the app and their session is still there (data survived server restart)
  2. Starting analysis returns immediately — the UI shows a job ID and polls for progress without holding an HTTP connection open
  3. A 50+ page document completes analysis without being killed by an HTTP timeout
  4. Database schema can be upgraded via `flask db upgrade` without data loss

**Plans:** 2 plans

Plans:
- [x] 09-01-PLAN.md -- Database foundation: SQLAlchemy/Migrate setup, SessionRecord model, updated get/save_session with DB persistence
- [x] 09-02-PLAN.md -- Async analysis: POST /start endpoint, background thread, frontend POST+poll pattern

---

### Phase 10: Clerk Frontend Auth

**Goal**: Users can sign up, log in (email/password + Google + Microsoft OAuth), enable MFA, and are redirected to sign-in when not authenticated. User identity appears in the app header.

**Depends on**: v1.0 complete (can develop in parallel with Phase 9)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, PROT-02

**Success Criteria** (what must be TRUE):
  1. User can create an account with email and password, receive a verification email, and only access the app after verifying
  2. User can log in with Google OAuth or Microsoft OAuth in one click
  3. User can enable TOTP-based MFA on their account from account settings
  4. User can log out and all browser sessions are terminated
  5. Unauthenticated users who visit any app URL are redirected to the sign-in page

**Plans:** 2 plans

Plans:
- [x] 10-01-PLAN.md -- Install Clerk SDK, create proxy.ts middleware, ClerkProvider in layout, sign-in page
- [x] 10-02-PLAN.md -- Replace header user dropdown with Clerk UserButton, end-to-end verification

---

### Phase 11: Flask Auth Middleware + API Token Forwarding

**Goal**: Every Flask API endpoint verifies a Clerk JWT on every request. The Next.js frontend automatically injects auth tokens into API calls. CORS is env-var-driven, not hardcoded.

**Depends on**: Phase 9 (user records storable in PostgreSQL), Phase 10 (Clerk JWT format known)
**Status**: Complete
**Completed**: 2026-02-21
**Requirements**: PROT-01, PROT-03, CONF-01, CONF-03

**Success Criteria** (what must be TRUE):
  1. Any API call without a valid Clerk JWT receives a 401 response — no exceptions, no missed endpoints
  2. A logged-in user's API calls succeed without any manual token handling in the frontend
  3. CORS allowed origins are changed by setting an environment variable (no code change or rebuild required)
  4. The backend URL used by the frontend is changed by setting an environment variable (no rebuild required)

**Plans:** 2 plans

Plans:
- [x] 11-01-PLAN.md -- Backend JWT guard: app/auth.py singleton, Blueprint before_request, env-var CORS
- [x] 11-02-PLAN.md -- Frontend token injection: api.ts token provider, AuthTokenProvider component, env-var backend URL

---

### Phase 12: Workspace Isolation + Storage Config

**Goal**: Each authenticated user sees only their own sessions and documents. Session lookups filter by user_id. Uploaded files live in user-scoped directories. Data directory is env-var configurable. Deleted sessions use 30-day trash with restore capability.

**Depends on**: Phase 9 (PostgreSQL session storage), Phase 10 (user identity), Phase 11 (g.clerk_user_id in Flask)
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, CONF-02

**Success Criteria** (what must be TRUE):
  1. Logged-in user A cannot access, view, or retrieve any session or document belonging to user B — even by guessing a session ID
  2. Uploaded documents are stored in a path that includes the user's ID, enforcing filesystem-level isolation
  3. Deleting a session moves files to trash (30-day retention), with restore capability from UI
  4. The data directory location is changed by setting DATA_DIR environment variable (no code change required)

**Plans:** 2/2 plans complete

Plans:
- [x] 12-01-PLAN.md -- Backend isolation: DATA_DIR config, DB migration (user_id + deleted_at), get_session ownership, user-scoped paths, list_sessions filtering
- [x] 12-02-PLAN.md -- Trash system: delete/restore/list-trash endpoints, auto-purge, confirmation dialog, trash view UI

---

### Phase 13: Containerization + Railway Deployment

**Goal**: Both services run in Docker containers configurable entirely by environment variables. The app is deployed and running on Railway with persistent file storage, health checks, and local development unchanged.

**Depends on**: Phases 9, 10, 11, 12 (all functional components complete and locally tested)
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, CONF-04, RAIL-01, RAIL-02, RAIL-03, RAIL-04

**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts both services and the full app is usable at localhost with no additional configuration
  2. `python run.py` + `npm run dev` still works exactly as before — zero configuration changes for local development
  3. The app is accessible at a public Railway URL, authenticated users can log in, upload documents, and run analysis
  4. Uploaded documents and session data survive a Railway redeploy (persistent volume confirmed)
  5. `/api/version` returns git commit information from environment variables (no .git directory required in container)

**Plans:** 2/3 plans executed

Plans:
- [ ] 13-01-PLAN.md -- Docker containers: Dockerfiles (backend + frontend), docker-compose.yml, .dockerignore, gunicorn, Next.js standalone
- [ ] 13-02-PLAN.md -- Railway config: railway.toml files, version endpoint env var fix
- [ ] 13-03-PLAN.md -- Railway deployment: create project, attach PostgreSQL, mount volume, deploy services, verify public URL

---

## v1.1 Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| DB-01 | Phase 9 | PostgreSQL stores user accounts and session metadata |
| DB-02 | Phase 9 | Session metadata persists across server restarts |
| DB-03 | Phase 9 | Large blobs on filesystem, not in database |
| DB-04 | Phase 9 | Schema managed via migrations (Flask-Migrate/Alembic) |
| ASYNC-01 | Phase 9 | Analysis endpoints return immediately with job ID |
| ASYNC-02 | Phase 9 | Analysis runs in background thread with progress polling |
| AUTH-01 | Phase 10 | User can sign up with email and password |
| AUTH-02 | Phase 10 | User receives email verification after signup |
| AUTH-03 | Phase 10 | User can reset password via email link |
| AUTH-04 | Phase 10 | User can log in with Google OAuth |
| AUTH-05 | Phase 10 | User can log in with Microsoft OAuth |
| AUTH-06 | Phase 10 | User can enable MFA (TOTP/authenticator app) |
| AUTH-07 | Phase 10 | User can log out (including all devices) |
| AUTH-08 | Phase 10 | User session persists across browser close/reopen |
| PROT-02 | Phase 10 | Frontend redirects unauthenticated users to sign-in |
| PROT-01 | Phase 11 | All /api/* endpoints return 401 without valid auth token |
| PROT-03 | Phase 11 | Flask verifies Clerk JWT on every API request via Blueprint middleware |
| CONF-01 | Phase 11 | CORS origins configurable via CORS_ORIGINS env var |
| CONF-03 | Phase 11 | Backend URL configurable in frontend via env var |
| WORK-01 | Phase 12 | User can only see and access their own sessions/projects |
| WORK-02 | Phase 12 | Session lookup requires both session_id and user_id |
| WORK-03 | Phase 12 | Uploaded documents stored in user-scoped file paths |
| WORK-04 | Phase 12 | Deleting a session removes associated files from disk |
| CONF-02 | Phase 12 | Data directory configurable via DATA_DIR env var |
| DOCK-01 | Phase 13 | Backend runs in Docker container with gunicorn gthread workers |
| DOCK-02 | Phase 13 | Frontend runs in Docker container with Next.js standalone output |
| DOCK-03 | Phase 13 | docker-compose.yml enables local integration testing |
| DOCK-04 | Phase 13 | .dockerignore files prevent bloat |
| CONF-04 | Phase 13 | Local development workflow works unchanged |
| RAIL-01 | Phase 13 | railway.toml config files with health checks and restart policy |
| RAIL-02 | Phase 13 | Backend uses persistent volume for uploads and session files |
| RAIL-03 | Phase 13 | Version endpoint provides git info via env vars |
| RAIL-04 | Phase 13 | Railway PostgreSQL plugin configured with DATABASE_URL auto-injection |

**Coverage: 33/33 v1.1 requirements mapped. No orphans.**

---

## Progress

**Execution Order:** 9 and 10 in parallel -> 11 -> 12 -> 13

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
| 7. Polish | v1.0 | 0/5 | Not started | - |
| 8. Cleanup | v1.0 | 2/2 | Complete | 2026-02-13 |
| 8.1 Doc Sync + Verify | v1.0 | 0/3 | Not started | - |
| 9. DB + Async Analysis | v1.1 | 2/2 | Complete | 2026-02-19 |
| 10. Clerk Frontend Auth | v1.1 | 2/2 | Complete | 2026-02-19 |
| 11. Flask Auth Middleware | v1.1 | 2/2 | Complete | 2026-02-21 |
| 12. Workspace Isolation | v1.1 | 2/2 | Complete | 2026-02-22 |
| 13. Containerization + Railway | v1.1 | 0/3 | Not started | - |

---

_Roadmap created: 2026-02-01_
_Unified: 2026-02-07 (consolidated GSD + Next.js migration into single roadmap)_
_v1.1 milestone added: 2026-02-11_
_v1.1 expanded: 2026-02-18 (Users and Deployment — auth + PostgreSQL + workspace isolation + deployment)_
