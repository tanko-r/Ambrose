---
phase: 08-cleanup-cutover
plan: 01
subsystem: infra
tags: [flask, nextjs, concurrently, dev-tooling, archival]

# Dependency graph
requires:
  - phase: 00-scaffolding
    provides: "Next.js frontend scaffold at frontend/"
provides:
  - "API-only Flask server (no static serving)"
  - "Archived vanilla JS frontend at _archived/static/"
  - "Root package.json with concurrently for one-command dev startup"
  - "Updated run.py with dual-server documentation"
affects: [08-02, 09-railway-deployment]

# Tech tracking
tech-stack:
  added: [concurrently]
  patterns: [api-only-flask, dual-server-dev]

key-files:
  created:
    - "package.json"
    - "package-lock.json"
    - "_archived/static/index.html"
  modified:
    - "app/server.py"
    - "app/__init__.py"
    - "run.py"
    - ".gitignore"

key-decisions:
  - "Archive old frontend to _archived/ rather than delete (preserves history)"
  - "Track package-lock.json for reproducible concurrently installs"

patterns-established:
  - "API-only Flask: Flask(__name__) with no static_folder, no index route"
  - "Dev startup: npm run dev from project root runs both servers"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 8 Plan 1: Archive Frontend + API-Only Flask Summary

**Flask converted to API-only mode, old vanilla JS frontend archived, root package.json with concurrently for single-command dev startup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T22:03:50Z
- **Completed:** 2026-02-13T22:06:22Z
- **Tasks:** 2
- **Files modified:** 7 (+ 20 renamed/archived)

## Accomplishments
- Converted Flask from full-stack server to API-only backend (removed static_folder, send_from_directory, index route)
- Archived old vanilla JS frontend to _archived/static/ (not deleted, preserving git history)
- Created root package.json with `npm run dev` that starts both Flask and Next.js via concurrently
- Removed unused npm-publish.yml GitHub workflow
- Updated all docstrings and startup banners to reflect the new architecture

## Task Commits

Each task was committed atomically:

1. **Task 1: Archive old frontend and strip Flask static serving** - `840b0b8` (feat)
2. **Task 2: Create root package.json with concurrently dev script** - `5805980` (feat)

## Files Created/Modified
- `app/server.py` - API-only Flask server (removed static serving, updated banner)
- `app/__init__.py` - Updated docstring for API-only mode
- `run.py` - Updated docstring with dual-server usage instructions
- `package.json` - Root dev orchestrator with concurrently
- `package-lock.json` - Lockfile for reproducible concurrently installs
- `.gitignore` - Added node_modules/ exclusion
- `_archived/static/` - Archived old vanilla JS frontend (20 files)
- `.github/workflows/npm-publish.yml` - Removed (unused boilerplate)

## Decisions Made
- Archive old frontend to `_archived/` rather than delete -- preserves the original codebase for reference while keeping it out of the active project tree
- Track `package-lock.json` in git -- ensures reproducible installs of concurrently across machines
- Added `node_modules/` to root `.gitignore` -- the frontend already had its own, but root-level deps also need exclusion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added node_modules/ to root .gitignore**
- **Found during:** Task 2 (installing concurrently)
- **Issue:** Root .gitignore did not have a `node_modules/` entry; the frontend's own .gitignore handled its node_modules, but root-level npm install created a new node_modules/ that would be tracked
- **Fix:** Added `node_modules/` to `.gitignore` under a new "Node.js" section
- **Files modified:** `.gitignore`
- **Verification:** `grep "node_modules" .gitignore` returns match
- **Committed in:** `5805980` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix to prevent accidentally committing node_modules. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Flask is now API-only, ready for containerization (phase 9)
- `npm run dev` provides the canonical dev startup command
- Plan 08-02 (remaining cleanup) can proceed independently

## Self-Check: PASSED

All files verified present. Both commits (840b0b8, 5805980) confirmed in git log. Removed files (app/static/, npm-publish.yml) confirmed absent.

---
*Phase: 08-cleanup-cutover*
*Completed: 2026-02-13*
