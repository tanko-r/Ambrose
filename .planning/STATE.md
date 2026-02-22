# Project State

**Project:** Ambrose (Contract Redlining)
**Branch:** deployment-refactor
**Last Updated:** 2026-02-22

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Analyze contracts intelligently and generate precise, surgical redlines
**Current focus:** v1.1 Users and Deployment — Phase 12 complete, advancing to Phase 13 (Containerization + Railway)

## Current Milestone

**v1.1 -- Users and Deployment**

Phase: 12 (Workspace Isolation + Storage Config) — Complete
Plan: 12-02 complete (trash system: soft-delete endpoints, auto-purge, frontend dialog + trash list) — human-verified
Status: Phase 12 fully complete (Phase 9+10+11+12-01+12-02 done + human verification approved)
Last activity: 2026-02-22 — Phase 12 complete (workspace isolation + trash system human-verified)

Progress: [████████░░] 80% (v1.1)

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
| 5 | Precedent Split View | Complete | 100% |
| 6 | Dialogs + Finalization | Complete | 100% |
| 7 | Polish + Validation | Complete | 100% |
| 8 | Cleanup + Cutover | Complete | 100% |
| 8.1 | Documentation Sync + Verification | In Progress | 67% |

## Accumulated Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| v1.1 | Clerk over Auth0/WorkOS | Best Next.js integration, functional Python SDK, free tier for dev, built-in org model |
| v1.1 | PyJWT + PyJWKClient over Clerk Python SDK | More reliable for Flask JWT verification; RS256 with JWKS caching |
| v1.1 | Flask-SQLAlchemy + Flask-Migrate | Official Pallets stack, Alembic under the hood, Flask CLI integration |
| v1.1 | psycopg2-binary (not psycopg3) | Synchronous Flask; psycopg3 async advantages don't apply; pre-built Docker wheels |
| v1.1 | PostgreSQL metadata + Railway Volume blobs | Lightweight structured data in DB; large JSON/DOCX on filesystem |
| v1.1 | Blueprint-level before_request for JWT | One place protects all 30+ endpoints; explicit PUBLIC_ROUTES allowlist |
| v1.1 | Phases 9+10 parallel, then 11→12→13 | DB and frontend auth are independent; middleware needs both; isolation needs all |
| v1.1 | Railway Volume (not Buckets) for files | Simpler (no boto3); S3-compatible Buckets deferred until scaling needed |
| v1.1 | Gunicorn gthread (not gevent) | asyncio.run() conflicts with gevent monkey-patching |
| 09-02 | threading.Thread (not Celery/RQ) | No extra infrastructure at this scale; GIL provides adequate dict protection |
| 09-02 | Regex fallback runs in background thread | Preserves degraded-quality result path; user gets something rather than nothing on LLM failure |
| 09-02 | _build_concept_and_risk_maps() extracted | Eliminates code duplication between sync (old) and async (new) analysis paths |
| 8 | Archive old frontend to _archived/ (not delete) | Preserves history for reference |
| 7 | next-themes with attribute=class, defaultTheme=system | Standard pattern for Tailwind CSS dark mode |
| 12-01 | Return 404 (not 403) on ownership mismatch | Avoids leaking session existence to unauthorized callers |
| 12-01 | Legacy sessions (user_id=None) accessible to all | Backwards compatibility for pre-Phase-12 sessions |
| 12-02 | DELETE /session/{id} converted to soft-delete (trash) | Reuses existing route; avoids API breakage; legal docs are hard to recreate |
| 12-02 | restore_session queries DB directly (not get_session) | get_session filters out trashed sessions; direct query needed for restore |
| 12-02 | Startup purge wrapped in try/except | Handles first-run before flask db upgrade without crashing |

### Blockers/Concerns

- ~~**Phase 11 (PyJWT + Clerk JWKS):** Validate azp claim; specify RS256 not HS256; cache PyJWKClient at module load.~~ **RESOLVED by 11-01 (azp validation deferred as optional; RS256 enforced; singleton cached)**
- ~~**Phase 12 (get_session refactor):** Touches all 30+ call sites in routes.py — code review every call site after change.~~ **RESOLVED by 12-01 (all 24 route-level call sites updated; 2 background thread calls kept bare)**
- ~~**Railway HTTP timeout:** Confirmed hard 5-minute limit at network layer; Phase 9 async fix is an absolute deploy blocker.~~ **RESOLVED by 09-02**

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 7 | Implement Tier 2 UI refinements from ui-refinements.md (items 1-14) | 2026-02-16 | 58171d1 |
| 8 | Breadcrumb bar with back/forward history + Risk Report print overlay | 2026-02-18 | 86ed7bd, c98751c |

## Session Continuity

Last session: 2026-02-22
Last activity: 2026-02-22 — Phase 12 fully complete (human verification approved); ready to start Phase 13
Resume file: None

---
*State updated: 2026-02-22*
