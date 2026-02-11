# Architecture Patterns: Railway Deployment

**Domain:** Cloud deployment of Flask + Next.js monorepo to Railway
**Researched:** 2026-02-11

## Recommended Architecture

### Two-Service Monorepo on Railway

Deploy as **two separate Railway services** from the same GitHub repo, communicating over Railway's private network via encrypted WireGuard tunnels.

```
                     Internet
                        |
           +------------+------------+
           |                         |
     [Next.js Service]         [Flask Service]
     Public domain:            Private only (no public domain)
     app.railway.app           flask.railway.internal:8000
     :3000                     :8000
           |                         |
           +--- Private Network -----+
                (WireGuard mesh)
                                     |
                              [Railway Volume]
                              mounted at /app/app/data
```

**Key decision:** The Next.js service is the **only publicly exposed service**. The Flask backend is private-only, accessed exclusively via Railway's internal DNS (`flask.railway.internal`). This eliminates CORS complexity entirely -- the Next.js proxy/rewrite handles all API routing server-side.

**Confidence:** HIGH -- Railway's monorepo support and private networking are well-documented and widely used.

### Component Boundaries

| Component | Responsibility | Communicates With | Public? |
|-----------|---------------|-------------------|---------|
| Next.js Service | Serves frontend, proxies /api/* to Flask | Flask (private network) | YES -- public domain |
| Flask Service | API endpoints, LLM analysis, file processing | Gemini API, Anthropic API, disk (volume) | NO -- private only |
| Railway Volume | Persistent storage for sessions + uploads | Flask (mounted filesystem) | NO |

### Data Flow

1. Browser hits `https://app.railway.app/api/intake` (public Next.js domain)
2. Next.js rewrites `/api/*` to `http://flask.railway.internal:8000/api/*` (private network, plain HTTP)
3. Flask processes request, writes to mounted volume at `/app/app/data/`
4. Flask calls Gemini/Anthropic APIs for LLM analysis (outbound HTTPS)
5. Response flows back through Next.js to browser

### Why This Architecture

**Private Flask eliminates CORS entirely.** Currently the app uses `flask-cors` with `r"http://localhost:\d+"`. In production with private networking, the browser never talks to Flask directly. Next.js proxies everything server-side. No CORS headers needed. The existing CORS config stays for local dev, does no harm in production.

**Railway private networking is zero-config.** Services in the same project automatically get internal DNS names (`service-name.railway.internal`). No VPN setup, no port mapping. Just use `http://` (not `https://`) for internal calls.

**Monorepo with root directory isolation.** Railway detects this as a monorepo and lets you set a different root directory per service. The Flask service gets root `/` (since `app/` is a Python package, not a standalone directory), and the Next.js service gets root `frontend/`.

---

## Patterns to Follow

### Pattern 1: Next.js Proxy via `proxy.ts` (replaces `rewrites`)

**What:** Use Next.js 16's new `proxy.ts` file (renamed from `middleware.ts`) to rewrite `/api/*` requests to the Flask backend over private networking.

**When:** Always in production. The current `next.config.ts` rewrites approach has a known bug in Next.js 16 standalone mode (GitHub issue #87071 -- rewrites to external domains return 500 in production). The `proxy.ts` approach is the officially recommended replacement.

**Why:** Rewrites in `next.config.ts` are baked in at build time. `proxy.ts` runs at request time and can read environment variables, making it environment-aware without rebuilding.

**Example:**
```typescript
// frontend/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, BACKEND_URL)
    return NextResponse.rewrite(url)
  }
}

export const config = {
  matcher: '/api/:path*',
}
```

**Local dev:** `BACKEND_URL=http://localhost:5000` (default, no env var needed)
**Railway production:** `BACKEND_URL=http://flask.railway.internal:8000` (set as Railway env var on the Next.js service)

**Confidence:** HIGH -- this is the documented Next.js 16 approach. The old `rewrites` config can be removed from `next.config.ts`.

### Pattern 2: Next.js Standalone Output for Docker

**What:** Enable `output: 'standalone'` in `next.config.ts` to produce a self-contained build at `.next/standalone` that includes only needed `node_modules` files.

**Why:** Standard Next.js Docker images are 400MB+ with full `node_modules`. Standalone output produces a minimal `server.js` that can run without `npm install` in the final Docker stage, resulting in ~150-200MB images.

**Caveats (verified from official docs, Next.js 16.1.6):**
- The standalone output does NOT copy `public/` or `.next/static/`. These must be manually copied in the Dockerfile.
- The minimal `server.js` serves these automatically once copied to the right locations.
- `PORT` and `HOSTNAME` environment variables must be set before running `server.js`.
- `next.config.ts` is baked in at build time (serialized into `server.js`).

**Example `next.config.ts` addition:**
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... existing config
}
```

**Confidence:** HIGH -- standalone output is stable since Next.js 12, well-documented for Docker.

### Pattern 3: Python `slim` Base Image (Not Alpine)

**What:** Use `python:3.12-slim` as the Docker base image for Flask, not Alpine.

**Why:** This project depends on `lxml` (transitive dependency via `python-docx`), `scikit-learn` (requires numpy C extensions), and `redlines`. Alpine uses `musl` libc which causes:
- Extremely slow compilation of C extensions (lxml, numpy, scipy)
- Potential runtime segfaults with numpy/scipy on musl
- Need for `gcc`, `g++`, `libxml2-dev`, `libxslt-dev`, `gfortran`, `openblas-dev` just to build

`python:3.12-slim` uses glibc, has prebuilt wheels for all these packages on PyPI, and installs in seconds instead of minutes. The image is ~130MB base vs Alpine's ~50MB, but after adding all the build deps Alpine needs, the difference disappears.

**Confidence:** HIGH -- this is universally recommended for Python projects with C extensions.

### Pattern 4: Gunicorn with `gthread` Workers for Long-Running LLM Calls

**What:** Configure Gunicorn with the `gthread` worker class, high timeout, and limited workers.

**Why:** The analysis endpoint (`GET /api/analysis/<session_id>`) makes synchronous calls to Claude/Gemini APIs that take 5-30+ minutes. With default Gunicorn sync workers and 30s timeout, these requests get killed. The `gthread` worker type allows a single worker process to handle multiple requests via threads, and the I/O-bound nature of LLM API calls means threads spend most of their time waiting.

**Configuration (`gunicorn.conf.py`):**
```python
import os

# Single-user app, minimal workers needed
workers = int(os.environ.get('WEB_CONCURRENCY', 2))
threads = int(os.environ.get('PYTHON_MAX_THREADS', 4))
worker_class = 'gthread'

# Long-running LLM calls need high timeout
timeout = int(os.environ.get('GUNICORN_TIMEOUT', 1800))  # 30 minutes
graceful_timeout = 30

# Railway provides PORT
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# Log to stdout for Railway log collection
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Prevent memory leaks over time
max_requests = 100
max_requests_jitter = 10
```

**Why `gthread` over `gevent`:** The codebase uses `asyncio` (via `aiohttp` and `aiolimiter`) for parallel Gemini calls within `parallel_analyzer.py`. Gevent monkey-patches the event loop in ways that can conflict with asyncio. `gthread` uses real OS threads which coexist cleanly with asyncio.

**Why 1800s timeout:** Analysis calls take 5-30+ minutes. Setting `timeout=0` (infinite) is tempting but dangerous -- a stuck worker would never be reclaimed. 30 minutes is a reasonable upper bound. If analysis takes longer, the architecture should shift to background tasks (a future concern, not MVP).

**Confidence:** HIGH -- Gunicorn gthread + high timeout is standard for I/O-bound Flask apps. Multiple Railway community posts confirm this pattern.

### Pattern 5: Railway Volume for Persistent File Storage

**What:** Attach a Railway volume to the Flask service, mounted at `/app/app/data`.

**Why:** The app stores uploaded `.docx` files and session JSON files in `app/data/uploads/` and `app/data/sessions/`. Without a volume, these are lost on every redeployment (Railway containers are ephemeral). The volume persists across deploys.

**Mount path rationale:** The Dockerfile uses `WORKDIR /app` and copies the entire project. Flask's `create_app()` sets paths relative to `Path(__file__).parent`, which resolves to `/app/app/`. The data directory is `/app/app/data/`. So the volume mount must be `/app/app/data`.

**Volume limits (Railway Hobby plan):** 5GB max, 3000 IOPS. More than sufficient for a single-user tool with .docx files (each ~100KB-2MB) and JSON sessions (~500KB-5MB).

**Gotcha: Brief downtime on redeploy.** Railway prevents multiple deployments from mounting the same volume simultaneously. This causes ~5-10 seconds of downtime during each deploy. Acceptable for a single-user tool.

**Gotcha: One volume per service.** Cannot split uploads and sessions to separate volumes. Not needed here since both are small.

**Confidence:** HIGH -- Railway volume documentation is explicit about mount behavior and limits.

### Pattern 6: Environment-Variable-Driven Configuration

**What:** All secrets and environment-specific config via Railway environment variables. No `.env` file in the Docker image.

**Current state:** The app loads API keys via `python-dotenv` with `load_dotenv()` fallback in every service file. This pattern is fine -- `load_dotenv()` is a no-op when no `.env` file exists and environment variables are already set. No code changes needed.

**Railway env vars to set:**

| Variable | Service | Value |
|----------|---------|-------|
| `GEMINI_API_KEY` | Flask | (API key) |
| `ANTHROPIC_API_KEY` | Flask | (API key) |
| `PORT` | Flask | `8000` (Railway auto-sets this) |
| `BACKEND_URL` | Next.js | `http://flask.railway.internal:8000` |
| `PORT` | Next.js | `3000` (Railway auto-sets this) |
| `HOSTNAME` | Next.js | `0.0.0.0` |

**The `.env` file MUST be in `.gitignore`** (it already is). It contains real API keys. Docker build context should also exclude it via `.dockerignore`.

**Confidence:** HIGH -- standard practice, no code changes needed.

---

## Docker Configuration

### Flask Dockerfile (`Dockerfile.flask`)

```dockerfile
# === Build stage ===
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies for C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
RUN pip install --no-cache-dir --prefix=/install gunicorn

# === Runtime stage ===
FROM python:3.12-slim

WORKDIR /app

# Runtime deps only (libxml2, libxslt for lxml)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 \
    libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create data directories (volume mount point)
RUN mkdir -p /app/app/data/uploads /app/app/data/sessions

# Gunicorn config
COPY gunicorn.conf.py .

EXPOSE 8000

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.server:create_app()"]
```

**Multi-stage rationale:** The build stage installs `gcc`, `g++`, `libxml2-dev`, `libxslt-dev` which are needed to compile lxml and scikit-learn wheels. The runtime stage only needs the shared libraries (`libxml2`, `libxslt1.1`). This keeps the final image ~400MB instead of ~700MB.

**Note:** `scikit-learn` and `numpy` have prebuilt manylinux wheels on PyPI for `python:3.12-slim`, so they may not need the build deps at all. But `lxml` sometimes does. The build stage is defensive.

### Next.js Dockerfile (`Dockerfile.frontend`)

```dockerfile
# === Dependencies ===
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# === Build ===
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (BACKEND_URL not needed at build time for proxy.ts)
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# === Runtime ===
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output + static files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Alpine is fine for Node.js.** Unlike Python, Node.js has no musl compatibility issues. The Alpine image is 180MB vs 400MB for `node:22-slim`.

**No `npm install` in runtime stage.** The standalone output includes everything needed. This is the key size optimization.

### `.dockerignore`

```
.env
.git
.planning/
node_modules/
.next/
__pycache__/
*.pyc
app/data/sessions/
app/data/uploads/
output/
test_output/
test documents/
*.docx
*.doc
*.pdf
```

---

## Railway Service Configuration

### Config as Code (`railway.toml` in project root)

Railway does not natively support two `railway.toml` files for a monorepo from a single root. Instead, configure each service via the Railway dashboard:

**Flask Service Settings:**
- Root Directory: `/` (project root, since `app/` is a Python package import)
- Dockerfile Path: `Dockerfile.flask`
- Watch Paths: `app/**`, `requirements.txt`, `Dockerfile.flask`, `gunicorn.conf.py`
- Volume: Mount `/app/app/data` with 1GB initial size
- Healthcheck: `/health` with 60s timeout
- No public domain (private only)

**Next.js Service Settings:**
- Root Directory: `frontend/`
- Dockerfile Path: `Dockerfile.frontend` (relative to root directory, so actually `frontend/Dockerfile.frontend`)
- Watch Paths: `frontend/**`
- Healthcheck: `/` with 30s timeout
- Public domain: Generate Railway domain

**Important:** Set `RAILWAY_DOCKERFILE_PATH` as an environment variable on each service if the dashboard's Dockerfile field does not support paths outside the root directory. For the Flask service with root `/`, set `RAILWAY_DOCKERFILE_PATH=Dockerfile.flask`. For the Next.js service with root `frontend/`, the Dockerfile needs to be at `frontend/Dockerfile.frontend` or use `RAILWAY_DOCKERFILE_PATH`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Single Combined Dockerfile
**What:** Putting both Flask and Next.js in one Docker image.
**Why bad:** Defeats Railway's independent scaling, watch paths, and deploy isolation. A Python code change triggers a Node.js rebuild. Image becomes huge.
**Instead:** Two services, two Dockerfiles, independent deploys.

### Anti-Pattern 2: Public Flask Backend with CORS
**What:** Giving Flask its own public domain and configuring CORS for cross-origin requests.
**Why bad:** CORS is a constant source of bugs (preflight failures, missing headers, credential handling). Adds attack surface. Unnecessarily exposes the API.
**Instead:** Keep Flask private. Next.js proxies everything. Zero CORS needed in production.

### Anti-Pattern 3: Alpine Base Image for Python
**What:** Using `python:3.12-alpine` to save image size.
**Why bad:** `lxml`, `numpy`, and `scikit-learn` require C compilation on Alpine (musl). Build takes 10+ minutes, requires 1GB+ RAM, and musl can cause runtime issues with scipy/numpy. After adding build deps, Alpine is no smaller than slim.
**Instead:** Use `python:3.12-slim` with multi-stage build.

### Anti-Pattern 4: `timeout=0` in Gunicorn
**What:** Disabling worker timeout entirely for long-running analysis.
**Why bad:** A genuinely stuck worker (deadlock, infinite loop, leaked connection) will never be reclaimed. Over time, all workers get stuck and the service becomes unresponsive.
**Instead:** Set a generous but finite timeout (1800s). If requests regularly exceed this, implement background task processing.

### Anti-Pattern 5: Baking API Keys into Docker Image
**What:** Copying `.env` into the Docker image or using `ENV` directives for secrets.
**Why bad:** Keys are visible in Docker image layers, `docker inspect`, and potentially in CI logs.
**Instead:** Use Railway's environment variables UI. Add `.env` to `.dockerignore`.

### Anti-Pattern 6: Using `next.config.ts` Rewrites for Production Proxying
**What:** Relying on the existing `rewrites()` config to proxy `/api/*` to Flask in production.
**Why bad:** Known bug in Next.js 16 standalone mode (issue #87071) where rewrites to external domains return 500. Even when fixed, rewrites are baked at build time and cannot adapt to different environments.
**Instead:** Use `proxy.ts` (formerly `middleware.ts`) which runs at request time and can read env vars.

---

## What Changes vs. What Stays

### Files to CREATE

| File | Purpose |
|------|---------|
| `Dockerfile.flask` | Multi-stage Docker build for Flask backend |
| `frontend/Dockerfile.frontend` | Multi-stage Docker build for Next.js frontend |
| `gunicorn.conf.py` | Gunicorn production configuration |
| `.dockerignore` | Exclude secrets, data, dev files from Docker context |
| `frontend/proxy.ts` | Next.js 16 proxy for /api/* routing to backend |

### Files to MODIFY

| File | Change | Why |
|------|--------|-----|
| `frontend/next.config.ts` | Add `output: 'standalone'` | Required for Docker standalone build |
| `frontend/next.config.ts` | Remove `rewrites()` block | Replaced by `proxy.ts`, buggy in standalone mode |
| `app/server.py` | No changes needed | Already reads `PORT` from env, `create_app()` is gunicorn-compatible |
| `requirements.txt` | Add `gunicorn` | Production WSGI server |

### Files that STAY THE SAME

| File | Why It's Fine |
|------|---------------|
| `app/server.py` | `create_app()` factory pattern works with gunicorn. `PORT` already read from env. |
| `app/api/routes.py` | All session/file logic uses `current_app.config` paths, which resolve correctly in container |
| `app/services/*.py` | `load_dotenv()` is no-op when env vars already set. No changes needed. |
| `frontend/src/**` | All frontend code unchanged. API calls go to `/api/*` relative paths. |
| `.env` | Stays for local dev, excluded from Docker via `.dockerignore` |

---

## Scalability Considerations

| Concern | Current (1 user) | At 5 users | At 50+ users |
|---------|-------------------|------------|--------------|
| Session storage | In-memory dict + JSON files | Same (volume-backed) | Redis or PostgreSQL needed |
| File uploads | Local filesystem | Same (volume-backed) | S3/R2 object storage needed |
| Analysis concurrency | 1 request blocks worker for 5-30 min | Workers exhaust quickly | Background task queue (Celery/Redis) |
| LLM API rate limits | Not an issue | Possible Gemini rate limiting | Need queue + retry logic |
| Railway volume | 1GB sufficient | 2-3GB | 5GB+, or move to object storage |

**For the current single-user MVP, none of these are concerns.** The architecture above handles single-user deployment cleanly. Multi-user scaling would require a separate milestone.

---

## Build Order (Suggested Phase Sequence)

1. **Add gunicorn + gunicorn.conf.py** -- No Docker yet, test gunicorn locally
2. **Create `.dockerignore`** -- Prevent secrets from entering image
3. **Create `Dockerfile.flask`** -- Build and test Flask image locally with `docker build`
4. **Add `output: 'standalone'` to next.config.ts** -- Test `next build` produces standalone output
5. **Create `proxy.ts`** -- Replace rewrites, test locally (should still hit localhost:5000)
6. **Remove `rewrites()` from next.config.ts** -- Proxy.ts now handles routing
7. **Create `Dockerfile.frontend`** -- Build and test Next.js image locally
8. **Test both containers locally with `docker compose`** -- Verify inter-service communication
9. **Deploy to Railway** -- Create project, two services, set env vars, attach volume
10. **Verify end-to-end** -- Upload a document, run analysis, check volume persistence

**Rationale:** Each step can be tested independently. Docker images are built and verified locally before touching Railway. The proxy.ts migration (steps 5-6) is the riskiest change and should be validated in dev before combining with Docker.

---

## Sources

- [Railway Private Networking](https://docs.railway.com/reference/private-networking) -- internal DNS, WireGuard mesh, `service.railway.internal` format
- [Railway Volumes](https://docs.railway.com/reference/volumes) -- mount paths, plan limits, redeployment behavior, IOPS
- [Railway Monorepo Deployment](https://docs.railway.com/guides/monorepo) -- root directory, watch paths, isolated vs shared monorepos
- [Railway Dockerfile Builds](https://docs.railway.com/builds/dockerfiles) -- RAILWAY_DOCKERFILE_PATH, build args, cache mounts
- [Railway Config as Code](https://docs.railway.com/config-as-code/reference) -- railway.toml fields, healthcheck, restart policy
- [Railway Flask Guide](https://docs.railway.com/guides/flask) -- Gunicorn setup, Procfile, Railpack detection
- [Railway Healthchecks](https://docs.railway.com/reference/healthchecks) -- 300s default timeout, 3600s max, healthcheck.railway.app hostname
- [Next.js Output Config (v16.1.6)](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output) -- standalone mode, public/static copying, PORT/HOSTNAME
- [Next.js Proxy (v16.1.6)](https://nextjs.org/docs/app/getting-started/proxy) -- renamed from middleware, proxy.ts convention, rewrite pattern
- [Next.js Backend for Frontend (v16.1.6)](https://nextjs.org/docs/app/guides/backend-for-frontend) -- route handlers, proxying to backend, catch-all routes
- [Next.js 16 Rewrite Bug (#87071)](https://github.com/vercel/next.js/issues/87071) -- standalone mode rewrites returning 500
- [Gunicorn Docker Guide](https://gunicorn.org/guides/docker/) -- worker config, timeout, max-requests, non-root user
- [Gunicorn 2026 Updates](https://gunicorn.org/2026-news/) -- Dirty Arbiters for long-running ops, ASGI streaming fixes
- [Railway Gunicorn Timeout Issues](https://station.railway.com/questions/gunicorn-worker-timeouts-8cd90860) -- community reports, workarounds
- [lxml Multi-Stage Docker](https://cr0hn.medium.com/lxml-in-multi-step-docker-images-243e11f4e9ac) -- build deps vs runtime deps separation
