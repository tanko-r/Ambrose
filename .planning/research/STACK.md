# Technology Stack: Railway Deployment

**Project:** Contract Redlining Tool -- Cloud Deployment
**Researched:** 2026-02-11
**Overall confidence:** HIGH

## Recommended Stack

### Production WSGI Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| gunicorn | latest (23.x+) | Production WSGI server for Flask | Industry standard for Flask. Pre-fork worker model handles concurrent requests. Required because Flask dev server is single-threaded and not production-safe. |
| gthread worker class | (gunicorn built-in) | Thread-based worker for I/O-bound requests | LLM API calls are I/O-bound (5-30+ minutes waiting on Gemini/Claude). gthread uses OS threads that release the GIL during I/O waits, allowing one worker process to handle multiple concurrent requests. |

**Why gthread, not gevent:** The codebase uses `asyncio` via `aiohttp` and `aiolimiter` in `parallel_analyzer.py`. Gevent monkey-patches the event loop in ways that conflict with asyncio's event loop. gthread uses real OS threads which coexist cleanly with asyncio. No monkey-patching, no surprises.

**Configuration:** `gunicorn --worker-class gthread --threads 4 --workers 2 --timeout 1800 --bind 0.0.0.0:$PORT app.server:create_app()`

- `--timeout 1800` (30 min): Analysis calls take 5-30 min. Railway enforces a hard 15-minute HTTP timeout at the proxy layer, so this is generous but prevents stuck workers from being permanent.
- `--workers 2`: Single-user app. 2 workers provide resilience if one is handling a long request.
- `--threads 4`: Each worker handles 4 concurrent requests via threads. Sufficient for single user with progress polling.

**CRITICAL NOTE -- Railway HTTP Timeout:** Railway enforces a hard 15-minute platform-level HTTP request timeout. This is not configurable. Any synchronous HTTP request exceeding 15 minutes gets killed by Railway's edge proxy regardless of gunicorn settings. Analysis endpoints that could exceed 15 minutes should eventually be refactored to a background job pattern (POST to start, poll for status). For the MVP deployment, most analyses complete within 15 minutes; longer documents may need the background pattern later.

**Why not alternatives:**
- **gevent:** Monkey-patches the event loop, conflicts with existing asyncio usage in parallel_analyzer.py. Would require refactoring async code.
- **waitress:** Cross-platform but lower concurrency than gthread. Only advantage is Windows support, irrelevant in Docker.
- **uvicorn/granian:** ASGI servers for async frameworks. Flask is WSGI. Would require rewriting to FastAPI.

### Docker Base Images

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| python:3.12-slim-bookworm | 3.12 | Backend base image | 130MB base. Bookworm (Debian 12) LTS through 2028. Has prebuilt manylinux wheels for lxml, numpy, scikit-learn. No C compilation needed for most packages. |
| node:22-alpine | 22 LTS | Frontend base image | Alpine is smallest Node base (~50MB). Node 22 LTS supported through April 2027. Only used in build + runtime stages for standalone output. |

**Multi-stage build strategy:**
- **Backend:** Two-stage build. Builder stage installs gcc/g++/libxml2-dev for any C extensions that lack prebuilt wheels. Runtime stage copies only installed packages + runtime libs (libxml2, libxslt1.1). Expected image size: ~400-500MB.
- **Frontend:** Three-stage build (deps -> build -> run). Build produces standalone output. Runtime copies only `.next/standalone`, `.next/static`, and `public/`. Expected image size: ~150MB.

### Next.js Production Configuration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js standalone output | 16.1.x | Minimal production server | `output: "standalone"` produces a self-contained `server.js` + minimal node_modules. No full `npm install` in production. Reduces Docker image by 60%+. |
| proxy.ts | 16.1.x | API request routing to Flask backend | Next.js 16 renamed middleware.ts to proxy.ts. Runs at request time, reads env vars. Replaces the `rewrites()` config which has a known bug in standalone mode (GitHub #87071). |

**Required changes to `next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  output: "standalone",  // NEW: enables minimal production build
  turbopack: { root: __dirname },
  // REMOVE the rewrites() block entirely -- proxy.ts handles routing
};
```

**New file `frontend/proxy.ts`:**
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      BACKEND_URL
    )
    return NextResponse.rewrite(url)
  }
}

export const config = {
  matcher: '/api/:path*',
}
```

**Why proxy.ts over rewrites:**
1. Next.js 16 standalone mode has a known bug where rewrites to external domains return 500 (GitHub issue #87071, fix in PR #87244 but may not be in all releases).
2. Rewrites are baked at build time -- the destination URL cannot change between environments without rebuilding.
3. proxy.ts runs at request time and can read runtime environment variables, making it environment-aware.
4. proxy.ts is the officially recommended approach in Next.js 16 documentation.

### Railway Configuration

| Technology | Purpose | Why |
|------------|---------|-----|
| Railway Private Networking | Service-to-service comms | Frontend rewrites API calls to Flask via `http://flask.railway.internal:8000`. Encrypted via WireGuard. No public exposure of backend. No CORS needed. |
| Railway Volumes | Persistent file storage | Session data and uploaded .docx files need persistence across deploys. Mount at `/app/app/data`. Hobby plan: 5GB limit. Pro plan: 50GB. |
| Railway Environment Variables | Secrets + config management | API keys injected at runtime. Never in Docker images. Railway's UI handles per-service variables. |

### Health Check Configuration

| Component | Endpoint | Purpose |
|-----------|----------|---------|
| Backend | `GET /health` -> 200 | Already exists in `app/server.py`. Railway queries during deploy. |
| Frontend | `GET /` -> 200 | Next.js serves the app shell on `/`. No custom health endpoint needed. |

### Railway CLI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Railway CLI | Latest | Local deploy, env management | Install via `npm i -g @railway/cli`. Commands: `railway login`, `railway link`, `railway up`, `railway logs`. |

## New Dependencies (Backend)

```
# Add to requirements.txt
gunicorn>=22.0.0
```

No other new Python dependencies needed. All existing deps are production-ready.

**Note:** gunicorn only runs on Unix. It will NOT install on Windows. This is fine because it is only used inside the Docker container (Linux). Local Windows development continues to use `python run.py` (Flask dev server).

## New Dependencies (Frontend)

No new npm dependencies. `output: "standalone"` is built-in. `proxy.ts` uses only `next/server` imports.

## File Additions Summary

| File | Purpose |
|------|---------|
| `Dockerfile.flask` (project root) | Backend Docker image: Python 3.12 slim + gunicorn + gthread |
| `frontend/Dockerfile.frontend` | Frontend Docker image: Node 22 alpine multi-stage + standalone output |
| `gunicorn.conf.py` (project root) | Gunicorn production config: workers, threads, timeout, binding |
| `.dockerignore` (project root) | Exclude .git, node_modules, .venv, app/data, .env, api.txt |
| `frontend/proxy.ts` | Next.js 16 API proxy: routes /api/* to Flask backend |

### File Modifications

| File | Change |
|------|--------|
| `frontend/next.config.ts` | Add `output: "standalone"`, remove `rewrites()` block |
| `requirements.txt` | Add `gunicorn>=22.0.0` |

### Backend: `Dockerfile.flask`

```dockerfile
# === Build stage ===
FROM python:3.12-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies for C extensions (lxml, scikit-learn)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libxml2-dev libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# === Runtime stage ===
FROM python:3.12-slim-bookworm

WORKDIR /app

# Runtime libraries only (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ ./app/
COPY run.py .
COPY gunicorn.conf.py .

# Create data directory (volume mount point in production)
RUN mkdir -p /app/app/data/uploads /app/app/data/sessions

EXPOSE 8000

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.server:create_app()"]
```

### Frontend: `frontend/Dockerfile.frontend`

```dockerfile
FROM node:22-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Gunicorn Configuration: `gunicorn.conf.py`

```python
import os

# Single-user app: minimal workers, threads for concurrent I/O
workers = int(os.environ.get('WEB_CONCURRENCY', 2))
threads = int(os.environ.get('PYTHON_MAX_THREADS', 4))
worker_class = 'gthread'

# Long-running LLM calls: 30 min timeout
# Railway enforces 15-min HTTP timeout at proxy layer, so this is the backstop
timeout = int(os.environ.get('GUNICORN_TIMEOUT', 1800))
graceful_timeout = 30

# Railway provides PORT env var
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# Log to stdout for Railway log collection
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Prevent memory leaks over time
max_requests = 100
max_requests_jitter = 10
```

### Backend: `.dockerignore`

```
.git
.venv
__pycache__
*.pyc
node_modules
frontend/
.env
.env.*
api.txt
*.key
app/data/
.planning/
tasks/
output/
test_output/
test documents/
*.docx
*.doc
*.pdf
```

## Railway Project Setup

### Service Architecture

```
Railway Project: "contract-redlining"
  |
  +-- Service: "flask" (or "backend")
  |     Root directory: / (project root)
  |     Dockerfile: Dockerfile.flask
  |     Public domain: NONE (private only)
  |     Private domain: flask.railway.internal
  |     Volume: mounted at /app/app/data
  |     Env vars:
  |       GEMINI_API_KEY=<secret>
  |       ANTHROPIC_API_KEY=<secret>
  |
  +-- Service: "frontend"
        Root directory: /frontend
        Dockerfile: Dockerfile.frontend
        Public domain: *.up.railway.app (user-facing)
        Volume: NONE
        Env vars:
          BACKEND_URL=http://flask.railway.internal:8000
```

### Environment Variables to Set in Railway Dashboard

| Variable | Service | Value | Notes |
|----------|---------|-------|-------|
| `GEMINI_API_KEY` | flask | Your API key | Secret |
| `ANTHROPIC_API_KEY` | flask | Your API key | Secret |
| `BACKEND_URL` | frontend | `http://flask.railway.internal:8000` | Private networking URL for proxy.ts |
| `HOSTNAME` | frontend | `0.0.0.0` | Required for Next.js standalone server |

**PORT note:** Railway auto-injects a `PORT` env var. The `gunicorn.conf.py` reads `PORT` from env with default `8000`. Next.js standalone server reads `PORT` from env with default `3000`. Both work with Railway's auto-injection.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Worker class | gthread | gevent | Codebase uses asyncio (aiohttp, aiolimiter). Gevent monkey-patches event loop, conflicts with asyncio. |
| Worker class | gthread | sync | Sync workers handle 1 request at a time. A 30-min analysis blocks everything. |
| API routing | proxy.ts | next.config.ts rewrites | Known bug in Next.js 16 standalone (issue #87071). Rewrites baked at build time. |
| API routing | proxy.ts | Caddy reverse proxy | Adds third service. Unnecessary for single-user. Next.js proxies natively. |
| Python image | python:3.12-slim | python:3.12-alpine | Alpine musl breaks scikit-learn/numpy wheels. Forces C compilation. |
| Node image | node:22-alpine | node:22-slim | Alpine is smaller. No C extension issues in Node.js. |
| Backend exposure | Private only | Public with CORS | CORS is bug-prone. Private networking eliminates it entirely. |
| Storage | Railway volume | S3/R2 | Volume is simpler for single-user. No SDK, no presigned URLs. |
| Hosting | Railway | Fly.io / Render | Railway has best monorepo support, zero-config private networking, volume support. |
| Background tasks | threading.Thread (later) | Celery + Redis | Celery adds 2-3 services. Over-engineering for single user. |

## Local Development Preservation

The deployment stack must not break the existing local dev workflow:

| Concern | Solution |
|---------|----------|
| `python run.py` still works | gunicorn is production-only; run.py uses Flask dev server |
| `npm run dev` still works | `output: "standalone"` only affects `npm run build`. Dev server unaffected |
| API proxy still works locally | proxy.ts defaults `BACKEND_URL` to `http://localhost:5000` when env var unset |
| No Docker required locally | Dockerfiles are for Railway deployment only |
| gunicorn install fails on Windows | Expected and harmless. Only used in Docker (Linux) |

## Cost Estimate (Railway Hobby Plan)

| Resource | Cost | Notes |
|----------|------|-------|
| Subscription | $5/mo | Includes $5 usage credit |
| Backend compute | ~$3-5/mo | 2 workers, mostly idle between reviews |
| Frontend compute | ~$1-2/mo | Lightweight Node.js server |
| Volume storage | ~$0.50/mo | 1-2GB typical for document uploads |
| **Estimated total** | **$5-12/mo** | Most usage covered by $5 credit |

## Sources

- [Railway Config as Code Reference](https://docs.railway.com/config-as-code/reference) -- HIGH confidence
- [Railway Dockerfile Builds](https://docs.railway.com/builds/dockerfiles) -- HIGH confidence
- [Railway Volumes Reference](https://docs.railway.com/reference/volumes) -- HIGH confidence
- [Railway Private Networking](https://docs.railway.com/reference/private-networking) -- HIGH confidence
- [Railway Healthchecks](https://docs.railway.com/reference/healthchecks) -- HIGH confidence
- [Railway Monorepo Guide](https://docs.railway.com/guides/monorepo) -- HIGH confidence
- [Railway Flask Guide](https://docs.railway.com/guides/flask) -- HIGH confidence
- [Gunicorn Docker Guide](https://gunicorn.org/guides/docker/) -- HIGH confidence
- [Gunicorn 2026 News](https://gunicorn.org/2026-news/) -- HIGH confidence
- [Next.js Output Standalone Docs (v16.1.6)](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output) -- HIGH confidence
- [Next.js Proxy Docs (v16.1.6)](https://nextjs.org/docs/app/getting-started/proxy) -- HIGH confidence
- [Next.js Backend for Frontend (v16.1.6)](https://nextjs.org/docs/app/guides/backend-for-frontend) -- HIGH confidence
- [Next.js 16 Rewrite Bug (#87071)](https://github.com/vercel/next.js/issues/87071) -- HIGH confidence
- [lxml Docker Multi-Stage](https://cr0hn.medium.com/lxml-in-multi-step-docker-images-243e11f4e9ac) -- HIGH confidence
