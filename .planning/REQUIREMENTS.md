# Requirements: Claude Redlining

**Defined:** 2026-02-01
**Updated:** 2026-02-11
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

## v1.1 Requirements (Cloud Deployment)

### Containerization (DOCK)

- [ ] **DOCK-01**: Backend runs in Docker container with python:3.12-slim, gunicorn gthread, and all system deps
- [ ] **DOCK-02**: Frontend runs in Docker container with multi-stage Node build and Next.js standalone output
- [ ] **DOCK-03**: docker-compose.yml enables local integration testing of both services with volume mounts
- [ ] **DOCK-04**: .dockerignore files prevent node_modules, .git, and data dirs from bloating images

### Configuration (CONF)

- [ ] **CONF-01**: CORS origins configurable via CORS_ORIGINS env var (falls back to localhost regex for local dev)
- [ ] **CONF-02**: Data directory configurable via DATA_DIR env var (falls back to app/data/ for local dev)
- [ ] **CONF-03**: Backend URL configurable via env vars in frontend (no hardcoded localhost)
- [ ] **CONF-04**: Local development workflow (python run.py + npm run dev) works unchanged with zero additional configuration

### API Routing (PROX)

- [ ] **PROX-01**: Frontend uses Next.js 16 proxy.ts for API routing instead of rewrites() (avoids standalone mode bug)
- [ ] **PROX-02**: proxy.ts reads backend URL from env var at runtime, defaulting to localhost:5000 for local dev

### Session Resilience (SESS)

- [ ] **SESS-01**: Sessions auto-load from disk when not found in memory (survives server restarts)
- [ ] **SESS-02**: Large objects (parsed_doc, parsed_precedent) excluded from session JSON serialization

### Railway Deployment (RAIL)

- [ ] **RAIL-01**: railway.toml config files for both services with health checks and restart policy
- [ ] **RAIL-02**: Backend uses persistent volume at configurable mount point for sessions and uploads
- [ ] **RAIL-03**: Version endpoint provides git info via env vars when .git/ not available in container

### Background Analysis (ASYNC)

- [ ] **ASYNC-01**: Analysis endpoints return immediately with job ID instead of blocking for 5-30+ min
- [ ] **ASYNC-02**: Analysis runs in background thread with progress polling (avoids Railway 15-min HTTP timeout)

## v2 Requirements

Deferred to future release.

### Document Library

- **LIB-01**: User can browse previously analyzed documents
- **LIB-02**: User can resume previous sessions
- **LIB-03**: User can build clause library from approved revisions

### Settings

- **SET-01**: User can configure default aggressiveness level
- **SET-02**: User can set preferred representation type
- **SET-03**: User can manage API keys through UI

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Single-user tool, authentication deferred |
| Multi-user collaboration | Not needed for solo attorney workflow |
| CI/CD pipeline | Railway auto-deploys from GitHub, no custom pipeline needed |
| SSL/TLS configuration | Railway handles HTTPS automatically |
| Database migration | File-based sessions adequate for single-user |
| Nginx reverse proxy | Railway edge handles SSL termination |
| Celery/Redis | Python threading sufficient for single-user background jobs |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIN-01..04 | v1.0 Phase 6 | Complete |
| TRANS-01..04 | v1.0 Phase 6 | In Progress |
| PREC-01..04 | v1.0 Phase 5 | Complete |
| NEW-01..04 | v1.0 Phase 6 | In Progress |
| RENDER-01..04 | v1.0 Phase A | Complete |
| DOCK-01 | v1.1 Phase TBD | Pending |
| DOCK-02 | v1.1 Phase TBD | Pending |
| DOCK-03 | v1.1 Phase TBD | Pending |
| DOCK-04 | v1.1 Phase TBD | Pending |
| CONF-01 | v1.1 Phase TBD | Pending |
| CONF-02 | v1.1 Phase TBD | Pending |
| CONF-03 | v1.1 Phase TBD | Pending |
| CONF-04 | v1.1 Phase TBD | Pending |
| PROX-01 | v1.1 Phase TBD | Pending |
| PROX-02 | v1.1 Phase TBD | Pending |
| SESS-01 | v1.1 Phase TBD | Pending |
| SESS-02 | v1.1 Phase TBD | Pending |
| RAIL-01 | v1.1 Phase TBD | Pending |
| RAIL-02 | v1.1 Phase TBD | Pending |
| RAIL-03 | v1.1 Phase TBD | Pending |
| ASYNC-01 | v1.1 Phase TBD | Pending |
| ASYNC-02 | v1.1 Phase TBD | Pending |

**Coverage:**
- v1.0 requirements: 20 total (12 complete, 8 in progress)
- v1.1 requirements: 15 total
- Unmapped: 15 (awaiting roadmap)

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-11 after v1.1 milestone requirements*
