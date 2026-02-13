# Research Summary: Railway Deployment

**Domain:** Cloud deployment of Flask + Next.js two-service legal contract review tool
**Researched:** 2026-02-11
**Overall confidence:** HIGH

## Executive Summary

Deploying this Flask + Next.js monorepo to Railway is well-supported and straightforward for the basic infrastructure. Railway handles monorepo detection, private inter-service networking, persistent volumes, and SSL-terminated public domains out of the box. The two-service architecture (frontend publicly exposed, Flask private-only) maps cleanly to Railway's service model.

The single most important constraint discovered is Railway's **hard 15-minute HTTP timeout** at the platform proxy layer. The contract analysis phase can take 5-30+ minutes for large documents, meaning full-document analysis on the longest contracts will be terminated by Railway's edge proxy. This requires eventually refactoring analysis endpoints into a background job pattern: accept the job and return immediately, process in a background thread, and let the frontend poll for status. For the initial MVP deployment, most analyses should complete within 15 minutes; the background pattern can be added as a fast-follow when longer documents are attempted.

The **gthread** worker class (not gevent) is required for gunicorn because the project uses `asyncio.run()` in `parallel_analyzer.py` and `initial_analyzer.py`. Gevent's monkey-patching conflicts with asyncio's event loop. gthread uses real OS threads that coexist cleanly with asyncio -- no extra dependencies, no conflicts.

Next.js 16 renamed `middleware.ts` to `proxy.ts` and has a known bug (#87071) where `rewrites()` in `next.config.ts` return 500 errors when targeting external domains in standalone mode. The `proxy.ts` approach is the officially recommended solution: it runs at request time and reads environment variables, making the backend URL configurable per-environment without rebuilding. This is the most important code change required for deployment.

The recommended approach explicitly avoids over-engineering: no Nginx reverse proxy (Railway's edge handles SSL), no database (JSON files on a volume suffice for single-user), no Celery/Redis (Python threading handles background jobs), and no CI/CD pipeline (Railway auto-deploys on git push). The goal is the simplest possible production deployment that preserves the existing local development workflow unchanged.

## Key Findings

**Stack:** Gunicorn with gthread workers, python:3.12-slim-bookworm (not Alpine), node:22-alpine, Next.js standalone output, proxy.ts for API routing. One new Python dependency (gunicorn). Zero new frontend dependencies.

**Architecture:** Two Railway services from one repo. Frontend is publicly exposed; all API calls route through proxy.ts server-side rewrites over Railway's private network (`flask.railway.internal:8000`). Flask is internal-only, eliminating CORS. One volume mounted on backend at `/app/app/data` for both sessions and uploads.

**Critical pitfall:** Railway's 15-minute HTTP timeout kills very long analysis requests. Second critical pitfall: the in-memory `sessions` dict starts empty on every deploy -- must add startup rehydration from volume-backed JSON files. Third critical pitfall: Next.js 16 rewrites are buggy in standalone mode -- must use proxy.ts.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Dockerize Both Services** -- Establish container builds that work locally
   - Addresses: Dockerfile.flask (multi-stage, slim-bookworm), Dockerfile.frontend (standalone output), gunicorn.conf.py, .dockerignore, .gitattributes
   - Avoids: Alpine base image for Python (C extension issues), missing static assets in Next.js standalone (the three-line COPY pattern)
   - Test gate: Both containers build and run locally via `docker build` + `docker run`

2. **Phase 2: proxy.ts Migration** -- Replace next.config.ts rewrites with proxy.ts
   - Addresses: Create frontend/proxy.ts, add `output: "standalone"` to next.config.ts, remove `rewrites()`, environment-driven backend URL
   - Avoids: The rewrites bug (#87071) in standalone mode, build-time URL baking
   - Test gate: `npm run dev` still works locally (proxy.ts falls back to localhost:5000)

3. **Phase 3: Railway Project Setup** -- Deploy to Railway with persistent storage
   - Addresses: Railway project creation, two services with root directories, environment variables (GEMINI_API_KEY, ANTHROPIC_API_KEY, BACKEND_URL), volume mount at /app/app/data, private networking, health checks, public domain for frontend
   - Avoids: Exposing Flask publicly (eliminates CORS), writing to volume path at build time
   - Test gate: Frontend at `*.up.railway.app`, API calls reach Flask via private network, session data survives a redeploy

4. **Phase 4: Production Hardening** -- Session persistence and monitoring
   - Addresses: Session rehydration on startup, graceful shutdown tuning, startup validation
   - Avoids: Celery/Redis over-engineering
   - Test gate: Redeploy preserves active sessions, upload then redeploy then verify document still accessible

5. **Phase 5: Background Jobs (Deferred)** -- Only if large documents hit 15-min timeout
   - Addresses: Background job pattern for analysis endpoints, progress polling
   - Only implement after real-world testing shows the timeout is actually hit
   - Test gate: Upload 50+ page document, run analysis, results delivered without timeout

**Phase ordering rationale:**
- Phases 1-2 can be developed and tested entirely locally without a Railway account
- Phase 2 (proxy.ts) before Phase 3 (deploy) because the rewrites bug surfaces only in standalone mode production -- discovering it during Phase 3 would block deployment
- Phase 3 establishes the basic deployment. Getting a working deploy validates the entire infrastructure
- Phase 4 is post-deploy hardening that can only be fully tested on Railway
- Phase 5 is explicitly deferred because the 15-minute timeout is sufficient for most documents

**Research flags for phases:**
- Phase 1: Standard Docker patterns. Main risk is lxml build deps -- test early. Likely needs deeper research: NO
- Phase 2: Verify proxy.ts behavior with Next.js 16.1.6 specifically. Test both approaches. Likely needs deeper research: MAYBE (if proxy.ts has caveats not documented yet)
- Phase 3: May need attention to Railway's private networking DNS resolution timing on cold starts. Likely needs deeper research: YES (DNS timing, volume mount verification)
- Phase 4: Background job pattern in Flask with gthread workers needs design -- each worker has own memory. Likely needs deeper research: YES (job storage, multi-worker coordination)
- Phase 5: No research needed, standard configurations

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | gunicorn + Docker is universal Flask pattern. gthread over gevent based on verified asyncio usage. |
| Features | HIGH | Railway feature set well-documented. 15-min timeout verified from help station. |
| Architecture | HIGH | Two-service monorepo with private networking is Railway's recommended pattern. |
| Pitfalls | HIGH | All critical pitfalls verified from Railway docs, source code, or community. |
| proxy.ts | HIGH | Rename confirmed in Next.js 16 docs. Bug #87071 confirmed on GitHub. |
| Background jobs | MEDIUM | Threading approach sound for single-user but not tested with gthread multi-worker model. |

## Gaps to Address

- **proxy.ts vs rewrites testing:** Bug #87071 may be fixed in Next.js 16.1.6. Proactively adopt proxy.ts as the forward-looking approach regardless, but test whether rewrites also work as a fallback.
- **Exact volume mount path verification:** Path should be `/app/app/data` based on WORKDIR=/app and server.py path resolution. Must verify during Docker testing.
- **Session rehydration performance:** Loading many large JSON session files on startup could slow Flask boot time. May need lazy-load on first access rather than scan-all-at-startup.
- **Gunicorn gthread + asyncio edge cases:** `asyncio.run()` should work per-thread (each thread gets its own event loop). Edge cases with thread safety not tested.
- **Railway PORT injection:** Railway auto-injects PORT. Verify gunicorn.conf.py reads it correctly and does not conflict.
- **Railway volume backup/restore workflow:** Not investigated. If session data is critical, understand backup mechanism before relying on it.

## Files Created

| File | Purpose |
|------|---------|
| `.planning/research/SUMMARY.md` | Executive summary with roadmap implications |
| `.planning/research/STACK.md` | Technology decisions: gunicorn gthread, python slim, node alpine, proxy.ts |
| `.planning/research/FEATURES.md` | Feature landscape: table stakes, differentiators, anti-features |
| `.planning/research/ARCHITECTURE.md` | Two-service architecture, Dockerfiles, data flow, patterns, anti-patterns |
| `.planning/research/PITFALLS.md` | 15 pitfalls: HTTP timeout, session loss, C extensions, rewrites bug, secrets |
