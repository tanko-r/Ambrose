# Phase 9: Database + Async Analysis - Research

**Researched:** 2026-02-18
**Domain:** Flask-SQLAlchemy + Flask-Migrate (PostgreSQL), Python background threading, Railway persistent volumes
**Confidence:** HIGH (stack decisions are locked and well-researched; async threading pattern is MEDIUM due to in-process trade-offs)

---

## Summary

Phase 9 adds two independent capabilities: (1) PostgreSQL persistence via Flask-SQLAlchemy + Flask-Migrate so session metadata survives server restarts, and (2) async analysis so Railway's 15-minute HTTP timeout cannot kill a long-running document analysis job.

The existing code already saves session data to disk JSON files and loads from disk on cache miss (`get_session()` reads `SESSION_FOLDER/{id}.json`). What DB-01 through DB-04 add is a structured PostgreSQL table of session metadata so listing/querying sessions is fast and survives restarts without scanning the filesystem. Large blobs (parsed JSON, docx files) stay on the Railway Volume filesystem per DB-03 — this is already the pattern in routes.py (`parsed_doc_path`, `target_path`).

The async pattern (ASYNC-01/ASYNC-02) is simpler than it looks: `GET /api/analysis/<session_id>` currently calls `analyze_document_with_llm()` synchronously and blocks for 5–30 minutes. The fix is to make a new `POST /api/analysis/<session_id>/start` endpoint that spawns a `threading.Thread`, returns a `job_id` immediately (HTTP 202), and lets the existing `/api/analysis/<session_id>/progress` endpoint serve as the poll target. No Redis, no Celery — in-process threads suffice because the analysis progress dict (`analysis_progress`) already exists in `claude_service.py` as a thread-safe in-memory structure.

**Primary recommendation:** Use Flask-SQLAlchemy 3.x (DeclarativeBase pattern) + Flask-Migrate for schema management. Use `threading.Thread` with `app.app_context()` for async analysis. Store job state in the existing in-memory `analysis_progress` dict. Do NOT add Redis or Celery — the existing architecture does not need them.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | PostgreSQL stores user accounts and session metadata | Flask-SQLAlchemy model with session metadata columns; `SQLALCHEMY_DATABASE_URI` from `DATABASE_URL` env var; Railway provides `DATABASE_URL` automatically for attached Postgres service |
| DB-02 | Session metadata persists across server restarts | SQLAlchemy model row written at `save_session()` time; `get_session()` falls back to DB query if not in memory cache; large blobs still on filesystem |
| DB-03 | Large analysis/document blobs stored on filesystem, not in database | Already implemented: `parsed_doc_path`, `target_path` stored as paths; analysis JSON stored as filesystem files; DB only stores string metadata |
| DB-04 | Database schema managed via migrations (Flask-Migrate/Alembic) | `flask db init` → `flask db migrate` → `flask db upgrade`; `migrations/` folder committed to git; Railway runs `flask db upgrade` in Dockerfile or release command |
| ASYNC-01 | Analysis endpoints return immediately with job ID | New `POST /api/analysis/<session_id>/start` returns `{"job_id": "<uuid>", "status": "started"}` with HTTP 202; thread spawned immediately |
| ASYNC-02 | Analysis runs in background thread with progress polling via existing UI | `threading.Thread(target=_run_analysis, args=(app, session_id, job_id), daemon=True).start()`; progress tracked in existing `analysis_progress` dict; existing `/progress` endpoint polls it |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| flask-sqlalchemy | >=3.0.0 | ORM integration with Flask | Official Pallets extension; handles session scoping per request automatically |
| flask-migrate | >=4.0.0 | Alembic-backed schema migrations via Flask CLI | Official Pallets extension; `flask db` commands; integrates with app factory |
| psycopg2-binary | >=2.9.0 | PostgreSQL driver | Pre-built wheels (no gcc needed in Docker); synchronous Flask doesn't benefit from psycopg3 async |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | >=0.19.0 | Load `DATABASE_URL` from `.env` locally | Already in requirements.txt; needed locally; Railway injects env vars natively |
| threading (stdlib) | built-in | Background analysis thread | Already used in `claude_service.py` for progress tracking; no new dependency needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| threading.Thread | Celery + Redis | Celery is correct for high-scale, but adds 2 new infra services (Redis, Celery worker container). Current scale (single user) doesn't justify it. Threading works with gthread gunicorn. |
| threading.Thread | Flask-RQ2 + Redis | Same trade-off as Celery. Simpler than Celery but still requires Redis. Overkill here. |
| Flask-SQLAlchemy | Raw SQLAlchemy | Flask-SQLAlchemy handles session-per-request scoping automatically; no reason to skip it |
| psycopg2-binary | psycopg3 (psycopg) | psycopg3's async advantages don't apply to synchronous Flask + gunicorn gthread; pre-built binary wheels simpler in Docker |
| PostgreSQL metadata + filesystem blobs | Store everything in DB | Large JSON blobs in DB are slow to query and wasteful; existing filesystem pattern (DB-03) is correct |

**Installation:**
```bash
pip install flask-sqlalchemy flask-migrate psycopg2-binary
```

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── models/
│   ├── __init__.py       # exports db, SessionRecord
│   └── session.py        # SessionRecord SQLAlchemy model
├── server.py             # create_app() — init db, migrate here
├── api/
│   └── routes.py         # update get_session(), save_session(), add start-analysis endpoint
└── services/
    └── claude_service.py # existing — no changes needed to threading primitives
migrations/               # generated by flask db init — commit to git
```

### Pattern 1: Flask-SQLAlchemy App Factory Integration

**What:** Initialize `db` and `migrate` at module level (not bound to app), then call `init_app()` inside `create_app()`. This is the standard pattern for the factory pattern.

**When to use:** Always — this is the only correct pattern with Flask app factories.

**Example:**
```python
# app/models/__init__.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
migrate = Migrate()
```

```python
# app/server.py  (inside create_app())
from app.models import db, migrate

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///dev.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    migrate.init_app(app, db)
    ...
    return app
```

**Railway note:** Railway injects `DATABASE_URL` as `postgresql://...` (psycopg2-compatible). SQLAlchemy accepts `postgresql://` as the psycopg2 driver. No scheme rewriting needed.

### Pattern 2: SessionRecord Model (DB-01 / DB-02)

**What:** A SQLAlchemy model storing only structured metadata. Large blobs stay on filesystem (DB-03 compliance).

**When to use:** Write a row at `save_session()` time; read it at `get_session()` cache-miss time.

```python
# app/models/session.py
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models import db

class SessionRecord(db.Model):
    __tablename__ = 'sessions'

    session_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(50), default='initialized')
    contract_type: Mapped[str] = mapped_column(String(50), nullable=True)
    representation: Mapped[str] = mapped_column(String(50), nullable=True)
    approach: Mapped[str] = mapped_column(String(50), nullable=True)
    aggressiveness: Mapped[int] = mapped_column(Integer, nullable=True)
    target_filename: Mapped[str] = mapped_column(String(255), nullable=True)
    # Filesystem paths only — never store doc/analysis blobs in DB (DB-03)
    target_path: Mapped[str] = mapped_column(Text, nullable=True)
    parsed_doc_path: Mapped[str] = mapped_column(Text, nullable=True)
    precedent_path: Mapped[str] = mapped_column(Text, nullable=True)
    # Counters (fast queries without loading JSON)
    revisions_count: Mapped[int] = mapped_column(Integer, default=0)
    flags_count: Mapped[int] = mapped_column(Integer, default=0)
    is_test_session: Mapped[bool] = mapped_column(default=False)
```

**Key design decision:** `deal_context`, `analysis`, `revisions`, `flags` are NOT stored in DB — they stay in the session JSON file on the filesystem. The DB row is only for listing, searching, and metadata retrieval.

### Pattern 3: Background Thread with App Context (ASYNC-01 / ASYNC-02)

**What:** Spawn a `threading.Thread` from a Flask endpoint, passing the actual `app` object (not the `current_app` proxy). Push `app_context()` inside the thread.

**When to use:** Any Flask background task that needs `current_app`, config, or db access from a non-request thread.

**Critical:** The `current_app` proxy is thread-local and will raise `RuntimeError: Working outside of application context` in a background thread. You must pass the real app object and push the context manually.

```python
# routes.py — new endpoint
import threading
import uuid

# In-process job registry (complements existing analysis_progress dict)
_jobs = {}  # job_id -> {'session_id': ..., 'status': 'running'|'complete'|'failed'}
_jobs_lock = threading.Lock()

@api_bp.route('/analysis/<session_id>/start', methods=['POST'])
def start_analysis(session_id):
    """Start analysis as background job. Returns immediately with job_id."""
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Don't re-run if already complete
    if session.get('analysis'):
        return jsonify({'status': 'already_complete', 'session_id': session_id}), 200

    job_id = str(uuid.uuid4())
    app = current_app._get_current_object()  # real app, not proxy

    def _run(app, session_id, job_id):
        with app.app_context():
            from app.services.claude_service import analyze_document_with_llm, clear_progress
            try:
                with _jobs_lock:
                    _jobs[job_id] = {'session_id': session_id, 'status': 'running'}
                # ... call analyze_document_with_llm, save session ...
                with _jobs_lock:
                    _jobs[job_id]['status'] = 'complete'
            except Exception as e:
                with _jobs_lock:
                    _jobs[job_id] = {'session_id': session_id, 'status': 'failed', 'error': str(e)}

    t = threading.Thread(target=_run, args=(app, session_id, job_id), daemon=True)
    t.start()

    return jsonify({'job_id': job_id, 'status': 'started', 'session_id': session_id}), 202
```

**The existing `/api/analysis/<session_id>/progress` endpoint already serves as the poll target.** The frontend already polls it. No new UI changes needed for ASYNC-02 — the progress dict in `claude_service.py` is already being written from within the analysis functions, so it will work identically whether the analysis runs synchronously in a request thread or in a background thread.

### Pattern 4: Migration Workflow (DB-04)

**One-time setup (developer machine, run once):**
```bash
flask db init                    # creates migrations/ directory
flask db migrate -m "initial"    # generates first migration
flask db upgrade                 # applies to local/dev DB
```

**On schema change:**
```bash
flask db migrate -m "add column X"
flask db upgrade
git add migrations/
git commit -m "migration: add column X"
```

**Railway production (in Dockerfile or release command):**
```dockerfile
# Option A: In Dockerfile CMD (simple, runs on every deploy)
CMD ["sh", "-c", "flask db upgrade && gunicorn ..."]

# Option B: Railway release command (preferred — separate from serve)
# In railway.toml:
# [deploy]
# releaseCommand = "flask db upgrade"
```

**Important:** The `migrations/` folder MUST be committed to git. Railway does not have a build-time database connection, so `flask db upgrade` must run at release/startup time, not build time.

### Anti-Patterns to Avoid

- **Storing large blobs in PostgreSQL:** Never store `parsed_doc`, `analysis`, `revisions` JSON in DB columns. These are 50KB–2MB JSON objects. Store paths, store in filesystem files. DB rows are for metadata only (DB-03).
- **Using `current_app` proxy in background thread:** Will raise `RuntimeError`. Always use `current_app._get_current_object()` before spawning thread, then pass the real app.
- **Running `flask db upgrade` at build time:** Docker build has no DB access. Must run at container startup or as Railway release command.
- **Using `ThreadPoolExecutor.submit()` without lifecycle management:** Gunicorn gthread workers can theoretically be recycled. `daemon=True` threads die with the worker, which is acceptable here (analysis would restart on next poll). A named thread dict (`_jobs`) lets us detect stale jobs.
- **Railway `DATABASE_URL` scheme:** Railway provides `postgresql://user:pass@host/db`. SQLAlchemy 2.x accepts this directly for psycopg2. No `postgresql+psycopg2://` rewrite needed (psycopg2 is the default for `postgresql://`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migrations | Manual ALTER TABLE scripts | Flask-Migrate (Alembic) | Handles dependency ordering, rollbacks, autogenerate from models |
| DB session scoping per request | Manual session.close() calls | Flask-SQLAlchemy | Automatically scopes and cleans up sessions per request |
| Background job status | Custom Redis integration | In-memory dict + threading | Simpler; existing `analysis_progress` dict already works this way; Redis would add infra cost |
| PostgreSQL connection string parsing | Manual URL construction | SQLAlchemy URL / env var passthrough | Railway provides a standard `DATABASE_URL`; just use it |

**Key insight:** The existing threading infrastructure in `claude_service.py` (thread locks, progress dict, partial results) is already production-quality. The async fix is a routing change, not a service rewrite.

---

## Common Pitfalls

### Pitfall 1: `current_app` in Background Thread
**What goes wrong:** `RuntimeError: Working outside of application context`
**Why it happens:** Flask's `current_app` is a thread-local proxy — it points to the app that pushed the context for the current thread. Background threads have no pushed context.
**How to avoid:** Before spawning the thread, call `app = current_app._get_current_object()`. Inside the thread function, wrap everything in `with app.app_context():`.
**Warning signs:** Error appears at the first access of `current_app`, `g`, or any Flask extension inside the thread.

### Pitfall 2: Railway Volume Permissions
**What goes wrong:** `PermissionError` when Flask tries to write to `/data/uploads` or `/data/sessions`
**Why it happens:** Railway Docker images run as non-root by default; volume mount points may have restricted permissions.
**How to avoid:** Set `RAILWAY_RUN_UID=0` environment variable in Railway service settings, OR use `RUN chown -R appuser:appuser /data` in Dockerfile after `RUN mkdir -p /data`.
**Warning signs:** FileNotFoundError or PermissionError on first file write after deploy.

### Pitfall 3: `flask db upgrade` Runs at Build Time (No DB Access)
**What goes wrong:** Migration fails during Docker build because there's no PostgreSQL connection.
**Why it happens:** `DATABASE_URL` is a Railway runtime env var, not available during `docker build`.
**How to avoid:** Never put `flask db upgrade` in `RUN` Dockerfile instructions. Put it in `CMD` (as a shell command before gunicorn) or Railway's `releaseCommand` in `railway.toml`.
**Warning signs:** Build log shows `could not connect to server: Connection refused`.

### Pitfall 4: SESSION_FOLDER Path Not Writable on Railway Volume
**What goes wrong:** Sessions saved to filesystem but Railway ephemeral storage loses them on redeploy; OR volume is attached but path doesn't match `DATA_DIR`.
**Why it happens:** If `DATA_DIR` env var is not set, `server.py` defaults to `app/data/` inside the Docker image (ephemeral). Volume must be mounted at exactly the same path as `DATA_DIR`.
**How to avoid:** Set `DATA_DIR=/data` on Railway AND mount volume at `/data`. The existing Task 3 from `9-PLAN.md` already addresses this.
**Warning signs:** Sessions work during a session but disappear after redeploy.

### Pitfall 5: Alembic Autogenerate Missing Changes
**What goes wrong:** `flask db migrate` generates an empty migration even though you added columns.
**Why it happens:** Alembic can't detect: table renames, column renames, constraint changes on SQLite, custom types.
**How to avoid:** Review every generated migration script before `flask db upgrade`. Add missing operations manually if needed.
**Warning signs:** Migration file says `pass` in `upgrade()` function.

### Pitfall 6: `daemon=True` Thread Killed Before Completion
**What goes wrong:** Analysis background thread is killed when gunicorn worker recycles.
**Why it happens:** `daemon=True` threads die with their parent thread. Gunicorn workers may be recycled on timeout or signal.
**How to avoid:** This is acceptable for the current use case — if a worker is killed, the analysis job status becomes `stale` and the UI will show it as stuck. With gunicorn's `--timeout 1800` (30 min), recycling during an analysis is unlikely. Mitigation: the progress endpoint can detect a stale job (no progress updates for > 60s) and surface an error to the UI.
**Warning signs:** Analysis progress stops updating but job never completes.

---

## Code Examples

Verified patterns from official sources and the existing codebase:

### Flask-SQLAlchemy + Flask-Migrate App Factory Setup

```python
# app/models/__init__.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
migrate = Migrate()

# app/server.py
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL',
        'sqlite:///dev.db'  # fallback for local dev without Postgres
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    migrate.init_app(app, db)
    # ... rest of factory
    return app
```
Source: [Flask-SQLAlchemy Quickstart](https://flask-sqlalchemy.readthedocs.io/en/stable/quickstart/), [Flask-Migrate Docs](https://flask-migrate.readthedocs.io/)

### Updated `save_session()` — Write DB Row

```python
def save_session(session_id, data):
    """Save session data to in-memory cache, disk file, and DB metadata row."""
    sessions[session_id] = data

    # 1. Persist to disk (existing behavior)
    session_path = current_app.config['SESSION_FOLDER'] / f'{session_id}.json'
    serializable = {k: v for k, v in data.items() if k not in ('parsed_doc', 'parsed_precedent')}
    if 'parsed_doc' in data:
        serializable['parsed_doc_path'] = str(data.get('parsed_doc_path', ''))
    with open(session_path, 'w', encoding='utf-8') as f:
        json.dump(serializable, f, indent=2, default=str)

    # 2. Upsert DB metadata row (new)
    from app.models import db
    from app.models.session import SessionRecord
    record = db.session.get(SessionRecord, session_id)
    if record is None:
        record = SessionRecord(session_id=session_id)
        db.session.add(record)
    record.status = data.get('status', 'initialized')
    record.contract_type = data.get('contract_type')
    record.representation = data.get('representation')
    record.approach = data.get('approach')
    record.aggressiveness = data.get('aggressiveness')
    record.target_filename = data.get('target_filename')
    record.target_path = data.get('target_path')
    record.parsed_doc_path = str(data.get('parsed_doc_path', ''))
    record.precedent_path = data.get('precedent_path')
    record.revisions_count = len(data.get('revisions', {}))
    record.flags_count = len(data.get('flags', []))
    record.is_test_session = data.get('is_test_session', False)
    db.session.commit()
```

### Updated `get_session()` — Load from DB on Cache Miss

```python
def get_session(session_id):
    """Get session data, auto-loading from disk if not in memory."""
    if session_id in sessions:
        return sessions[session_id]

    # Try loading from disk (existing behavior)
    session_path = current_app.config['SESSION_FOLDER'] / f'{session_id}.json'
    if session_path.exists():
        with open(session_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Restore parsed_doc from saved path
        parsed_doc_path = data.get('parsed_doc_path')
        if parsed_doc_path:
            p = Path(_normalize_path(parsed_doc_path))
            if p.exists():
                with open(p, 'r', encoding='utf-8') as f:
                    data['parsed_doc'] = json.load(f)
        sessions[session_id] = data
        return data

    # Fall back to DB lookup (new — needed when filesystem and memory both miss)
    from app.models import db
    from app.models.session import SessionRecord
    record = db.session.get(SessionRecord, session_id)
    if record is None:
        return None

    # Rebuild session dict from DB metadata + filesystem files
    data = {
        'session_id': record.session_id,
        'created_at': record.created_at.isoformat() if record.created_at else None,
        'status': record.status,
        'contract_type': record.contract_type,
        'representation': record.representation,
        'approach': record.approach,
        'aggressiveness': record.aggressiveness,
        'target_filename': record.target_filename,
        'target_path': record.target_path,
        'parsed_doc_path': record.parsed_doc_path,
        'precedent_path': record.precedent_path,
        'revisions': {},
        'flags': [],
    }
    # Load parsed_doc from filesystem path recorded in DB
    if record.parsed_doc_path:
        p = Path(_normalize_path(record.parsed_doc_path))
        if p.exists():
            with open(p, 'r', encoding='utf-8') as f:
                data['parsed_doc'] = json.load(f)
    # Try to load full session JSON from disk if it exists
    session_path = current_app.config['SESSION_FOLDER'] / f'{session_id}.json'
    if session_path.exists():
        with open(session_path, 'r', encoding='utf-8') as f:
            disk_data = json.load(f)
        data.update({k: v for k, v in disk_data.items() if k not in ('parsed_doc',)})

    sessions[session_id] = data
    return data
```

### Async Analysis: New Start Endpoint

```python
# In-process job tracker (in routes.py or a new jobs.py)
import threading as _threading
_analysis_jobs = {}
_analysis_jobs_lock = _threading.Lock()

@api_bp.route('/analysis/<session_id>/start', methods=['POST'])
def start_analysis(session_id):
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if session.get('analysis'):
        return jsonify({'status': 'already_complete', 'session_id': session_id}), 200

    job_id = str(uuid.uuid4())
    # Get the real app object BEFORE spawning thread
    app = current_app._get_current_object()

    def _run_analysis(app, session_id, job_id):
        with app.app_context():
            from app.services.claude_service import analyze_document_with_llm, clear_progress
            from app.models import ConceptMap, RiskMap
            try:
                with _analysis_jobs_lock:
                    _analysis_jobs[job_id] = {'status': 'running', 'session_id': session_id}

                analysis = analyze_document_with_llm(
                    parsed_doc=session.get('parsed_doc'),
                    contract_type=session.get('contract_type', 'general'),
                    representation=session.get('representation', 'seller'),
                    aggressiveness=session.get('aggressiveness', 3),
                    batch_size=5,
                    session_id=session_id,
                    include_exhibits=session.get('include_exhibits', False)
                )
                clear_progress(session_id)
                # ... build ConceptMap, RiskMap, save session (same as synchronous path) ...
                with _analysis_jobs_lock:
                    _analysis_jobs[job_id]['status'] = 'complete'
            except Exception as e:
                clear_progress(session_id)
                with _analysis_jobs_lock:
                    _analysis_jobs[job_id] = {'status': 'failed', 'error': str(e), 'session_id': session_id}

    t = _threading.Thread(target=_run_analysis, args=(app, session_id, job_id), daemon=True)
    t.start()

    return jsonify({'job_id': job_id, 'status': 'started', 'session_id': session_id}), 202


@api_bp.route('/analysis/jobs/<job_id>', methods=['GET'])
def get_job_status(job_id):
    with _analysis_jobs_lock:
        job = _analysis_jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)
```

### Dockerfile: `flask db upgrade` at Startup

```dockerfile
# Backend Dockerfile CMD — run migrations then start server
CMD ["sh", "-c", "flask db upgrade && gunicorn --bind 0.0.0.0:5000 --timeout 1800 --workers 1 --threads 4 --worker-class gthread 'app.server:create_app()'"]
```

OR in `railway.toml`:
```toml
[deploy]
releaseCommand = "flask db upgrade"
startCommand = "gunicorn --bind 0.0.0.0:5000 --timeout 1800 --workers 1 --threads 4 --worker-class gthread 'app.server:create_app()'"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flask-SQLAlchemy `db.Column()` style | `Mapped[type] = mapped_column()` typed annotations | Flask-SQLAlchemy 3.0 / SQLAlchemy 2.0 (2023) | Type-safe, IDE-friendly; old style still works but is legacy |
| `db = SQLAlchemy(app)` direct init | `db.init_app(app)` factory pattern | Long-standing best practice | Required for app factories |
| `flask db` commands from `flask_script` | `flask db` from Flask CLI | Flask 1.x → 2.x migration | Modern Flask CLI is the standard; no `manage.py` needed |

**Deprecated/outdated:**
- `flask_migrate.MigrateCommand` with Flask-Script: Replaced by native Flask CLI. Do not use.
- `db.Column(db.Integer)` without `Mapped[]`: Still works but SQLAlchemy 2.x style is preferred.
- `current_app` passed to thread directly (without `_get_current_object()`): Will fail — proxy is thread-local.

---

## Open Questions

1. **Frontend async analysis trigger**
   - What we know: The existing frontend calls `GET /api/analysis/<session_id>` which currently blocks. The existing `/progress` endpoint is already polled by the UI.
   - What's unclear: Does the frontend need to switch to `POST /api/analysis/<session_id>/start` then poll `/progress`, or should the old `GET` endpoint be kept but made to start a thread and return 202?
   - Recommendation: Add the new `POST /start` endpoint. Keep the old `GET /analysis/<session_id>` working (it checks if already complete). Frontend should switch to POST+poll. This is a minimal change to the existing polling UI.

2. **DB migration for existing sessions**
   - What we know: Existing sessions are stored as JSON files on disk. The `SessionRecord` table doesn't exist yet.
   - What's unclear: Should Phase 9 backfill existing sessions into the DB on first startup?
   - Recommendation: No backfill needed. Existing sessions will be loaded from disk via the `get_session()` fallback. They'll be written to DB the next time `save_session()` is called (e.g., after a revision). This is the zero-migration-pain path.

3. **Railway private vs. public DATABASE_URL**
   - What we know: Railway provides both `DATABASE_URL` (private, `postgres.railway.internal`) and `DATABASE_PUBLIC_URL` (TCP proxy). Services within the same Railway project should use the private URL for speed and security.
   - What's unclear: Whether the Railway FLASK service can reach the Railway Postgres service via the private domain during startup (before the service is fully healthy).
   - Recommendation: Use `DATABASE_URL` (private) for the backend service. The private network is available as soon as the service starts.

---

## Sources

### Primary (HIGH confidence)
- [Flask-Migrate Official Docs](https://flask-migrate.readthedocs.io/) — CLI commands, setup, app factory pattern
- [Flask-SQLAlchemy Quickstart](https://flask-sqlalchemy.readthedocs.io/en/stable/quickstart/) — `init_app()` pattern, DeclarativeBase
- [Flask-SQLAlchemy Models](https://flask-sqlalchemy.palletsprojects.com/en/stable/models/) — `Mapped[]` column definition style
- [Railway Specs & Limits](https://docs.railway.com/networking/public-networking/specs-and-limits) — 15-minute HTTP timeout confirmed
- [Railway Volumes Docs](https://docs.railway.com/reference/volumes) — single volume per service, RAILWAY_RUN_UID=0 for permissions
- Existing codebase: `app/services/claude_service.py` — confirms `threading.Lock()`, progress dict pattern already in use
- Existing codebase: `app/api/routes.py` lines 53–70 — confirms disk-based session persistence already partially implemented

### Secondary (MEDIUM confidence)
- [Neon Flask Migration Guide](https://neon.com/guides/flask-database-migrations) — verified against Flask-Migrate official docs; migration command sequence confirmed
- [Railway PostgreSQL Docs](https://docs.railway.com/databases/postgresql) — `DATABASE_URL` env var confirmed available
- [Flask App Context Discussion (GitHub)](https://github.com/pallets/flask/discussions/5505) — confirms `current_app._get_current_object()` pattern needed for threads
- Railway Help Station — HTTP timeout discussions confirm 15-minute hard limit at network layer

### Tertiary (LOW confidence — needs validation)
- Medium article on Flask concurrency trap — general warning about threading at scale (not applicable at current single-user scale)
- Gunicorn gthread + ThreadPoolExecutor issue thread — confirms `daemon=True` thread lifecycle concern with gthread workers

---

## Metadata

**Confidence breakdown:**
- Standard stack (Flask-SQLAlchemy + Flask-Migrate + psycopg2-binary): HIGH — Official Pallets stack, confirmed in Railway context
- Architecture (DB schema design, get/save_session changes): HIGH — Derived directly from existing code structure
- Async threading pattern: MEDIUM — Pattern is well-understood but in-process threads have known trade-offs at scale. Acceptable for single-user/low-concurrency app.
- Railway-specific (volume permissions, DATABASE_URL): MEDIUM — Railway docs confirmed; RAILWAY_RUN_UID=0 tip from docs, not tested by us

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable technologies; Railway pricing/limits may change faster)
