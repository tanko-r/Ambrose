# Domain Pitfalls: Railway Deployment of Flask + Next.js

**Domain:** Cloud deployment of two-service legal contract review app
**Researched:** 2026-02-11
**Overall confidence:** HIGH (Railway docs verified, project files inspected)

---

## Critical Pitfalls

Mistakes that cause deployment failures, data loss, or broken production functionality.

---

### Pitfall 1: Railway's 15-Minute HTTP Timeout Kills Long LLM Analysis Requests

**What goes wrong:** Railway enforces a hard 15-minute platform-level HTTP timeout on all requests. Full-document contract analysis (risk mapping an entire PSA) can take 5-30+ minutes depending on document length and LLM response times. Any request exceeding 15 minutes gets a 502/504 from Railway's edge proxy. There is no configuration to increase this.

**Why it happens:** Railway's edge proxy (not your application) terminates connections after 15 minutes. This limit was increased from 5 minutes in mid-2025, but 15 minutes is the hard ceiling regardless of plan.

**Consequences:** Analysis requests for large contracts fail silently -- the frontend sees a connection error with no useful message. The backend may continue processing after the connection drops, wasting Gemini API credits with no way to deliver results to the user.

**Prevention:**
1. For the MVP, most analyses complete within 15 minutes. Deploy and test with real documents to confirm.
2. For large documents, implement a background job pattern: POST starts the job and returns a job ID immediately, frontend polls GET `/api/jobs/{id}/status` every few seconds.
3. The existing progress polling endpoint (`/api/analysis/{session_id}/progress`) already follows this pattern partially -- it returns incremental results while analysis runs. But the analysis call itself (`GET /api/analysis/{session_id}`) is synchronous and blocks until complete.
4. Consider breaking analysis into per-section batches (the parallel_analyzer.py already does this internally via async batches to Gemini).

**Detection:** Any API endpoint making synchronous LLM calls that process a full document is at risk.

**Confidence:** HIGH -- Railway docs and help station confirm the 15-minute hard limit.

**Sources:**
- [Railway Help Station: Increase Max HTTP Timeout](https://station.railway.com/questions/increase-max-http-timeout-1c360bf9)
- [Railway Help Station: Increase Beyond 5 Minutes](https://station.railway.com/feedback/increase-max-platform-timeout-beyond-5-m-9d15d4ee)

---

### Pitfall 2: In-Memory Session Dict Lost on Every Deploy

**What goes wrong:** The Flask app stores all session state in a Python dict (`sessions = {}` in routes.py line 50). Railway redeploys create a new container, destroying all in-memory state. Every deploy -- including automatic deploys triggered by git push -- wipes all active review sessions.

**Why it happens:** The architecture was designed for local development where the Flask process runs continuously. Containers are ephemeral. Railway redeploys create entirely new containers.

**Consequences:** Complete loss of all active sessions on every deploy. Uploaded documents, analysis results, review progress, and flags all disappear from the in-memory cache. The JSON files persist on the volume, but the app cannot find them because `sessions = {}` is empty.

**Prevention:**
1. Mount a Railway volume at `/app/app/data` to persist session JSON files and uploads.
2. On startup, scan `SESSION_FOLDER` and load existing session JSON files back into the `sessions` dict.
3. The `save_session()` function already writes to disk (routes.py line 60-70). The missing piece is a `load_all_sessions()` function called during `create_app()`.

**Detection:** Check if `sessions` dict is populated from disk on startup. Currently it is not.

**Confidence:** HIGH -- verified by reading routes.py line 50.

---

### Pitfall 3: Docker Build Fails on Python C Extensions (lxml, scikit-learn)

**What goes wrong:** `pip install` fails during Docker build because lxml and scikit-learn require C compilation tools that are not in slim Python images. Error: `error: command 'gcc' not found` or `fatal error: libxml/xmlversion.h: No such file or directory`.

**Why it happens:** The project requires `lxml` (via python-docx) and `scikit-learn` (TF-IDF matching). Both have C components. `python:3.12-slim` ships without build tools. Alpine is worse -- musl libc breaks prebuilt wheels entirely.

**Consequences:** Build fails completely. No deployment.

**Prevention:**
1. Use `python:3.12-slim` (NOT Alpine) as base image.
2. Multi-stage build: install gcc/g++/libxml2-dev/libxslt-dev in builder stage, copy only installed packages to runtime stage with just libxml2/libxslt1.1 runtime libs.
3. Most packages (numpy, scikit-learn) have prebuilt manylinux wheels for slim. Only lxml sometimes needs compilation.

**Detection:** Run `docker build` locally before pushing.

**Confidence:** HIGH -- lxml C extension requirements are extensively documented.

**Sources:**
- [GitHub: python-lxml Docker images](https://github.com/Logiqx/python-lxml)
- [Medium: lxml in multi-step Docker images](https://cr0hn.medium.com/lxml-in-multi-step-docker-images-243e11f4e9ac)

---

### Pitfall 4: Next.js Standalone Build Missing Static Assets

**What goes wrong:** You set `output: 'standalone'`, build the Docker image, deploy, and every page loads unstyled or with 404 errors on CSS/JS. The app appears completely broken.

**Why it happens:** Next.js standalone mode intentionally does NOT copy `public/` or `.next/static/` into the standalone output. This is documented behavior. The Dockerfile must explicitly copy these directories.

**Consequences:** App renders HTML but with no styles, no JavaScript interactivity, missing images.

**Prevention:** In the Dockerfile runner stage, always copy three things:
```dockerfile
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
```
Missing any one causes different failures:
- Missing standalone: nothing runs at all
- Missing static: no CSS, no JS bundles
- Missing public: favicons, images, public assets 404

**Detection:** After building locally, run the Docker image and check browser DevTools Network tab for 404s on `/_next/static/*` paths.

**Confidence:** HIGH -- single most common Next.js Docker issue.

**Sources:**
- [Next.js docs: output standalone (v16.1.6)](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)

---

### Pitfall 5: Next.js 16 Rewrites Bug in Standalone Mode

**What goes wrong:** You keep the existing `rewrites()` config in `next.config.ts` to proxy `/api/*` to the Flask backend. It works in `next dev` but returns HTTP 500 in production after `next build`.

**Why it happens:** Next.js 16 has a known regression where rewrites to external domains fail in standalone mode (GitHub issue #87071). A fix was submitted in PR #87244 but may not be in all releases. Even when fixed, rewrites are baked at build time -- the destination URL cannot change between environments without rebuilding.

**Consequences:** Every API call returns 500 in production. The app is non-functional despite working perfectly in local development.

**Prevention:**
1. Use `proxy.ts` instead of `rewrites()`. Next.js 16 renamed `middleware.ts` to `proxy.ts` and this is the officially recommended approach for request routing.
2. `proxy.ts` runs at request time and can read environment variables, making it environment-aware.
3. Remove the `rewrites()` block from `next.config.ts` entirely.

**Detection:** Test the production Docker build locally (`docker run`) and verify API calls succeed.

**Confidence:** HIGH -- confirmed in Next.js GitHub issue #87071, fix in PR #87244.

**Sources:**
- [Next.js 16 Rewrite Bug (#87071)](https://github.com/vercel/next.js/issues/87071)
- [Next.js Proxy Docs (v16.1.6)](https://nextjs.org/docs/app/getting-started/proxy)

---

### Pitfall 6: Railway Volume Data Written at Build Time Does Not Persist

**What goes wrong:** Your Dockerfile creates initial data or directories during `docker build`. After deploy, the volume mount overwrites those paths with the volume contents (empty if new).

**Why it happens:** Railway mounts volumes ONLY at runtime, not during build or pre-deploy. The mount "masks" whatever the Dockerfile put in that directory.

**Consequences:** Session directories, upload directories, or seed data disappear. App may crash trying to read expected paths.

**Prevention:**
1. Create directories at runtime in app startup code (already done: `mkdir(parents=True, exist_ok=True)` in server.py).
2. Never rely on build-time file creation for volume-mounted paths.

**Detection:** If `app/data/` is the volume mount, any `COPY` or `RUN mkdir` for paths under it will be invisible at runtime.

**Confidence:** HIGH -- stated in Railway volume documentation.

---

## Moderate Pitfalls

Mistakes that cause subtle bugs, degraded performance, or painful debugging.

---

### Pitfall 7: Gunicorn Worker Timeout Kills LLM Calls

**What goes wrong:** Gunicorn's default timeout is 30 seconds. A worker processing a Gemini API call that takes 2 minutes gets SIGKILL'd. The user sees a 502.

**Why it happens:** Gunicorn's arbiter monitors workers and kills any silent beyond the timeout. With sync workers, a blocked I/O call prevents the worker from heartbeating.

**Consequences:** Random 502 errors on LLM-powered endpoints. If timeout is set too high, a stuck worker is never reclaimed.

**Prevention:**
1. Use `--worker-class gthread --threads 4` so threads can handle concurrent requests while one thread waits on an LLM API call.
2. Set `--timeout 1800` (30 min) as a generous backstop. Railway's 15-min proxy timeout is the real ceiling.
3. Do NOT use `--timeout 0` (infinite) -- a genuinely stuck worker would never be reclaimed.
4. Set `--graceful-timeout 30` so workers being shut down during deploys have time to finish.

**Why gthread, not gevent:** The codebase uses `asyncio` (aiohttp, aiolimiter) for parallel Gemini calls. Gevent monkey-patches the event loop in ways that conflict with asyncio. gthread uses real OS threads, no conflicts.

**Detection:** Check Railway deploy logs for `[CRITICAL] WORKER TIMEOUT` messages.

**Confidence:** HIGH -- gunicorn timeout is the most common production issue.

**Sources:**
- [Gunicorn Issue #588: Worker timeouts after long requests](https://github.com/benoitc/gunicorn/issues/588)
- [Railway Community: Gunicorn worker timeouts](https://station.railway.com/questions/gunicorn-worker-timeouts-8cd90860)

---

### Pitfall 8: CORS Misconfiguration (If Flask Is Made Public)

**What goes wrong:** If Flask gets a public domain instead of being private-only, the browser blocks cross-origin API calls. The current CORS config allows `http://localhost:\d+` which does not match Railway domains.

**Why it happens:** Current Flask CORS is hardcoded to localhost patterns (server.py line 28). Production Railway domains are `https://*.up.railway.app`.

**Consequences:** Every API call from the browser fails with CORS errors.

**Prevention:**
1. Keep Flask private (no public domain). Next.js proxy.ts handles all routing server-side. No CORS needed.
2. If Flask must be public for any reason, update CORS to: `CORS(app, origins=[os.environ.get('FRONTEND_URL', r'http://localhost:\d+')])`.

**Detection:** Browser DevTools console shows CORS errors immediately.

**Confidence:** HIGH -- verified from codebase.

---

### Pitfall 9: Private Networking DNS Not Immediately Available

**What goes wrong:** The Next.js proxy.ts rewrites to `http://flask.railway.internal:8000`. Intermittently, DNS resolution fails with `ENOTFOUND`, especially on cold starts.

**Why it happens:** Railway's internal DNS uses WireGuard mesh. DNS resolution may not be immediately available when a container first starts. Legacy Railway environments (pre-October 2025) only support IPv6 internally, and Node.js may prefer IPv4.

**Consequences:** Intermittent API failures. Works sometimes, fails sometimes.

**Prevention:**
1. Ensure the Railway environment was created after October 2025 (dual-stack IPv4 + IPv6).
2. Add retry logic or a small startup delay for the first backend call.
3. Test private networking before relying on it -- fall back to public networking temporarily if needed.

**Detection:** Check Next.js server logs for `ENOTFOUND` errors on `.railway.internal` domains.

**Confidence:** MEDIUM -- documented in Railway private networking docs, not verified with this specific app.

---

### Pitfall 10: Healthcheck Fails Due to Slow Flask Startup

**What goes wrong:** Railway's default healthcheck timeout is 300 seconds (5 minutes). If scikit-learn import or session rehydration takes too long, the healthcheck never sees a 200 and Railway rolls back the deploy.

**Why it happens:** scikit-learn imports can take 5-15 seconds. Session rehydration from volume adds more time. Railway sends healthchecks from `healthcheck.railway.app` -- if Flask has host-based restrictions, it may reject the request.

**Consequences:** Deploy appears to build successfully but fails during "deploying" phase. Old version stays running.

**Prevention:**
1. The existing `/health` endpoint is lightweight (just returns `{'status': 'ok'}`). Keep it that way.
2. Lazy-load heavy imports (scikit-learn) -- only import when needed, not at module level.
3. Increase healthcheck timeout to 600s in service settings if needed.

**Detection:** Railway dashboard shows "Deploy failed" with healthcheck error.

**Confidence:** HIGH.

---

### Pitfall 11: Uploaded Documents Lost If Volume Mount Is Too Specific

**What goes wrong:** Volume mounted at `app/data/sessions/` instead of `app/data/`. Uploads in `app/data/uploads/` are on ephemeral container storage and lost on redeploy.

**Why it happens:** Railway allows only one volume per service. If mount point is too narrow, not all data directories are covered.

**Consequences:** Session JSON references file paths that no longer exist. Review sessions are corrupted.

**Prevention:** Mount at `/app/app/data` to cover BOTH `sessions/` and `uploads/` subdirectories.

**Confidence:** HIGH -- verified from project structure (server.py lines 32-37).

---

## Minor Pitfalls

Issues that waste time but are recoverable.

---

### Pitfall 12: NEXT_PUBLIC_ Prefix Requirement

**What goes wrong:** You set `BACKEND_URL` as a Railway variable. Client-side code references `process.env.BACKEND_URL`. It is always `undefined` in the browser.

**Why it happens:** Next.js only exposes env vars to client code if prefixed with `NEXT_PUBLIC_`. Variables without the prefix are server-side only.

**Consequences:** API calls go to wrong URL.

**Prevention:**
1. `BACKEND_URL` is server-side only (used in proxy.ts). This is correct -- no `NEXT_PUBLIC_` prefix needed.
2. The browser never needs to know the Flask URL because proxy.ts handles routing server-side.
3. Only prefix with `NEXT_PUBLIC_` if the value must be available in React components.

**Confidence:** HIGH -- fundamental Next.js behavior.

---

### Pitfall 13: Windows CRLF Line Endings in Docker

**What goes wrong:** Shell scripts or entrypoint files from Windows have `\r\n` endings. Linux Docker container fails with `\r: command not found`.

**Why it happens:** Git on Windows converts to CRLF (depending on `core.autocrlf`).

**Prevention:**
1. Add `.gitattributes`: `* text=auto` and `*.sh text eol=lf`.
2. Safety net in Dockerfile: `RUN sed -i 's/\r$//' /app/entrypoint.sh` (if using entrypoint scripts).

**Detection:** Container crashes immediately with `\r` in error message.

**Confidence:** HIGH -- universal Windows-to-Linux Docker pitfall.

---

### Pitfall 14: API Key Exposure in Docker Image Layers

**What goes wrong:** `.env` or `api.txt` with API keys gets copied into Docker image via `COPY . .`. Keys persist in image layers even if deleted later.

**Why it happens:** Docker images are layered. COPY followed by RUN rm does not remove from earlier layers.

**Consequences:** API key leak for anyone with Docker image access.

**Prevention:**
1. Add `.env`, `api.txt`, `*.key` to `.dockerignore`.
2. Use Railway environment variables for all secrets.
3. Never `COPY . .` without comprehensive `.dockerignore`.

**Detection:** `docker run <image> cat /app/.env` should return "file not found".

**Confidence:** HIGH -- fundamental Docker security.

---

### Pitfall 15: Railway Reference Variables Not Available at Build Time

**What goes wrong:** `${{flask.RAILWAY_PRIVATE_DOMAIN}}` used in Dockerfile or next.config.ts at build time. Variable is empty.

**Why it happens:** Railway reference variables resolve at runtime, not during Docker build.

**Consequences:** Next.js bakes empty strings into JavaScript bundle if `NEXT_PUBLIC_*` vars are absent at build.

**Prevention:**
1. `BACKEND_URL` is read at runtime by proxy.ts, not baked into the build. This is correct.
2. Do not use `NEXT_PUBLIC_*` for the backend URL -- it is server-side only.
3. For any vars needed at build time, set them as plain Railway variables (not reference variables).

**Confidence:** MEDIUM -- Railway docs confirm reference vars are runtime-resolved.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dockerize Flask backend | C extension build failures (Pitfall 3) | Multi-stage build with gcc in builder stage; test locally first |
| Dockerize Next.js frontend | Missing static assets (Pitfall 4) | Three-line COPY pattern; test with `docker run` locally |
| Replace rewrites with proxy.ts | Next.js 16 rewrites bug (Pitfall 5) | Use proxy.ts, remove rewrites(), test locally |
| Railway volume setup | Upload + session on single volume (Pitfalls 6, 11) | Mount at `/app/app/data`, verify both subdirs persist |
| Gunicorn configuration | Worker timeouts on LLM calls (Pitfall 7) | gthread workers, 1800s timeout, NOT gevent |
| Service networking | DNS resolution timing (Pitfall 9) | Test private networking; fall back to public if needed |
| Long-running analysis | Railway 15-min HTTP timeout (Pitfall 1) | Background job pattern for large documents (defer) |
| Session persistence | In-memory dict loss (Pitfall 2) | Rehydrate from volume on startup |
| Secret management | API key in Docker layer (Pitfall 14) | .dockerignore + Railway env vars |
| Initial deploy | Healthcheck failures (Pitfall 10) | Lightweight /health (exists); lazy-load scikit-learn |

## Sources

- [Railway Volumes](https://docs.railway.com/reference/volumes)
- [Railway Private Networking](https://docs.railway.com/reference/private-networking)
- [Railway Healthchecks](https://docs.railway.com/reference/healthchecks)
- [Railway Dockerfile Builds](https://docs.railway.com/builds/dockerfiles)
- [Railway Help Station: HTTP Timeout](https://station.railway.com/questions/increase-max-http-timeout-1c360bf9)
- [Next.js Output Standalone (v16.1.6)](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- [Next.js 16 Rewrite Bug (#87071)](https://github.com/vercel/next.js/issues/87071)
- [Next.js Proxy (v16.1.6)](https://nextjs.org/docs/app/getting-started/proxy)
- [Gunicorn Issue #588: Worker timeouts](https://github.com/benoitc/gunicorn/issues/588)
- [Gunicorn Docker Guide](https://gunicorn.org/guides/docker/)
