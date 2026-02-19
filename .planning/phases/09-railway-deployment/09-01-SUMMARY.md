---
phase: 09-railway-deployment
plan: "01"
subsystem: database
tags: [postgresql, sqlalchemy, flask-migrate, alembic, sqlite, session-persistence]

# Dependency graph
requires: []
provides:
  - SQLAlchemy db and Migrate instances initialized in app/models/__init__.py
  - SessionRecord model with metadata-only columns (no blobs per DB-03)
  - 3-tier session lookup: memory -> disk JSON -> DB metadata row
  - DB upsert on every save_session() call
  - GET /api/sessions endpoint listing sessions from PostgreSQL
  - Initial Alembic migration creating sessions table
  - flask db upgrade workflow (SQLite dev, PostgreSQL prod via DATABASE_URL)
affects: [10-frontend-auth, 11-jwt-middleware, 12-session-management, 13-deployment]

# Tech tracking
tech-stack:
  added:
    - flask-sqlalchemy>=3.0.0
    - flask-migrate>=4.0.0
    - psycopg2-binary>=2.9.0
  patterns:
    - SQLAlchemy 2.x Mapped[]/mapped_column() style for model definitions
    - DeclarativeBase subclass as model_class for SQLAlchemy()
    - db/migrate init_app() pattern in create_app() factory
    - Lazy DB imports inside function bodies to avoid circular imports during blueprint registration
    - 3-tier session lookup (memory -> disk -> DB) with graceful degradation
    - DB upsert wrapped in try/except for dev resilience

key-files:
  created:
    - app/models/session.py
    - migrations/versions/dbe622ee26fb_initial_session_table.py
    - migrations/alembic.ini
    - migrations/env.py
    - migrations/script.py.mako
    - migrations/README
  modified:
    - app/models/__init__.py
    - app/server.py
    - requirements.txt
    - app/api/routes.py

key-decisions:
  - "SessionRecord stores only metadata paths (not blob content) per DB-03 architecture decision"
  - "DB upsert uses try/except for graceful degradation — disk write is primary, DB is secondary"
  - "get_session() returns None from DB tier if parsed_doc cannot be restored — clean 404 safer than broken session"
  - "load_test_session() now uses save_session() so test sessions also persist to DB"
  - "list_sessions() queries DB (not in-memory dict) to survive server restarts"

patterns-established:
  - "Circular import avoidance: from .session import SessionRecord as last line in __init__.py after db assigned"
  - "Lazy DB imports in route functions (not module level) to avoid blueprint registration timing issues"
  - "3-tier read, 3-tier write pattern for session data throughout routes.py"

requirements-completed: [DB-01, DB-02, DB-03, DB-04]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 09 Plan 01: PostgreSQL Session Persistence Summary

**Flask-SQLAlchemy + SessionRecord model with 3-tier persistence (memory/disk/DB), Alembic migrations, and DB-backed session listing via GET /api/sessions**

## Performance

- **Duration:** ~5 min (Task 1 was pre-built; Task 2 implemented and verified in this run)
- **Started:** 2026-02-19T16:30:49Z
- **Completed:** 2026-02-19T16:35:00Z
- **Tasks:** 2
- **Files modified:** 8 (including 6 migration files created)

## Accomplishments
- SQLAlchemy db/migrate instances added to app/models/__init__.py without breaking existing ConceptMap/RiskMap exports
- SessionRecord model with 15 metadata-only columns (no blobs per DB-03); large files remain on filesystem
- 3-tier session persistence: save_session() writes to memory + disk + DB; get_session() reads memory -> disk -> DB
- Initial Alembic migration generated and applied; flask db upgrade creates sessions table cleanly
- GET /api/sessions now returns DB-persisted sessions ordered by updated_at desc (survives server restart)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SQLAlchemy/Migrate to models and server** - `89a867e` (feat)
2. **Task 2: Update get_session() and save_session() with DB persistence** - `9e03f4e` (feat)

**Plan metadata:** (committed with SUMMARY.md)

## Files Created/Modified
- `app/models/__init__.py` - Added db, migrate, Base; SessionRecord imported last to avoid circular import
- `app/models/session.py` - New SessionRecord SQLAlchemy model (metadata-only, SQLAlchemy 2.x style)
- `app/server.py` - Added SQLALCHEMY_DATABASE_URI config + db.init_app()/migrate.init_app()
- `requirements.txt` - Added flask-sqlalchemy, flask-migrate, psycopg2-binary
- `app/api/routes.py` - 3-tier get_session(), DB-upsert save_session(), DB-backed list_sessions()
- `migrations/` - Alembic directory with initial migration (dbe622ee26fb)

## Decisions Made
- DB upsert in save_session() is wrapped in try/except — disk write is primary, DB is secondary; this avoids crashing during dev if DB is misconfigured
- get_session() returns None from DB tier if parsed_doc cannot be restored (clean 404 is safer than a broken session)
- load_test_session() updated to use save_session() so test sessions persist to DB alongside real sessions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated load_test_session() to use save_session()**
- **Found during:** Task 2 (reviewing routes.py for all session write sites)
- **Issue:** load_test_session() directly assigned `sessions[session_id] = session`, bypassing save_session() and therefore never writing a DB row; test sessions would not appear in GET /api/sessions
- **Fix:** Replaced direct dict assignment with save_session() call; added parsed_doc_path field to session dict for correct serialization
- **Files modified:** app/api/routes.py
- **Verification:** GET /api/sessions returns test sessions after load_test_session() call
- **Committed in:** 9e03f4e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical write path)
**Impact on plan:** Necessary for consistency; no scope creep.

## Issues Encountered
- Task 1 was already completed before this execution run (models, migrations, server config were pre-built). Verified all artifacts and committed them, then proceeded to Task 2.

## User Setup Required
None - uses SQLite in dev (auto-created at instance/dev.db). PostgreSQL configured via DATABASE_URL env var on Railway.

## Next Phase Readiness
- DB foundation complete; Phase 10 (frontend auth) and Phase 11 (JWT middleware) can proceed in parallel
- Phase 12 (session management UI) can consume GET /api/sessions immediately
- For Railway deployment: set DATABASE_URL to PostgreSQL connection string; run `flask db upgrade` on first deploy

---
*Phase: 09-railway-deployment*
*Completed: 2026-02-19*
