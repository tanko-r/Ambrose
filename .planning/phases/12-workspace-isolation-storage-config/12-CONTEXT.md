# Phase 12: Workspace Isolation + Storage Config - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Each authenticated user sees only their own sessions and documents. Session lookups filter by user_id. Uploaded files live in user-scoped directories. Data directory is env-var configurable. Deleting a session removes both the database record and associated files.

</domain>

<decisions>
## Implementation Decisions

### File storage layout
- Claude's discretion on directory structure (e.g., `users/{clerk_id}/sessions/{session_id}/` vs flat with DB-only ownership)
- Claude's discretion on filename handling (preserve vs normalize with UUID prefix)
- Claude's discretion on DATA_DIR default path (project-relative vs home directory)
- Claude's discretion on Railway volume detection (explicit DATA_DIR vs auto-detect)

### Session cleanup behavior
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

</decisions>

<specifics>
## Specific Ideas

- User chose 30-day trash retention specifically because legal documents may be hard to recreate — err on the side of caution
- Trash restore UI should be visible to users, not hidden admin-only functionality

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-workspace-isolation-storage-config*
*Context gathered: 2026-02-21*
