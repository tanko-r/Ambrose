---
phase: 12-workspace-isolation-storage-config
plan: "01"
subsystem: backend
tags: [security, auth, storage, database, isolation]
dependency_graph:
  requires: [11-01, 11-02]
  provides: [user-scoped-storage, ownership-enforcement, DATA_DIR-config, soft-delete-schema]
  affects: [app/api/routes.py, app/models/session.py, app/server.py]
tech_stack:
  added: []
  patterns: [user-scoped-filesystem, ownership-check-at-3-tiers, env-var-config, soft-delete]
key_files:
  created:
    - migrations/versions/bda57b67b693_add_user_id_and_deleted_at_to_sessions.py
  modified:
    - app/server.py
    - app/models/session.py
    - app/api/routes.py
decisions:
  - "Return 404 (not 403) on ownership mismatch — avoids leaking session existence to unauthorized callers"
  - "Legacy pre-Phase-12 sessions (user_id=None) remain accessible to all users — backwards compatibility"
  - "Background analysis threads keep bare get_session(session_id) — no g available outside request context"
  - "discard_session, load_saved_session, and list_saved_sessions all enforce ownership to prevent cross-user data access"
metrics:
  duration_minutes: 35
  tasks_completed: 2
  files_modified: 4
  completed_date: "2026-02-22"
---

# Phase 12 Plan 01: Workspace Isolation + Storage Config Summary

**One-liner:** DATA_DIR env var for configurable storage, user_id/deleted_at columns via Alembic migration, and ownership enforcement across all 24 route-level get_session call sites.

## What Was Built

### Task 1: DATA_DIR env var + DB migration

**server.py — DATA_DIR configuration:**
- Replaced hardcoded `UPLOAD_FOLDER = app/data/uploads` and `SESSION_FOLDER = app/data/sessions` with DATA_DIR-derived paths
- `DATA_DIR` env var (when set) becomes the root for all data storage; falls back to `app/data/` in dev
- Added `TRASH_FOLDER = data_dir / 'trash'` for soft-delete support (Plan 02)
- All three directories created at startup via `mkdir(parents=True, exist_ok=True)`
- `UPLOAD_FOLDER` now points to `data_dir / 'users'` — intake() creates user-scoped subdirs

**session.py — Two new columns:**
- `user_id: Mapped[Optional[str]]` — String(255), indexed, nullable (existing sessions unaffected)
- `deleted_at: Mapped[Optional[datetime]]` — DateTime, nullable (None = active, timestamp = soft-deleted)
- Alembic migration `bda57b67b693` generated and applied via `flask db upgrade`

### Task 2: Ownership enforcement + user-scoped paths

**get_session() — user_id parameter:**
- Signature changed to `get_session(session_id, user_id=None)`
- Ownership checked at all 3 tiers when user_id is provided:
  - Tier 1 (memory): `data['user_id'] != user_id → return None`
  - Tier 2 (disk): same check after JSON load
  - Tier 3 (DB): ownership check + `deleted_at is not None → return None`
- Returns `None` on mismatch (caller sees 404, not 403 — avoids session existence leaks)

**Call site audit — 24 route-level calls updated:**
All route-level `get_session(session_id)` calls updated to `get_session(session_id, user_id=g.clerk_user_id)`:
- `get_document`, `serve_document_html`, `serve_precedent_html`
- `start_analysis`, `get_analysis`, `get_analysis_progress`
- `revise`, `accept_revision`, `unaccept_revision`, `reject_revision`, `reanalyze_clause`
- `flag_item`, `update_flag`, `unflag_item`
- `finalize`, `finalize_preview`, `download`
- `get_suggestions`, `get_transmittal`
- `save_session_endpoint`, `get_session_info`
- `get_precedent`, `get_related_precedent_clauses`
- `discard_session` (added explicit ownership check before deletion)

**Background thread exceptions (kept bare):**
- `_run_analysis` inner function: lines 688, 723 — no `g` available outside request context
- These sessions were already authenticated when the job was spawned

**save_session() — persists user_id:**
- `record.user_id = data.get('user_id')` added to DB upsert

**intake() — user-scoped upload paths:**
- `upload_folder = UPLOAD_FOLDER / user_id / session_id` (was `UPLOAD_FOLDER / session_id`)
- `'user_id': user_id` added to session dict

**list_sessions() — filtered query:**
```python
SessionRecord.query
    .filter(SessionRecord.user_id == g.clerk_user_id)
    .filter(SessionRecord.deleted_at.is_(None))
    .order_by(SessionRecord.updated_at.desc())
    .all()
```

**load_test_session() — owns test sessions:**
- `'user_id': g.clerk_user_id` added to test session dict

**list_saved_sessions() + load_saved_session() — disk-level filtering:**
- `list_saved_sessions`: skips files where `stored_user_id != g.clerk_user_id`
- `load_saved_session`: returns 404 if disk session's user_id doesn't match caller

## Verification Results

| Check | Result |
|-------|--------|
| Server starts cleanly | PASS |
| `flask db upgrade` succeeds | PASS |
| DATA_DIR default (app/data/) | PASS |
| DATA_DIR env var override | PASS |
| user_id column on SessionRecord | PASS |
| deleted_at column on SessionRecord | PASS |
| Bare get_session calls only in background threads | PASS (2 bare calls, both in _run_analysis) |
| Route-level calls pass user_id | PASS (24 occurrences) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Authorization] discard_session and load_saved_session lacked ownership checks**
- **Found during:** Task 2 audit of all get_session call sites
- **Issue:** `discard_session` directly deleted from memory/disk without checking ownership. `load_saved_session` loaded disk JSON without checking user_id. A user could delete or load another user's session.
- **Fix:** Added `get_session(session_id, user_id=g.clerk_user_id)` guard in `discard_session` before deletion. Added `stored_user_id != g.clerk_user_id` check in `load_saved_session`. Updated `list_saved_sessions` to filter disk files by user_id.
- **Files modified:** app/api/routes.py
- **Commit:** a0215d5

## Commits

| Hash | Description |
|------|-------------|
| f8a7093 | feat(12-01): DATA_DIR env var config + user_id/deleted_at columns with migration |
| a0215d5 | feat(12-01): ownership enforcement at all get_session call sites + user-scoped paths |

## Self-Check: PASSED

- [x] app/server.py modified with DATA_DIR config
- [x] app/models/session.py has user_id and deleted_at columns
- [x] migrations/versions/bda57b67b693_*.py exists
- [x] app/api/routes.py has 24 `user_id=g.clerk_user_id` calls
- [x] Only 2 bare get_session(session_id) calls (both in background thread)
- [x] Commits f8a7093 and a0215d5 exist
