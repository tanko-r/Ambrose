# Phase 12: Workspace Isolation + Storage Config - Research

**Researched:** 2026-02-21
**Domain:** Flask multi-tenant session isolation, file storage scoping, soft-delete / trash patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Session cleanup behavior**
- Deleted sessions use a **trash folder with 30-day expiry** — files are moved, not immediately purged
- Deletion requires a **confirmation dialog** in the UI ("Are you sure? Files will be moved to trash for 30 days.")
- Users can **view and restore trashed sessions** from the UI — trash is not just a backend safety net
- Auto-purge runs after 30 days to permanently remove trashed files

### Claude's Discretion
- File storage directory structure and naming conventions
- DATA_DIR default path and deployment detection strategy
- Unauthorized access response behavior (404 vs error page)
- Migration strategy for pre-auth existing sessions/files
- Orphaned file cleanup approach
- Auto-purge mechanism (cron, startup check, background task, etc.)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-01 | User can only see and access their own sessions/projects | `list_sessions` + `get_session` must filter by `user_id`; add `user_id` column to `SessionRecord` |
| WORK-02 | Session lookup requires both session_id and authenticated user_id | `get_session()` refactor to accept `user_id`; ownership check before returning data |
| WORK-03 | Uploaded documents stored in user-scoped file paths ({user_id}/{session_id}/) | Directory layout change; `UPLOAD_FOLDER` root + `/{user_id}/{session_id}/` subpath at intake |
| WORK-04 | Deleting a session removes associated files from disk | `discard_session` endpoint — move to trash dir, not `unlink()`; add restore/list-trash endpoints |
| CONF-02 | Data directory configurable via DATA_DIR env var (falls back to app/data/ for dev) | `server.py` reads `DATA_DIR` env var; sets both `UPLOAD_FOLDER` and `SESSION_FOLDER` beneath it |
</phase_requirements>

---

## Summary

Phase 12 is a **backend-focused refactor** with no new third-party libraries required. The work splits into three logical areas: (1) adding a `user_id` column to `SessionRecord` and threading `g.clerk_user_id` through every session lookup and write, (2) restructuring the file storage layout to be user-scoped and pulling the root data directory from an env var, and (3) implementing a soft-delete trash system with 30-day expiry and a restore UI.

The biggest implementation risk is the `get_session()` refactor. The function is called at **26 call sites** in `routes.py` (lines 422, 480, 509, 624, 658, 693, 756, 791, 887, 990, 1052, 1076, 1105, 1200, 1247, 1279, 1312, 1359, 1400, 1444, 1499, 1681, 1777, 1820, 1856, and the definition at 79). Every call site must be audited — the function signature changes from `get_session(session_id)` to `get_session(session_id, user_id)`, and any call that returns a session belonging to a different user must return 404 (not 403, to avoid leaking existence). The STATE.md blocker note explicitly calls this out.

The trash pattern is conceptually simple: a `trash/` sibling directory next to `sessions/` and `uploads/`, with files moved on deletion and a `deleted_at` timestamp recorded in the DB row. Auto-purge can be a lightweight startup check (runs once when Flask starts) plus a background thread that fires after a configurable interval — no Celery needed at this scale.

**Primary recommendation:** Add `user_id` to `SessionRecord` first (schema migration), then refactor `get_session` + `save_session`, then restructure file paths, then implement trash. Do it in that order so each step is independently verifiable.

---

## Standard Stack

### Core (no new dependencies needed)

| Component | Current State | Phase 12 Change |
|-----------|--------------|-----------------|
| Flask `g.clerk_user_id` | Set by `check_auth()` before_request in Phase 11 | Available at every route — just pass it through |
| Flask-SQLAlchemy / Flask-Migrate | Already in place (Phase 9) | New migration: add `user_id` column + `deleted_at` column to `sessions` table |
| Python `pathlib.Path` | Used throughout routes.py already | No change — same API, new directory layout |
| `os.environ.get('DATA_DIR')` | Not yet used | Add to `server.py` `create_app()` |
| `shutil.move()` | Standard library | Used for trash moves (atomic on same filesystem) |
| `threading.Thread` | Already used for async analysis | Reuse pattern for auto-purge background task |

### No New Libraries Required

This phase is entirely implementable with the existing stack. Do NOT add:
- APScheduler (overkill for a startup check + single background thread)
- Celery (already rejected for this project — threading.Thread is the pattern)
- boto3 / S3 (Railway Volume decision is locked from Phase 9 planning)

---

## Architecture Patterns

### Recommended Directory Structure

```
{DATA_DIR}/
├── users/
│   └── {clerk_user_id}/
│       └── sessions/
│           └── {session_id}/
│               ├── target.docx
│               ├── precedent.docx
│               ├── target_parsed.json
│               └── precedent_parsed.json
├── sessions/                    # Session JSON metadata files
│   └── {session_id}.json        # (kept flat for fast lookups by session_id)
└── trash/
    └── {session_id}/            # Moved atomically from users/{uid}/sessions/{sid}/
        └── ...files...
```

**Rationale for this layout:**
- Upload files are user-scoped (`users/{clerk_id}/sessions/{session_id}/`) — satisfies WORK-03
- Session JSON metadata stays flat by session_id for O(1) disk lookup in `get_session()` — avoids needing to know the user_id to find the JSON during the 3-tier lookup
- Trash is a flat-by-session_id directory — simple to restore (move back) or purge (rmtree)

**Alternative considered and rejected:** Putting session JSON inside `users/{uid}/sessions/{sid}/session.json` would require knowing the user_id to do tier-2 disk lookup, which breaks the current fallback logic. Keep session JSON flat.

### Pattern 1: DATA_DIR Configuration in server.py

**What:** Single env var controls the root of all data storage.
**When to use:** Always — dev falls back to `app/data/`, Railway sets it to the volume mount path.

```python
# app/server.py — create_app()
import os
from pathlib import Path

data_dir_env = os.environ.get('DATA_DIR')
if data_dir_env:
    data_dir = Path(data_dir_env)
else:
    data_dir = Path(__file__).parent / 'data'

app.config['DATA_DIR']      = data_dir
app.config['UPLOAD_FOLDER'] = data_dir / 'users'          # user-scoped subdirs created at intake
app.config['SESSION_FOLDER'] = data_dir / 'sessions'      # flat session JSON
app.config['TRASH_FOLDER']  = data_dir / 'trash'

for folder in [data_dir, app.config['UPLOAD_FOLDER'],
               app.config['SESSION_FOLDER'], app.config['TRASH_FOLDER']]:
    folder.mkdir(parents=True, exist_ok=True)
```

### Pattern 2: user_id Column Migration

**What:** Add `user_id` and `deleted_at` to `SessionRecord` via Alembic migration.

```python
# app/models/session.py — additions to SessionRecord
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

class SessionRecord(db.Model):
    # ... existing columns ...

    # Phase 12: workspace isolation
    user_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True
    )

    # Phase 12: soft delete
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
```

**Migration command after model change:**
```bash
flask db migrate -m "add user_id and deleted_at to sessions"
flask db upgrade
```

`user_id` is nullable so that pre-auth sessions created before Phase 12 don't break. Nullable also handles the `load-test-session` endpoint (which never has an authenticated user_id in the test context).

### Pattern 3: get_session() Ownership Check

**What:** Accept optional `user_id` parameter; enforce ownership at the DB tier; return None (→ 404) if ownership mismatch.
**When to use:** All user-facing route calls pass `g.clerk_user_id`. Internal calls (background analysis threads, test session loader) pass `user_id=None` to skip the ownership check.

```python
def get_session(session_id, user_id=None):
    """
    Get session data using 3-tier lookup: memory -> disk -> DB.

    If user_id is provided, ownership is verified at every tier.
    Returns None (caller returns 404) if session not found or user mismatch.
    """
    # Tier 1: in-memory cache
    if session_id in sessions:
        data = sessions[session_id]
        if user_id and data.get('user_id') and data['user_id'] != user_id:
            return None  # ownership mismatch — do not leak existence
        return data

    # Tier 2: disk fallback
    session_folder = current_app.config['SESSION_FOLDER']
    session_path = session_folder / f'{session_id}.json'
    if session_path.exists():
        try:
            with open(session_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if user_id and data.get('user_id') and data['user_id'] != user_id:
                return None
            # ... rest of tier 2 logic (load parsed_doc, cache in memory) ...
            sessions[session_id] = data
            return data
        except (json.JSONDecodeError, IOError):
            pass

    # Tier 3: DB fallback
    try:
        record = db.session.get(SessionRecord, session_id)
        if record is None:
            return None
        if user_id and record.user_id and record.user_id != user_id:
            return None  # ownership mismatch
        if record.deleted_at is not None:
            return None  # trashed sessions are invisible to normal lookups
        # ... rest of tier 3 logic ...
    except Exception:
        return None
```

**Call site update pattern** — every route function that calls `get_session` needs:
```python
# Before:
session = get_session(session_id)

# After:
session = get_session(session_id, user_id=g.clerk_user_id)
```

**Exceptions:** `load-test-session` endpoint and background analysis threads call `get_session(session_id)` (no user_id) — this is correct, they bypass ownership.

### Pattern 4: user-scoped Upload Path at Intake

**What:** Intake route creates `{UPLOAD_FOLDER}/{clerk_user_id}/{session_id}/` instead of `{UPLOAD_FOLDER}/{session_id}/`.

```python
@api_bp.route('/intake', methods=['POST'])
def intake():
    user_id = g.clerk_user_id
    session_id = str(uuid.uuid4())

    # User-scoped upload directory
    upload_folder = (current_app.config['UPLOAD_FOLDER']
                     / user_id / session_id)
    upload_folder.mkdir(parents=True, exist_ok=True)

    # ... rest of intake logic unchanged ...

    session_data = {
        'session_id': session_id,
        'user_id': user_id,          # NEW: store owner
        # ... rest unchanged ...
    }
```

### Pattern 5: save_session() writes user_id to DB

```python
def save_session(session_id, data):
    # ... existing memory + disk write unchanged ...

    # DB upsert — add user_id
    try:
        record = db.session.get(SessionRecord, session_id)
        if record is None:
            record = SessionRecord(session_id=session_id)
            db.session.add(record)
        record.user_id = data.get('user_id')   # NEW
        # ... rest of existing columns ...
        db.session.commit()
    except Exception as exc:
        logging.getLogger(__name__).warning(...)
```

### Pattern 6: Trash (Soft Delete) for WORK-04

**What:** Move session files to `{DATA_DIR}/trash/{session_id}/` and stamp `deleted_at` in DB. Do NOT `unlink()`.

```python
import shutil
from datetime import datetime

@api_bp.route('/session/<session_id>', methods=['DELETE'])
def discard_session(session_id):
    session = get_session(session_id, user_id=g.clerk_user_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    trash_root = current_app.config['TRASH_FOLDER']

    # Move session JSON to trash
    session_folder = current_app.config['SESSION_FOLDER']
    session_path = session_folder / f'{session_id}.json'
    trash_session_dir = trash_root / session_id
    trash_session_dir.mkdir(parents=True, exist_ok=True)
    if session_path.exists():
        shutil.move(str(session_path), str(trash_session_dir / f'{session_id}.json'))

    # Move upload directory to trash (user-scoped path)
    user_id = session.get('user_id', g.clerk_user_id)
    upload_dir = current_app.config['UPLOAD_FOLDER'] / user_id / session_id
    if upload_dir.exists():
        shutil.move(str(upload_dir), str(trash_session_dir / 'files'))

    # Stamp DB record
    try:
        from app.models.session import SessionRecord
        from app.models import db as _db
        record = _db.session.get(SessionRecord, session_id)
        if record:
            record.deleted_at = datetime.utcnow()
            _db.session.commit()
    except Exception:
        pass

    # Evict from memory
    sessions.pop(session_id, None)

    return jsonify({'status': 'trashed', 'session_id': session_id,
                    'message': 'Session moved to trash. Files retained for 30 days.'})
```

**Restore endpoint:**
```python
@api_bp.route('/session/<session_id>/restore', methods=['POST'])
def restore_session(session_id):
    # 1. Verify ownership via DB (skip get_session — it filters out deleted)
    record = db.session.get(SessionRecord, session_id)
    if not record or record.user_id != g.clerk_user_id:
        return jsonify({'error': 'Session not found'}), 404
    if not record.deleted_at:
        return jsonify({'error': 'Session is not in trash'}), 400

    # 2. Move files back
    trash_dir = current_app.config['TRASH_FOLDER'] / session_id
    # Move session JSON back
    trash_json = trash_dir / f'{session_id}.json'
    if trash_json.exists():
        shutil.move(str(trash_json),
                    str(current_app.config['SESSION_FOLDER'] / f'{session_id}.json'))
    # Move files back to user-scoped dir
    trash_files = trash_dir / 'files'
    if trash_files.exists():
        dest = current_app.config['UPLOAD_FOLDER'] / record.user_id / session_id
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(trash_files), str(dest))
    # Clean up trash slot
    if trash_dir.exists() and not any(trash_dir.iterdir()):
        trash_dir.rmdir()

    # 3. Clear deleted_at
    record.deleted_at = None
    db.session.commit()

    return jsonify({'status': 'restored', 'session_id': session_id})
```

**List trash endpoint:**
```python
@api_bp.route('/sessions/trash', methods=['GET'])
def list_trash():
    from app.models.session import SessionRecord
    records = (SessionRecord.query
               .filter(SessionRecord.user_id == g.clerk_user_id)
               .filter(SessionRecord.deleted_at.isnot(None))
               .order_by(SessionRecord.deleted_at.desc())
               .all())
    return jsonify([{
        'session_id': r.session_id,
        'target_filename': r.target_filename,
        'deleted_at': r.deleted_at.isoformat() if r.deleted_at else None,
        'expires_at': ...,  # deleted_at + 30 days
    } for r in records])
```

### Pattern 7: list_sessions() User Filtering

```python
@api_bp.route('/sessions', methods=['GET'])
def list_sessions():
    from app.models.session import SessionRecord
    records = (SessionRecord.query
               .filter(SessionRecord.user_id == g.clerk_user_id)
               .filter(SessionRecord.deleted_at.is_(None))    # exclude trashed
               .order_by(SessionRecord.updated_at.desc())
               .all())
    return jsonify([...])
```

### Pattern 8: Auto-Purge (30-day trash expiry)

**Recommendation:** Run at app startup + once per day via background thread. No Celery needed.

```python
# app/server.py — create_app(), after blueprint registration

import threading, time
from datetime import datetime, timedelta

def _auto_purge_trash(app):
    """Background daemon thread that purges trash older than 30 days."""
    while True:
        try:
            time.sleep(86400)  # run daily
            with app.app_context():
                _run_purge(app)
        except Exception:
            pass  # never crash the thread

def _run_purge(app):
    """Delete trashed sessions whose deleted_at is older than 30 days."""
    from app.models.session import SessionRecord
    from app.models import db
    cutoff = datetime.utcnow() - timedelta(days=30)
    expired = (SessionRecord.query
               .filter(SessionRecord.deleted_at < cutoff)
               .all())
    for record in expired:
        trash_dir = app.config['TRASH_FOLDER'] / record.session_id
        if trash_dir.exists():
            shutil.rmtree(str(trash_dir), ignore_errors=True)
        db.session.delete(record)
    db.session.commit()

# In create_app(), after register_blueprint:
# Also run once at startup to catch any missed purges
with app.app_context():
    _run_purge(app)

t = threading.Thread(target=_auto_purge_trash, args=(app,), daemon=True)
t.start()
```

### Anti-Patterns to Avoid

- **Returning 403 on ownership mismatch:** Return 404 instead — 403 leaks session existence to unauthorized users.
- **Checking ownership only in the route, not in get_session:** If `get_session` is called without `user_id` in a route that has auth, ownership is silently skipped. Put the check inside `get_session` where it's mandatory by convention.
- **Deleting files immediately on delete:** User chose 30-day trash — never call `unlink()` or `rmtree()` directly in the delete endpoint.
- **Storing parsed_doc inside DB tier lookup paths that include user_id:** The tier-2/3 disk lookup needs to find the session JSON without knowing the user_id. Keep session JSON flat by session_id.
- **Breaking the load-test-session endpoint:** This endpoint has no `g.clerk_user_id` context in the same way (no `user_id` in the session data). Keep `user_id=None` as the default parameter and skip ownership check when `None`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migration | Manual SQL ALTER TABLE | `flask db migrate` + `flask db upgrade` | Alembic handles nullable columns, indexes, rollback |
| File move (atomic) | `copy + delete` | `shutil.move()` | Atomic on same filesystem (Railway volume), handles dirs |
| Directory removal | Manual `os.remove` loop | `shutil.rmtree(ignore_errors=True)` | Handles non-empty dirs, suppresses ENOENT |
| Periodic tasks | Manual timer + sleep loop | `threading.Thread(daemon=True)` | Already the established pattern in this project; no infra needed |

**Key insight:** This phase is primarily a **data wiring and path reorganization** problem. The hardest part is systematic call-site audit, not novel engineering.

---

## Common Pitfalls

### Pitfall 1: Forgetting the In-Memory Cache Ownership Check

**What goes wrong:** `get_session` returns a cached session from `sessions` dict that belongs to another user if that user's session was cached by a prior request in the same process.

**Why it happens:** The in-memory `sessions` dict is process-global (not per-user). Any session loaded by any user gets cached there. Without a check at tier 1, a request with `session_id=X, user_id=B` can hit a cache entry written by `user_id=A`.

**How to avoid:** Check ownership at all three tiers, not just tier 3 (DB). The pattern in the code example above does this.

**Warning signs:** During testing, user B can access user A's session after user A loads it in the same server process.

### Pitfall 2: get_session Call Sites in Background Threads

**What goes wrong:** Background analysis threads call `get_session(session_id)` inside `app.app_context()` — they do not have `g.clerk_user_id` available (g is request-scoped, not thread-scoped).

**Why it happens:** Flask's `g` object is tied to the request context. Background threads pushed with `app.app_context()` get an app context but not a request context, so `g` is not available.

**How to avoid:** Background threads should call `get_session(session_id)` with no `user_id` argument (uses default `None`, skips ownership check). This is correct — the thread was spawned by an authenticated request and the session_id was already validated at spawn time.

**Warning signs:** `AttributeError: '_AppCtxGlobals' object has no attribute 'clerk_user_id'` in thread logs.

### Pitfall 3: Old Sessions Without user_id Break After Migration

**What goes wrong:** Pre-Phase-12 sessions have `user_id = NULL` in DB and no `user_id` key in their disk JSON. The ownership check `if user_id and data.get('user_id') and data['user_id'] != user_id` must short-circuit correctly when the session has no user_id.

**Why it happens:** The null check `data.get('user_id')` returns `None`, which is falsy — the condition evaluates to `False`, so the check is skipped. Old sessions are visible to any authenticated user who knows the session_id.

**How to avoid:** This is the intended behavior for legacy sessions (they can't be assigned to a user retroactively without user login history). Document it. Optionally, add a migration endpoint that assigns old sessions to the currently authenticated user if they appear to be the same user by some heuristic — but this is out of scope for Phase 12 per CONTEXT.md.

**Warning signs:** Not a bug — this is a known tradeoff. Document clearly.

### Pitfall 4: shutil.move Across Filesystem Boundaries

**What goes wrong:** `shutil.move()` raises `OSError` if source and destination are on different filesystems (e.g., uploads on a Railway Volume, trash on a different mount).

**Why it happens:** On same-filesystem moves, `shutil.move` calls `os.rename()` (atomic). Cross-filesystem, it falls back to copy+delete. If copy fails mid-way, source is not deleted and destination is partial.

**How to avoid:** Keep `DATA_DIR` as a single root encompassing all subdirs (`users/`, `sessions/`, `trash/`). On Railway, configure `DATA_DIR` to point to the volume mount. All subdirs are on the same volume.

**Warning signs:** `OSError: [Errno 18] Invalid cross-device link` in logs.

### Pitfall 5: list_sessions Returning Stale In-Memory Sessions

**What goes wrong:** `list_sessions` queries DB (filtered by user_id) but in-memory sessions dict may contain sessions loaded from disk that have no `user_id` in DB yet (if save_session DB write failed silently).

**Why it happens:** The 3-tier system degrades gracefully on DB failure — sessions can exist on disk without a DB row. `list_sessions` only queries DB.

**How to avoid:** The DB write in `save_session` logs a warning on failure. For Phase 12, this is acceptable — `list_sessions` (DB-backed) is the authoritative source; `list_saved_sessions` (disk-scan) is the fallback. Users who see missing sessions can use the disk-scan endpoint.

---

## Code Examples

### Migration File Pattern (generated by flask db migrate)

```python
# migrations/versions/xxxx_add_user_id_and_deleted_at_to_sessions.py
def upgrade():
    op.add_column('sessions', sa.Column('user_id', sa.String(255), nullable=True))
    op.add_column('sessions', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])

def downgrade():
    op.drop_index('ix_sessions_user_id', table_name='sessions')
    op.drop_column('sessions', 'deleted_at')
    op.drop_column('sessions', 'user_id')
```

### Confirmation Dialog (Frontend)

The CONTEXT.md requires a confirmation dialog before deletion. The existing codebase uses shadcn/ui — use the `AlertDialog` component.

```tsx
// Pattern: shadcn/ui AlertDialog for destructive action confirmation
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Session</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this session?</AlertDialogTitle>
      <AlertDialogDescription>
        Files will be moved to trash and permanently deleted after 30 days.
        You can restore from trash within that window.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>
        Move to Trash
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Trash UI (Frontend)

A simple list view accessible from the session list page. Uses the existing list pattern (shadcn/ui cards or table). The `/api/sessions/trash` endpoint returns deleted sessions for the current user. Each row has a "Restore" button that calls `POST /api/session/{id}/restore`.

---

## State of the Art

| Old Approach | Phase 12 Approach | Why |
|--------------|-------------------|-----|
| `UPLOAD_FOLDER/{session_id}/` | `UPLOAD_FOLDER/{user_id}/{session_id}/` | User isolation — WORK-03 |
| `get_session(session_id)` | `get_session(session_id, user_id=None)` | Ownership enforcement — WORK-02 |
| `list_sessions` returns all records | Filtered by `user_id == g.clerk_user_id` | WORK-01 |
| `discard_session` calls `unlink()` | Move to `TRASH_FOLDER/{session_id}/` | 30-day recovery window |
| `UPLOAD_FOLDER` hardcoded in `server.py` | Derived from `DATA_DIR` env var | CONF-02 |
| No auto-purge | Startup check + daily daemon thread | 30-day trash expiry |

---

## Implementation Order

Execute tasks in this order — each is independently verifiable:

1. **Task 1: CONF-02 — DATA_DIR env var in server.py**
   - Change: `server.py` `create_app()` reads `DATA_DIR`, derives `UPLOAD_FOLDER`, `SESSION_FOLDER`, `TRASH_FOLDER`
   - Verify: `DATA_DIR=/tmp/test python -c "from app.server import create_app; app=create_app()"` creates dirs under `/tmp/test`

2. **Task 2: WORK-03 + DB migration — user_id column + file path restructure**
   - Change: Add `user_id` + `deleted_at` to `SessionRecord`; run migration; update `intake()` to use `/{user_id}/{session_id}/` path
   - Verify: After intake, files exist at `{DATA_DIR}/users/{user_id}/{session_id}/target.docx`

3. **Task 3: WORK-01 + WORK-02 — get_session ownership + list_sessions filtering**
   - Change: `get_session(session_id, user_id=None)` with ownership checks at all 3 tiers; `save_session` writes `user_id`; `list_sessions` filters by user_id and excludes deleted
   - Verify: 26 call sites audited; route functions pass `g.clerk_user_id`; background threads pass no user_id

4. **Task 4: WORK-04 — Trash implementation (backend)**
   - Change: `discard_session` moves to trash; add `/sessions/trash` + `/session/{id}/restore` endpoints; auto-purge thread
   - Verify: Delete a session → files in trash dir; DB has `deleted_at`; session invisible to `get_session`; restore moves files back

5. **Task 5: UI — Confirmation dialog + Trash view (frontend)**
   - Change: Delete button shows `AlertDialog`; add Trash page/panel listing deleted sessions with Restore button
   - Verify: Dialog appears; cancel aborts; confirm moves to trash; Trash page shows session; Restore brings it back

---

## Open Questions

1. **What should happen to sessions with user_id=NULL in list_sessions?**
   - What we know: Pre-Phase-12 sessions lack user_id in DB
   - What's unclear: Should authenticated users see them? Should they be excluded?
   - Recommendation: Exclude them from `list_sessions` (filter `user_id == g.clerk_user_id`). They become inaccessible via list, but still accessible by direct session_id if someone has it. This is acceptable — they are dev/test artifacts.

2. **Where does load-test-session endpoint fit after isolation?**
   - What we know: It creates a test session with no real user_id
   - What's unclear: Should test sessions be associated with the caller's user_id?
   - Recommendation: Yes — store `g.clerk_user_id` as `user_id` in the test session at creation time. This makes it appear in the user's session list (with `is_test_session=True` marker) and subject to ownership checks.

3. **How to handle the in-memory `sessions` dict as a process-global cross-user cache?**
   - What we know: Multiple users share the same Flask process; their sessions all land in the same dict
   - What's unclear: At high enough volume, dict grows unbounded
   - Recommendation: Out of scope for Phase 12. At current scale (legal attorney tool, low concurrent users), this is fine. Add LRU eviction in a future phase if needed.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `app/api/routes.py` (1,926 lines) — 26 `get_session` call sites, current file path patterns, existing delete/list endpoints
- `app/server.py` — current `UPLOAD_FOLDER` / `SESSION_FOLDER` hardcoded paths
- `app/models/session.py` — current `SessionRecord` schema (no `user_id`, no `deleted_at`)
- `app/auth.py` — confirms `g.clerk_user_id` is set from `payload.get('sub')` in before_request
- `.planning/STATE.md` — confirms Phase 12 blocker: "get_session refactor touches all 30+ call sites"
- `.planning/phases/12-workspace-isolation-storage-config/12-CONTEXT.md` — user decisions

### Secondary (MEDIUM confidence — verified against stdlib docs)

- Python `shutil.move()` — standard library, atomic on same filesystem via `os.rename()`, degrades to copy+delete cross-filesystem
- Flask `g` object — request-context scoped, not available in background threads without request context push
- SQLAlchemy nullable column migration pattern — standard Flask-Migrate/Alembic workflow

### Tertiary (LOW confidence — not verified this session)

- shadcn/ui `AlertDialog` component API — based on training data; verify against installed shadcn version in `frontend/`
- Railway Volume behavior (single mount point) — assumed same filesystem as app data; verify when configuring DATA_DIR in Phase 13

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing components
- Architecture: HIGH — derived from direct codebase reading; patterns match existing conventions
- Pitfalls: HIGH — derived from code analysis (in-memory dict, background threads, nullable user_id)
- Trash UI patterns: MEDIUM — shadcn/ui component API not re-verified this session

**Research date:** 2026-02-21
**Valid until:** 2026-04-21 (stable domain — no fast-moving libraries involved)
