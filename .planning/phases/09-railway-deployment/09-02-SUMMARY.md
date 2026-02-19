---
phase: 09-railway-deployment
plan: 02
subsystem: api
tags: [async, threading, flask, analysis, polling, railway]

# Dependency graph
requires:
  - phase: 09-01
    provides: 3-tier session persistence (save_session writes to memory+disk+DB)

provides:
  - POST /api/analysis/{session_id}/start returns 202+job_id within 1 second
  - Background threading.Thread runs analysis outside HTTP request lifecycle
  - GET /api/analysis/jobs/{job_id} for job status polling
  - GET /api/analysis/{session_id} is non-blocking (returns cached result or 202)
  - Frontend hook uses POST+poll instead of blocking GET

affects: [phase-10-auth, phase-11-jwt, phase-13-deployment-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async task pattern: POST /start returns 202+job_id, background thread runs work, polling detects completion"
    - "current_app._get_current_object() before thread spawn (thread-local proxy fix)"
    - "Frontend polling callback (onComplete) pattern: polling calls handler when done, handler fetches full results"

key-files:
  created: []
  modified:
    - app/api/routes.py
    - frontend/src/lib/api.ts
    - frontend/src/hooks/use-analysis.ts

key-decisions:
  - "Python threading.Thread (not Celery/RQ): no extra infrastructure, GIL provides adequate dict protection at this concurrency level"
  - "Regex fallback runs inside background thread on LLM failure before marking job as failed (preserves degraded-quality result path)"
  - "_build_concept_and_risk_maps() extracted as shared helper to eliminate duplication between sync and async code paths"
  - "startPolling accepts onComplete callback so polling and result hydration are cleanly decoupled in the hook"

patterns-established:
  - "POST /start + polling: all future long-running operations should use this pattern, not blocking GETs"
  - "use current_app._get_current_object() before any thread.start() when Flask context is needed in threads"

requirements-completed: [ASYNC-01, ASYNC-02]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 09 Plan 02: Async Analysis Summary

**Non-blocking analysis via POST+poll: Flask spawns background thread (app context pushed), returns 202+job_id in <1s; frontend polls progress then fetches results on completion**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T16:39:54Z
- **Completed:** 2026-02-19T16:43:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Analysis can now run for 30+ minutes without being killed by Railway's 5-minute HTTP timeout
- POST /api/analysis/{session_id}/start returns 202+job_id within 1 second
- Background thread pushes app.app_context() and calls same analysis pipeline, with regex fallback on LLM failure
- Frontend hook completely rewritten to POST+poll: no long-held HTTP connections
- TypeScript build passes cleanly, all imports verified

## Task Commits

Each task was committed atomically:

1. **Task 1: Add async analysis endpoints to Flask backend** - `c6dfb2c` (feat)
2. **Task 2: Update frontend to use non-blocking POST+poll pattern** - `2a6878d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/api/routes.py` - Added _analysis_jobs registry, POST /start, GET /jobs/<job_id>, updated GET endpoint, extracted _build_concept_and_risk_maps()
- `frontend/src/lib/api.ts` - Added startAnalysisJob() function
- `frontend/src/hooks/use-analysis.ts` - Rewrote startAnalysis to POST+poll; startPolling now accepts onComplete callback

## Decisions Made
- Used Python's built-in `threading.Thread` (not Celery/RQ) — no extra infrastructure needed at this scale; the GIL provides adequate protection for dict reads/writes at single-analysis-thread + request-threads concurrency
- Regex fallback runs inside the background thread on LLM failure before marking the job as failed; this preserves the existing degraded-quality result path (user gets something rather than nothing)
- Extracted `_build_concept_and_risk_maps()` as a module-level helper to eliminate code duplication between what was the old synchronous path and the new async path
- Frontend's `startPolling` now accepts an `onComplete` async callback, which cleanly decouples the "detect completion" concern from the "fetch and hydrate results" concern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. Flask route ordering was verified: `/api/analysis/jobs/<job_id>` resolves correctly before `/api/analysis/<session_id>` because Flask matches the static `jobs` segment preferentially.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Async analysis backbone is complete; Railway's 5-minute HTTP timeout can no longer kill long analyses
- Phase 10 (frontend auth) and Phase 11 (JWT middleware) are independent of this change
- Phase 13 (deployment testing) should verify end-to-end: POST /start → polling → completion → results displayed, on Railway with a 50+ page document

---
*Phase: 09-railway-deployment*
*Completed: 2026-02-19*
