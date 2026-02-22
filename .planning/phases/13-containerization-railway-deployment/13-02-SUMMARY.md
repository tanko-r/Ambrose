---
phase: 13-containerization-railway-deployment
plan: "02"
subsystem: deployment
tags: [railway, docker, health-checks, version-endpoint]
dependency_graph:
  requires: [13-01]
  provides: [railway-toml-backend, railway-toml-frontend, version-endpoint-env-vars]
  affects: [app/api/routes.py, railway.toml, frontend/railway.toml]
tech_stack:
  added: []
  patterns: [Railway DOCKERFILE builder, gunicorn gthread, env-var version injection]
key_files:
  created:
    - railway.toml
    - frontend/railway.toml
  modified:
    - app/api/routes.py
decisions:
  - "preDeployCommand omitted from railway.toml — array syntax for multi-word commands is ambiguous; user sets in Railway dashboard"
  - "BACKEND_URL baked into frontend image at build time — documented deploy order requirement prominently"
  - "Version endpoint reads GIT_BRANCH/GIT_COMMIT env vars first, falls back to subprocess for local dev"
metrics:
  duration: "2 minutes"
  completed: "2026-02-22"
  tasks_completed: 2
  files_changed: 3
---

# Phase 13 Plan 02: Railway Config + Version Endpoint Summary

Railway deployment config files created for both services, and the version endpoint updated to work in Docker containers without a .git directory.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Railway config files for both services | b97a2e6 | railway.toml, frontend/railway.toml |
| 2 | Fix version endpoint to use environment variables | 2ac5995 | app/api/routes.py |

## What Was Built

### railway.toml (Backend)
- DOCKERFILE builder pointing to `Dockerfile.backend`
- Gunicorn startCommand: 2 workers, 4 threads, gthread class, /dev/shm tmp dir, 120s timeout
- Health check at `/health` with 60s timeout
- ON_FAILURE restart policy with 3 max retries
- Comments documenting all required service variables: DATABASE_URL, DATA_DIR, FLASK_APP, GIT_BRANCH, GIT_COMMIT, CORS_ORIGINS, GEMINI_API_KEY, CLERK_FRONTEND_API_URL, CLERK_JWKS_URL
- Note about pre-deploy command (`flask db upgrade`) to be set in Railway dashboard

### frontend/railway.toml
- DOCKERFILE builder pointing to `Dockerfile.frontend`
- startCommand: `node server.js`
- Health check at `/` with 60s timeout
- ON_FAILURE restart policy with 3 max retries
- Prominent deploy-order warning: backend must be deployed first so BACKEND_URL build arg is known
- Comments documenting required variables: BACKEND_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

### /api/version Endpoint Fix
- Added env var path: reads `GIT_BRANCH` and `GIT_COMMIT` first — works without `.git` directory in containers
- Preserved git subprocess fallback for local development
- Returns `'unknown'` for both if neither path works
- Railway users set `GIT_BRANCH=${{RAILWAY_GIT_BRANCH}}` and `GIT_COMMIT=${{RAILWAY_GIT_COMMIT_SHA}}`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files created/modified:
- FOUND: railway.toml
- FOUND: frontend/railway.toml
- FOUND: app/api/routes.py (modified)

Commits verified:
- b97a2e6: chore(13-02): add Railway deployment config files
- 2ac5995: fix(13-02): update version endpoint to use env vars
