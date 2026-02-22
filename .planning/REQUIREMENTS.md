# Requirements: Claude Redlining

**Defined:** 2026-02-01
**Updated:** 2026-02-18
**Core Value:** Analyze contracts intelligently and generate precise, surgical redlines

## v1.0 Requirements (Complete)

### Finalization

- [x] **FIN-01**: User can export Word document with track changes showing all accepted revisions
- [x] **FIN-02**: User can export clean Word document showing final text only (no markup)
- [x] **FIN-03**: Exported documents preserve original formatting exactly (numbering, styles, fonts)
- [x] **FIN-04**: Finalize button shows modal to review accepted revisions before export

### Transmittal

- [ ] **TRANS-01**: User can generate transmittal email summarizing the review
- [ ] **TRANS-02**: Transmittal includes high-level summary of key revisions made
- [ ] **TRANS-03**: Transmittal includes all paragraphs flagged for client review with notes
- [ ] **TRANS-04**: Generate Transmittal opens default email client with content prefilled

### Precedent Comparison

- [x] **PREC-01**: User can open precedent document in separate panel from sidebar
- [x] **PREC-02**: Precedent panel displays full document with navigation
- [x] **PREC-03**: System highlights clauses in precedent that relate to current paragraph
- [x] **PREC-04**: User can copy text from precedent panel for reference

### New Project

- [ ] **NEW-01**: New Project menu item prompts user to save or discard current work
- [ ] **NEW-02**: If save selected, current session is preserved to disk
- [ ] **NEW-03**: After save/discard decision, UI returns to fresh intake form
- [ ] **NEW-04**: Session history allows returning to previous projects (optional enhancement)

### Document Rendering

- [x] **RENDER-01**: Document preview matches Word formatting exactly (fonts, sizes, spacing)
- [x] **RENDER-02**: Automatic numbering renders correctly (1.1, (a), (i), etc.)
- [x] **RENDER-03**: Indentation and margins preserved precisely
- [x] **RENDER-04**: Both main panel and precedent panel use same high-fidelity rendering engine

## v1.1 Requirements (Users and Deployment)

### Authentication (AUTH)

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup (must verify before accessing app)
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User can log in with Google OAuth
- [ ] **AUTH-05**: User can log in with Microsoft OAuth
- [ ] **AUTH-06**: User can enable MFA (TOTP/authenticator app) on their account
- [ ] **AUTH-07**: User can log out (including all devices)
- [ ] **AUTH-08**: User session persists across browser close/reopen (configurable duration)

### Route Protection (PROT)

- [ ] **PROT-01**: All /api/* endpoints return 401 without valid auth token
- [ ] **PROT-02**: Frontend redirects unauthenticated users to sign-in page
- [ ] **PROT-03**: Flask verifies Clerk JWT on every API request via Blueprint-level middleware

### Workspace Isolation (WORK)

- [x] **WORK-01**: User can only see and access their own sessions/projects
- [x] **WORK-02**: Session lookup requires both session_id and authenticated user_id
- [x] **WORK-03**: Uploaded documents stored in user-scoped file paths ({user_id}/{session_id}/)
- [x] **WORK-04**: Deleting a session removes associated files from disk

### Database (DB)

- [x] **DB-01**: PostgreSQL stores user accounts and session metadata
- [x] **DB-02**: Session metadata persists across server restarts (not in-memory only)
- [x] **DB-03**: Large analysis/document blobs stored on filesystem, not in database
- [x] **DB-04**: Database schema managed via migrations (Flask-Migrate/Alembic)

### Containerization (DOCK)

- [ ] **DOCK-01**: Backend runs in Docker container with gunicorn gthread workers
- [ ] **DOCK-02**: Frontend runs in Docker container with Next.js standalone output
- [ ] **DOCK-03**: docker-compose.yml enables local integration testing of both services
- [ ] **DOCK-04**: .dockerignore files prevent node_modules, .git, and data dirs from bloating images

### Configuration (CONF)

- [ ] **CONF-01**: CORS origins configurable via CORS_ORIGINS env var (falls back to localhost for dev)
- [x] **CONF-02**: Data directory configurable via DATA_DIR env var (falls back to app/data/ for dev)
- [ ] **CONF-03**: Backend URL configurable in frontend via env var (no hardcoded localhost)
- [ ] **CONF-04**: Local development workflow (python run.py + npm run dev) works unchanged

### Async Analysis (ASYNC)

- [x] **ASYNC-01**: Analysis endpoints return immediately with job ID (no blocking HTTP connection)
- [x] **ASYNC-02**: Analysis runs in background thread with progress polling via existing UI

### Railway Deployment (RAIL)

- [x] **RAIL-01**: railway.toml config files for both services with health checks and restart policy
- [x] **RAIL-02**: Backend uses persistent volume for uploads and session files
- [x] **RAIL-03**: Version endpoint provides git info via env vars (no .git in container)
- [x] **RAIL-04**: Railway PostgreSQL plugin configured with DATABASE_URL auto-injection

## v2 Requirements

Deferred to future release.

### User Experience

- **UX-01**: Session history page listing past contracts reviewed (My Projects)
- **UX-02**: User profile name/avatar displayed in header bar
- **UX-03**: Account settings page (change email, password, profile)
- **UX-04**: Invite-only / domain allowlist mode for controlled rollout

### Enterprise Auth

- **ENT-01**: SAML SSO via Okta (requires Clerk Enterprise plan)
- **ENT-02**: Microsoft 365 SSO for firm-wide deployment

### Collaboration

- **COLLAB-01**: User can share a session/project with another user
- **COLLAB-02**: Shared sessions show read-only view to non-owner

### Document Library

- **LIB-01**: User can browse previously analyzed documents
- **LIB-02**: User can resume previous sessions
- **LIB-03**: User can build clause library from approved revisions

### Audit & Compliance

- **AUDIT-01**: Audit trail logging revision/flag events with timestamps
- **AUDIT-02**: Admin dashboard for user management

## Out of Scope

| Feature | Reason |
|---------|--------|
| SAML/Okta SSO | Requires Clerk Enterprise ($75/connection/month); defer until firm client needs it |
| Team/firm workspaces | Major permissions model work; individual accounts first |
| Real-time collaboration | Fundamentally different product; CRDTs/Yjs engineering effort |
| Self-hosted / on-premise | Different deployment architecture entirely |
| Admin dashboard | Use Clerk dashboard for user management |
| HIPAA compliance | Contract data is not PHI; HIPAA does not apply to real estate/commercial contracts |
| Per-document access controls | Not needed with individual workspaces; export handles sharing |
| CI/CD pipeline | Railway auto-deploys from GitHub |
| SSL/TLS configuration | Railway handles HTTPS automatically |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIN-01..04 | v1.0 Phase 6 | Complete |
| TRANS-01..04 | v1.0 Phase 6 | In Progress |
| PREC-01..04 | v1.0 Phase 5 | Complete |
| NEW-01..04 | v1.0 Phase 6 | In Progress |
| RENDER-01..04 | v1.0 Phase A | Complete |
| DB-01 | v1.1 Phase 9 | Complete |
| DB-02 | v1.1 Phase 9 | Complete |
| DB-03 | v1.1 Phase 9 | Complete |
| DB-04 | v1.1 Phase 9 | Complete |
| ASYNC-01 | v1.1 Phase 9 | Complete |
| ASYNC-02 | v1.1 Phase 9 | Complete |
| AUTH-01 | v1.1 Phase 10 | Pending |
| AUTH-02 | v1.1 Phase 10 | Pending |
| AUTH-03 | v1.1 Phase 10 | Pending |
| AUTH-04 | v1.1 Phase 10 | Pending |
| AUTH-05 | v1.1 Phase 10 | Pending |
| AUTH-06 | v1.1 Phase 10 | Pending |
| AUTH-07 | v1.1 Phase 10 | Pending |
| AUTH-08 | v1.1 Phase 10 | Pending |
| PROT-02 | v1.1 Phase 10 | Pending |
| PROT-01 | v1.1 Phase 11 | Pending |
| PROT-03 | v1.1 Phase 11 | Pending |
| CONF-01 | v1.1 Phase 11 | Pending |
| CONF-03 | v1.1 Phase 11 | Pending |
| WORK-01 | v1.1 Phase 12 | Complete |
| WORK-02 | v1.1 Phase 12 | Complete |
| WORK-03 | v1.1 Phase 12 | Complete |
| WORK-04 | v1.1 Phase 12 | Complete |
| CONF-02 | v1.1 Phase 12 | Complete |
| DOCK-01 | v1.1 Phase 13 | Pending |
| DOCK-02 | v1.1 Phase 13 | Pending |
| DOCK-03 | v1.1 Phase 13 | Pending |
| DOCK-04 | v1.1 Phase 13 | Pending |
| CONF-04 | v1.1 Phase 13 | Pending |
| RAIL-01 | v1.1 Phase 13 | Complete |
| RAIL-02 | v1.1 Phase 13 | Complete |
| RAIL-03 | v1.1 Phase 13 | Complete |
| RAIL-04 | v1.1 Phase 13 | Complete |

**Coverage:**
- v1.0 requirements: 20 total (12 complete, 8 in progress)
- v1.1 requirements: 33 total, all mapped (0 complete, 33 pending)
- Unmapped: 0

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-18 — v1.1 traceability fully mapped (33/33)*
