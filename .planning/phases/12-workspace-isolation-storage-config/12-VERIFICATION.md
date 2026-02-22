---
phase: 12-workspace-isolation-storage-config
verified: 2026-02-21T00:00:00Z
status: human_needed
score: 9/9 automated must-haves verified
re_verification: false
human_verification:
  - test: "Cross-user session isolation at API level"
    expected: "User B gets 404 when requesting User A's session_id via GET /api/session/{id} or any other endpoint"
    why_human: "Requires two distinct Clerk accounts and live HTTP requests through the auth middleware — cannot simulate g.clerk_user_id injection programmatically"
  - test: "Full trash lifecycle end-to-end"
    expected: "Delete session -> session disappears from list -> appears in GET /sessions/trash with expiration date -> Restore -> session reappears in main list -> files return to correct user-scoped path"
    why_human: "Requires a running server with auth tokens and filesystem verification across the delete/restore cycle"
  - test: "DATA_DIR env var in production-like environment"
    expected: "Setting DATA_DIR=/custom/path causes uploads to land at /custom/path/users/{user_id}/{session_id}/ and sessions at /custom/path/sessions/"
    why_human: "Automated check can verify the config value is set; actual filesystem writes require a running server"
  - test: "DeleteSessionDialog 30-day messaging displayed to user"
    expected: "Clicking delete shows AlertDialog with text mentioning 30-day trash window and restore option before 'Move to Trash' button"
    why_human: "Visual/UI verification of the rendered dialog in-browser"
  - test: "TrashList expiration countdown UI"
    expected: "Sessions expiring in 7 or fewer days appear in orange; empty state shows 'No sessions in trash'"
    why_human: "Visual/UI rendering verification requires browser"
---

# Phase 12: Workspace Isolation + Storage Config Verification Report

**Phase Goal:** Each authenticated user sees only their own sessions and documents. Session lookups filter by user_id. Uploaded files live in user-scoped directories. Data directory is env-var configurable.
**Verified:** 2026-02-21
**Status:** human_needed — All automated checks passed. Human verification required for cross-user isolation, trash lifecycle, and DATA_DIR in production environment.
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DATA_DIR env var controls where all data is stored, falling back to app/data/ in dev | VERIFIED | `server.py:38-47` reads `os.environ.get('DATA_DIR')`, falls back to `Path(__file__).parent / 'data'`; sets `app.config['DATA_DIR']`, `UPLOAD_FOLDER`, `SESSION_FOLDER`, `TRASH_FOLDER` from it |
| 2 | User A cannot access, view, or retrieve any session belonging to User B | VERIFIED (automated) | `get_session()` at lines 104, 116, 141 returns `None` on `user_id` mismatch at all 3 tiers; all 24 route call sites pass `user_id=g.clerk_user_id`; needs human confirmation |
| 3 | Uploaded documents are stored under {DATA_DIR}/users/{clerk_user_id}/{session_id}/ | VERIFIED | `routes.py:341-343` — `upload_folder = current_app.config['UPLOAD_FOLDER'] / user_id / session_id` |
| 4 | list_sessions returns only sessions owned by the authenticated user | VERIFIED | `routes.py:1653-1656` — `.filter(SessionRecord.user_id == g.clerk_user_id).filter(SessionRecord.deleted_at.is_(None))` |
| 5 | Background analysis threads still work without g.clerk_user_id | VERIFIED | Lines 689, 724 — bare `get_session(session_id)` calls inside `_run_analysis` background thread; confirmed by grep showing only 2 bare calls, both inside background thread |
| 6 | Deleting a session moves files to trash, not permanent deletion | VERIFIED | `discard_session()` at line 1743 uses `shutil.move()` to `TRASH_FOLDER/{session_id}/`, stamps `deleted_at`, returns `{"status": "trashed"}` |
| 7 | User can view their trashed sessions with expiration dates | VERIFIED | `list_trash()` at line 1799 queries `deleted_at IS NOT NULL`, computes `expires_at = deleted_at + timedelta(days=30)` |
| 8 | User can restore a trashed session | VERIFIED | `restore_session()` at line 1822 moves JSON and files back, clears `deleted_at = None`, verifies ownership |
| 9 | Trashed sessions older than 30 days are automatically purged | VERIFIED | `_run_purge()` and `_auto_purge_loop()` in `server.py:76-110` — runs at startup and daily via daemon thread |

**Score:** 9/9 truths verified by code inspection

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/server.py` | DATA_DIR env var config deriving UPLOAD_FOLDER, SESSION_FOLDER, TRASH_FOLDER | VERIFIED | Lines 37-52: `os.environ.get('DATA_DIR')` with fallback, all three folders set from `data_dir` |
| `app/models/session.py` | user_id and deleted_at columns on SessionRecord | VERIFIED | Lines 57-63: `user_id: Mapped[Optional[str]]` (String(255), indexed) and `deleted_at: Mapped[Optional[datetime]]` |
| `app/api/routes.py` | Ownership-checked get_session, user-scoped uploads, filtered list_sessions | VERIFIED | 24 call sites pass `user_id=g.clerk_user_id`; intake uses scoped paths; list_sessions filters by user_id and excludes deleted |
| `migrations/versions/bda57b67b693_add_user_id_and_deleted_at_to_sessions.py` | Alembic migration adding user_id and deleted_at columns | VERIFIED | File exists; `upgrade()` adds both columns and creates index on `user_id` |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/routes.py` | DELETE /session/{id}, GET /sessions/trash, POST /session/{id}/restore endpoints | VERIFIED | All three endpoints present at lines 1742, 1798, 1821 with correct HTTP methods |
| `app/server.py` | Auto-purge background thread for 30-day trash expiry | VERIFIED | `_run_purge()` and `_auto_purge_loop()` at lines 76-110; daemon thread started at line 109 |
| `frontend/src/components/sessions/delete-session-dialog.tsx` | AlertDialog confirmation for session deletion | VERIFIED | Full AlertDialog with 30-day copy, loading state, "Move to Trash" button, `deleteSession()` call |
| `frontend/src/components/sessions/trash-list.tsx` | Trash view listing deleted sessions with restore buttons | VERIFIED | Fetches `listTrash()` on mount, renders per-session cards with `restoreSession()`, expiration countdown, empty state |
| `frontend/src/lib/api.ts` | deleteSession, listTrash, restoreSession API functions | VERIFIED | All three functions present at lines 143, 147, 151 with correct endpoints and return types |
| `frontend/src/lib/types.ts` | TrashedSession type | VERIFIED | `TrashedSession` interface at line 472 with all 5 required fields |

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routes.py (route functions)` | `routes.py (get_session)` | `user_id=g.clerk_user_id` parameter | VERIFIED | `grep` confirms 24 occurrences of `user_id=g.clerk_user_id` in route functions |
| `routes.py (intake)` | filesystem | `UPLOAD_FOLDER / user_id / session_id` path | VERIFIED | `routes.py:342-343` explicitly constructs scoped path |
| `server.py (create_app)` | `routes.py` | `app.config['DATA_DIR']`, `UPLOAD_FOLDER`, `SESSION_FOLDER`, `TRASH_FOLDER` | VERIFIED | Config set at `server.py:44-47`; route uses `current_app.config['UPLOAD_FOLDER']` |

#### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `delete-session-dialog.tsx` | `/api/session/{id} DELETE` | `deleteSession(sessionId)` | VERIFIED | Import at line 4; called in `handleDelete()` at line 45 |
| `trash-list.tsx` | `/api/sessions/trash GET` | `listTrash()` | VERIFIED | Import at line 4; called in `fetchTrash()` at line 49 |
| `trash-list.tsx` | `/api/session/{id}/restore POST` | `restoreSession(sessionId)` | VERIFIED | Import at line 4; called in `handleRestore()` at line 65 |
| `server.py (_auto_purge_trash)` | `SessionRecord.deleted_at` | Query `deleted_at < cutoff`, rmtree, delete DB row | VERIFIED | `server.py:80-90` queries `SessionRecord.deleted_at < cutoff`, calls `shutil.rmtree`, deletes record |

### Requirements Coverage

All five requirement IDs declared in PLAN frontmatter are accounted for.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| WORK-01 | 12-01 | User can only see and access their own sessions/projects | SATISFIED | `list_sessions` filters by `user_id == g.clerk_user_id`; `get_session` returns `None` on ownership mismatch at all 3 tiers |
| WORK-02 | 12-01 | Session lookup requires both session_id and authenticated user_id | SATISFIED | `get_session(session_id, user_id=None)` signature; all 24 route-level call sites pass `user_id=g.clerk_user_id` |
| WORK-03 | 12-01 | Uploaded documents stored in user-scoped file paths ({user_id}/{session_id}/) | SATISFIED | `intake()` at line 343: `UPLOAD_FOLDER / user_id / session_id` |
| WORK-04 | 12-02 | Deleting a session removes associated files from disk | SATISFIED (with enhancement) | `discard_session()` moves files to trash (not permanent delete), consistent with the locked decision to use 30-day trash |
| CONF-02 | 12-01 | Data directory configurable via DATA_DIR env var (falls back to app/data/ for dev) | SATISFIED | `server.py:38-52` |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps WORK-01..04 and CONF-02 to Phase 12. All five IDs appear in the PLAN frontmatter. No orphaned requirements.

**Note on WORK-04:** The requirement says "removes associated files from disk." The implementation moves them to trash (30-day retention) rather than immediate permanent deletion. This is consistent with the plan's locked decision ("Legal documents are hard to recreate — err on the side of caution") and is more protective than the literal requirement. The requirement is considered satisfied.

### Anti-Patterns Found

No anti-patterns found in any of the phase 12 modified files. No TODOs, FIXMEs, placeholder returns, or stub implementations detected.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | — | — | None found |

### Human Verification Required

#### 1. Cross-User Session Isolation

**Test:** Log in as User A, create a session, record the session_id. Then log in as User B (separate account) and attempt to access `GET /api/session/{session_id}`, `GET /api/session/{session_id}/info`, and any other session endpoint using User A's session_id.

**Expected:** All requests return 404 (not 403 — ownership mismatch is intentionally silent to avoid leaking session existence).

**Why human:** Requires two distinct Clerk JWT tokens and a live running server. The ownership check calls `g.clerk_user_id` which is populated by the Clerk auth middleware on real HTTP requests — cannot be tested statically.

#### 2. Full Trash Lifecycle End-to-End

**Test:**
1. Log in, create a session via intake (upload a test document).
2. Verify files exist at `app/data/users/{your_clerk_id}/{session_id}/`.
3. Click Delete on the session — confirm the AlertDialog appears with the 30-day trash messaging.
4. Confirm deletion. Verify session disappears from the main session list.
5. Open Trash view. Verify the session appears with an expiration date.
6. Click Restore. Verify the session reappears in the main session list.
7. Verify files were moved back to `app/data/users/{your_clerk_id}/{session_id}/`.

**Expected:** Full lifecycle completes without error. Files move between user-scoped and trash paths correctly.

**Why human:** Requires a running server, auth token, filesystem access, and multi-step interaction. File path verification requires checking the actual filesystem after each step.

#### 3. DATA_DIR Override in Production-Like Environment

**Test:** Start the server with `DATA_DIR=/tmp/test-ambrose python -m flask run` and create a session via intake. Verify the upload lands at `/tmp/test-ambrose/users/{clerk_user_id}/{session_id}/`.

**Expected:** All data written under `/tmp/test-ambrose/` rather than `app/data/`.

**Why human:** Automated verification confirms the config value is set correctly in `create_app()`. Actual filesystem writes require a running server with a real upload.

#### 4. DeleteSessionDialog 30-Day Messaging

**Test:** In a running app, click the delete button on any session. Confirm the AlertDialog renders with the copy: "Files will be moved to trash and permanently deleted after 30 days. You can restore from trash within that window."

**Expected:** Dialog appears, copy is correct, "Move to Trash" button visible, Cancel button visible.

**Why human:** UI/visual verification of rendered React component in-browser.

#### 5. TrashList Expiration Countdown and Orange Warning

**Test:** Manually set a session's `deleted_at` to 6 days ago in the database. Open the Trash view and verify that session's expiration row appears in orange with "Expires in X days."

**Expected:** Sessions expiring in 7 or fewer days display in orange (`text-orange-600`). Sessions with >7 days display normally. Empty state shows trash icon and "No sessions in trash."

**Why human:** Requires database manipulation and visual inspection of rendered component.

### Gaps Summary

No gaps found. All automated checks passed across all 9 observable truths, all 10 artifacts (4 from Plan 01, 6 from Plan 02), all 7 key links (3 from Plan 01, 4 from Plan 02), and all 5 requirement IDs (WORK-01, WORK-02, WORK-03, WORK-04, CONF-02).

The implementation is substantive at all three levels:
- **Exists:** All files created/modified as documented
- **Substantive:** No placeholder or stub implementations found
- **Wired:** All components connected — frontend calls API functions, API functions hit correct endpoints, backend enforces ownership at all tiers

The 5 human verification items are routine integration/visual tests that cannot be performed statically. They do not represent code gaps — they represent behaviors that require a live running system to confirm.

---

_Verified: 2026-02-21_
_Verifier: Claude (gsd-verifier)_
