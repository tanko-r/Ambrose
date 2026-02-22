---
phase: 12-workspace-isolation-storage-config
plan: "02"
subsystem: fullstack
tags: [security, storage, soft-delete, trash, backend, frontend]
dependency_graph:
  requires: [12-01]
  provides: [trash-system, soft-delete-endpoints, restore-capability, auto-purge]
  affects: [app/api/routes.py, app/server.py, frontend/src/lib/types.ts, frontend/src/lib/api.ts, frontend/src/components/sessions/]
tech_stack:
  added: []
  patterns: [soft-delete, trash-lifecycle, background-daemon, atomic-file-moves]
key_files:
  created:
    - frontend/src/components/sessions/delete-session-dialog.tsx
    - frontend/src/components/sessions/trash-list.tsx
  modified:
    - app/api/routes.py
    - app/server.py
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/dialogs/delete-project-dialog.tsx
decisions:
  - "DELETE /session/{id} converted from permanent delete to soft-delete (move to trash) — reuses existing route, avoids API breakage"
  - "list_trash uses .is_not(None) filter so only deleted sessions are returned — active sessions excluded"
  - "restore_session queries DB directly (not get_session) because get_session filters out trashed sessions"
  - "Startup purge wrapped in try/except to handle first-run before flask db upgrade"
  - "DeleteProjectDialog updated in-place to reflect 30-day trash messaging instead of 'cannot be undone'"
metrics:
  duration_minutes: 30
  tasks_completed: 2
  files_modified: 7
  completed_date: "2026-02-21"
---

# Phase 12 Plan 02: Trash System (Soft Delete) Summary

**One-liner:** 30-day trash folder with restore capability: three new endpoints (delete/restore/list-trash), daily auto-purge daemon, confirmation dialog with trash messaging, and trash list component with expiration countdown.

## What Was Built

### Task 1: Trash backend (app/api/routes.py, app/server.py)

**discard_session — converted from permanent delete to soft-delete:**
- Was: deletes session JSON and evicts from memory permanently
- Now: moves session JSON to `TRASH_FOLDER/{session_id}/{session_id}.json` via `shutil.move()`
- Also moves upload dir from `UPLOAD_FOLDER/{user_id}/{session_id}/` to `TRASH_FOLDER/{session_id}/files/`
- Stamps `record.deleted_at = datetime.utcnow()` in DB
- Evicts from in-memory `sessions` dict
- Returns `{"status": "trashed", ...}` with 30-day retention message

**GET /api/sessions/trash (list_trash):**
- Queries `SessionRecord` where `user_id == g.clerk_user_id AND deleted_at IS NOT NULL`
- Returns `{session_id, target_filename, contract_type, deleted_at, expires_at}` per record
- `expires_at = deleted_at + timedelta(days=30)`

**POST /api/session/{id}/restore (restore_session):**
- Queries DB directly via `db.session.get()` — bypasses `get_session()` which filters out trashed sessions
- Verifies ownership and `deleted_at is not None`
- Moves JSON and files back via `shutil.move()`
- Cleans up empty trash subdirectory
- Clears `record.deleted_at = None`, commits DB

**Auto-purge in server.py:**
- `_run_purge(app)`: queries sessions where `deleted_at < (now - 30 days)`, `shutil.rmtree()` trash dir, deletes DB row
- `_auto_purge_loop(app)`: background daemon thread, sleeps 86400s (1 day) between runs
- Runs once at startup (wrapped in try/except for first-run before migration)
- Daemon thread started after blueprint registration, before `return app`

### Task 2: Frontend (types.ts, api.ts, sessions components)

**types.ts:**
- Added `TrashedSession` interface: `{session_id, target_filename, contract_type, deleted_at, expires_at}`
- Updated `DiscardSessionResponse.status` to `'discarded' | 'trashed'` (backwards compatible)

**api.ts:**
- Added `deleteSession(sessionId)` → `DELETE /api/session/{id}`
- Added `listTrash()` → `GET /api/sessions/trash` → `TrashedSession[]`
- Added `restoreSession(sessionId)` → `POST /api/session/{id}/restore`
- Kept existing `discardSession` unchanged for backwards compatibility

**delete-session-dialog.tsx (new):**
- AlertDialog with trigger prop (flexible placement)
- Copy: "Files will be moved to trash and permanently deleted after 30 days. You can restore from trash within that window."
- Action button: "Move to Trash" (destructive variant)
- Loading state during API call via Loader2 spinner

**trash-list.tsx (new):**
- Fetches from `listTrash()` on mount via `useCallback` + `useEffect`
- Displays each trashed session: filename, contract type, deletion date, days until expiry
- Sessions expiring in ≤7 days shown in orange
- "Restore" button per row, calls `restoreSession()` then refetches
- Empty state: trash icon + "No sessions in trash"
- Loading state: centered spinner

**DeleteProjectDialog updated:**
- Title changed from "Delete Project?" to "Delete this session?"
- Description updated to mention 30-day trash window and restore option
- Button text changed from "Delete" to "Move to Trash"

## Verification Results

| Check | Result |
|-------|--------|
| Server starts cleanly | PASS |
| `discard_session`, `list_trash`, `restore_session` in routes.py | PASS |
| `_run_purge`, `_auto_purge_loop` in server.py | PASS |
| `npx tsc --noEmit` | PASS (no errors) |
| `npm run build` | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Feature] Updated existing DeleteProjectDialog to reflect trash semantics**
- **Found during:** Task 2
- **Issue:** The existing `DeleteProjectDialog` component said "Permanently delete... This cannot be undone." This contradicted the new trash system which allows restore.
- **Fix:** Updated the dialog copy to mention 30-day trash window and restore option. Changed button text to "Move to Trash".
- **Files modified:** frontend/src/components/dialogs/delete-project-dialog.tsx
- **Commit:** 12a16e6

**2. [Rule 2 - Backwards Compatibility] Kept discardSession, added deleteSession as alias**
- **Found during:** Task 2 — `discardSession` is already used in `DeleteProjectDialog`
- **Issue:** Renaming `discardSession` to `deleteSession` would break the existing import in `delete-project-dialog.tsx`.
- **Fix:** Added `deleteSession` as a new export that calls the same endpoint. `discardSession` kept for existing code.
- **Files modified:** frontend/src/lib/api.ts
- **Commit:** 12a16e6

## Commits

| Hash | Description |
|------|-------------|
| 2829e61 | feat(12-02): trash backend — delete/restore/list-trash endpoints + auto-purge |
| 12a16e6 | feat(12-02): frontend trash UI — types, API client, delete dialog, trash list |

## Self-Check: PASSED

- [x] app/api/routes.py has discard_session, list_trash, restore_session
- [x] app/server.py has _run_purge and _auto_purge_loop
- [x] frontend/src/components/sessions/delete-session-dialog.tsx exists
- [x] frontend/src/components/sessions/trash-list.tsx exists
- [x] frontend/src/lib/types.ts has TrashedSession
- [x] frontend/src/lib/api.ts has deleteSession, listTrash, restoreSession
- [x] Commits 2829e61 and 12a16e6 exist
