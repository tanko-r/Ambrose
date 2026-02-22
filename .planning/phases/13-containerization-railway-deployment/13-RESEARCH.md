# Phase 13: Containerization + Railway Deployment - Research

**Researched:** 2026-02-22
**Domain:** Docker containerization, Railway deployment, Next.js standalone, gunicorn production config
**Confidence:** HIGH (all major claims verified against official Railway docs and Next.js docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — user delegated all implementation decisions to Claude.

### Claude's Discretion

**Railway service topology:**
- Number of Railway services (backend, frontend, Postgres)
- Monorepo vs separate service configuration
- Shared PostgreSQL plugin setup
- Volume mount strategy for persistent file storage

**Docker build strategy:**
- Multi-stage builds vs single-stage
- Base image selection (python:slim, node:alpine, etc.)
- Build caching and layer optimization
- Dev vs prod Dockerfile differences (if any)

**Environment variable design:**
- Which variables are required vs optional
- Naming conventions and grouping
- How secrets (API keys, Clerk keys, DATABASE_URL) are injected
- Defaults for local development to maintain zero-config `python run.py` + `npm run dev`

**Health checks + monitoring:**
- Health endpoint implementation (/api/health, /api/version)
- Railway restart policy configuration
- Logging strategy (stdout/stderr, structured vs plain)
- What the version endpoint returns (git SHA, build date, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCK-01 | Backend runs in Docker container with gunicorn gthread workers | Gunicorn gthread config; multi-stage Python Dockerfile pattern |
| DOCK-02 | Frontend runs in Docker container with Next.js standalone output | Next.js `output: 'standalone'` in next.config; official multi-stage Dockerfile |
| DOCK-03 | docker-compose.yml enables local integration testing of both services | docker-compose pattern with healthcheck + depends_on; postgres service |
| DOCK-04 | .dockerignore files prevent node_modules, .git, and data dirs from bloating images | Standard .dockerignore patterns documented |
| CONF-04 | Local development workflow (python run.py + npm run dev) works unchanged | All env vars have localhost defaults; Docker is additive, not replacing dev |
| RAIL-01 | railway.toml config files for both services with health checks and restart policy | railway.toml syntax verified; healthcheckPath, restartPolicyType documented |
| RAIL-02 | Backend uses persistent volume for uploads and session files | Railway Volumes docs; mount path = /app/data; RAILWAY_VOLUME_MOUNT_PATH env var |
| RAIL-03 | Version endpoint provides git info via env vars (no .git in container) | Current endpoint uses subprocess git; must switch to GIT_COMMIT + GIT_BRANCH env vars |
| RAIL-04 | Railway PostgreSQL plugin configured with DATABASE_URL auto-injection | Railway Postgres auto-injects DATABASE_URL; Flask already reads this |
</phase_requirements>

---

## Summary

This phase containerizes the Flask backend and Next.js frontend into Docker images and deploys both services to Railway alongside a Railway-managed PostgreSQL database. The primary technical work is writing Dockerfiles, a docker-compose for local integration testing, railway.toml configs for each service, and patching a handful of runtime vs build-time issues that arise in containerized deployments.

The most important discovery is a **critical issue with Next.js rewrites**: `process.env` values in `next.config.ts` rewrites are read at **build time**, not runtime. The current `NEXT_PUBLIC_BACKEND_URL` variable in `next.config.ts` will be frozen to its value when the Docker image is built. In Railway, the backend internal URL must be known at build time, OR the rewrite destination must be constructed using Railway reference variables injected as Docker build args. The recommended solution: pass `BACKEND_URL` (renamed from `NEXT_PUBLIC_BACKEND_URL`) as a Docker build ARG so it is baked in at image build time. On Railway, services can reference each other via `${{backend.RAILWAY_PRIVATE_DOMAIN}}` and a fixed PORT.

The project already has the correct structure: `DATA_DIR` env var controls all file storage (CONF-02 complete), `DATABASE_URL` env var drives the DB connection (reads SQLite in dev, PostgreSQL in prod), and `CORS_ORIGINS` is already env-var-driven. The `/health` endpoint already exists in `app/server.py`. The only new work for the backend is: write a Dockerfile, fix the `/api/version` endpoint to read env vars instead of running `git`, and add railway.toml.

**Primary recommendation:** Use two Railway services (backend + frontend) + Railway PostgreSQL plugin + one Railway Volume on the backend service mounted at `/app/data`. Both services deploy from the monorepo with separate Dockerfiles via `RAILWAY_DOCKERFILE_PATH` service variable.

---

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| gunicorn | latest (in requirements.txt) | WSGI server for Flask in production | Industry standard; gthread worker avoids asyncio.run conflicts (already decided) |
| python:3.12-slim | Docker Hub | Flask container base image | Minimal footprint; glibc-based (psycopg2-binary requires glibc); security patched |
| node:22-alpine (build) | Docker Hub | Next.js build stage | Alpine reduces image size; LTS version |
| node:22-alpine (runtime) | Docker Hub | Next.js runtime | Standalone output only needs Node runtime |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|---|---|---|---|
| docker-compose v3.8 | CLI tool | Local multi-service dev integration | Testing containerized stack before Railway deploy |
| railway CLI | latest | Deploy, log-tailing, volume management | Setup and debugging |
| Railway PostgreSQL plugin | managed | Cloud Postgres | Auto-injects DATABASE_URL; no infrastructure management |
| Railway Volume | managed | Persistent file storage | Backend uploads, sessions, analysis JSON blobs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| python:3.12-slim | python:3.12-alpine | Alpine lacks glibc; psycopg2-binary + scikit-learn have native extensions requiring glibc — do NOT use Alpine for backend |
| gunicorn gthread | uvicorn/gunicorn with gevent | gevent conflicts with asyncio.run() used in parallel_analyzer.py — already locked out |
| Railway Volume | Railway Buckets (S3-compatible) | Buckets require boto3 client code changes; Volume is drop-in with DATA_DIR; defer Buckets until scaling |
| Docker multi-stage | Single-stage Dockerfile | Multi-stage is significantly smaller (no build tools in final image); always prefer multi-stage |

**No installation needed** — gunicorn must be added to requirements.txt (not currently present); everything else is infrastructure.

---

## Architecture Patterns

### Railway Service Topology (Recommended)

```
Railway Project
├── backend service          # Flask (Dockerfile.backend)
│   ├── PostgreSQL plugin    # Auto-injects DATABASE_URL
│   └── Volume → /app/data   # Persistent uploads + sessions
├── frontend service         # Next.js (Dockerfile.frontend)
│   └── depends on backend via private networking
└── (No separate postgres service needed — use plugin)
```

**Monorepo configuration:** Both services deploy from the same GitHub repo. Each service has:
- Different root directory OR different `RAILWAY_DOCKERFILE_PATH` service variable
- Separate `railway.toml` in their respective subdirectory

Railway config files do NOT follow the Root Directory path — they must be at the absolute path specified.

### Recommended File Structure

```
/ (project root)
├── Dockerfile.backend           # Backend multi-stage Python build
├── Dockerfile.frontend          # Frontend multi-stage Node build
├── docker-compose.yml           # Local integration testing
├── .dockerignore                # Root-level (catches both services)
├── railway.toml                 # Backend Railway config (in repo root)
├── app/
│   ├── server.py                # Already has /health endpoint
│   ├── api/routes.py            # /api/version needs env var fix
│   └── data/                    # Dev-only; Railway uses Volume
├── frontend/
│   ├── railway.toml             # Frontend Railway config
│   ├── next.config.ts           # Add output: 'standalone'
│   └── .dockerignore            # Frontend-specific
└── migrations/                  # Alembic migrations (included in backend image)
```

### Pattern 1: Flask Multi-Stage Dockerfile (Recommended)

**What:** Two-stage build — install deps in full Python image, copy to slim runtime image
**When to use:** Always for production Python containers

```dockerfile
# Dockerfile.backend
# ── Stage 1: builder ──────────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /build

# Install build deps (needed for psycopg2-binary, scikit-learn wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM python:3.12-slim AS runtime
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY run.py .
# Do NOT copy: venv/, app/data/, .git/, node_modules/, testdocs/, output/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

EXPOSE 5000

# Gunicorn: 2 workers, 4 threads (gthread), heartbeat in /dev/shm
CMD ["gunicorn", \
     "--workers=2", \
     "--threads=4", \
     "--worker-class=gthread", \
     "--worker-tmp-dir=/dev/shm", \
     "--bind=0.0.0.0:5000", \
     "--log-file=-", \
     "--timeout=120", \
     "app.server:create_app()"]
```

**Key details:**
- `--worker-tmp-dir=/dev/shm` — prevents block I/O delays that cause heartbeat failures in containers
- `--log-file=-` — sends gunicorn logs to stdout/stderr (required for Railway log collection)
- `--timeout=120` — allow long-running analysis requests (LLM calls can take 30-60s)
- `create_app()` callable pattern — gunicorn supports factory functions

### Pattern 2: Next.js Multi-Stage Dockerfile with Standalone Output

**What:** Three-stage build — deps → build → minimal runtime with standalone output
**When to use:** All containerized Next.js deployments

```dockerfile
# Dockerfile.frontend
# ── Stage 1: deps ────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --frozen-lockfile

# ── Stage 2: builder ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .

# BACKEND_URL is baked in at build time (see critical pitfall below)
ARG BACKEND_URL=http://localhost:5000
ENV NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL}

RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Standalone output includes minimal server + all required files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

**Required change to `frontend/next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',   // ADD THIS — enables standalone mode
  // ... rest unchanged
};
```

### Pattern 3: railway.toml — Backend

```toml
# railway.toml (project root — for backend service)
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.backend"

[deploy]
startCommand = "gunicorn --workers=2 --threads=4 --worker-class=gthread --worker-tmp-dir=/dev/shm --bind=0.0.0.0:${PORT} --log-file=- --timeout=120 'app.server:create_app()'"
preDeployCommand = ["flask", "db", "upgrade"]
healthcheckPath = "/health"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**Note on preDeployCommand:** Runs in the built container before starting the app. Volumes are NOT mounted during pre-deploy — this is fine since `flask db upgrade` only needs DATABASE_URL, not the data volume. The command must exit 0 or deployment aborts.

**Note on startCommand:** The CMD in the Dockerfile provides a fallback; railway.toml startCommand takes precedence on Railway. Both should be consistent.

### Pattern 4: railway.toml — Frontend

```toml
# frontend/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.frontend"
# BACKEND_URL is a Railway reference variable — set in service variables:
# BACKEND_URL = ${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}

[deploy]
startCommand = "node server.js"
healthcheckPath = "/"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Pattern 5: docker-compose.yml — Local Integration Testing

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: redlining
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d redlining -t 1"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/redlining
      DATA_DIR: /app/data
      CORS_ORIGINS: http://localhost:3000
      # Set secrets via .env file or export in shell:
      # GEMINI_API_KEY, CLERK_FRONTEND_API_URL, etc.
    volumes:
      - backend_data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
    # Run migrations before starting (docker-compose equivalent of preDeployCommand)
    command: >
      sh -c "flask db upgrade && gunicorn --workers=2 --threads=4
             --worker-class=gthread --worker-tmp-dir=/dev/shm
             --bind=0.0.0.0:5000 --log-file=- --timeout=120
             'app.server:create_app()'"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        BACKEND_URL: http://backend:5000
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    depends_on:
      backend:
        condition: service_healthy

volumes:
  postgres_data:
  backend_data:
```

### Pattern 6: .dockerignore Files

**Root `.dockerignore`** (used by Dockerfile.backend):
```
# Python
venv/
__pycache__/
*.pyc
*.pyo
.pytest_cache/

# Data (use Volume in prod, dev data stays local)
app/data/
output/
testdocs/
fixtures/
instance/

# Frontend (not needed in backend image)
frontend/
node_modules/

# Git (no .git in containers — use env vars for version info)
.git/
.gitignore

# Planning/docs
.planning/
tasks/
docs/
pm-reports/
qa-reports/
user_testing/

# Build artifacts
*.egg-info/
dist/
build/
```

**`frontend/.dockerignore`**:
```
node_modules/
.next/
*.md
.env*
```

### Pattern 7: Version Endpoint Fix

The current `/api/version` endpoint uses subprocess to run `git` — this fails in Docker containers since `.git` is excluded. Fix: read from environment variables set at deploy time.

**Updated endpoint in `app/api/routes.py`:**
```python
@api_bp.route('/version', methods=['GET'])
def get_version():
    """Get version info from env vars (no .git in container)."""
    import os
    return jsonify({
        'branch': os.environ.get('GIT_BRANCH', 'unknown'),
        'commit': os.environ.get('GIT_COMMIT', 'unknown'),
    })
```

Railway provides `RAILWAY_GIT_BRANCH` and `RAILWAY_GIT_COMMIT_SHA` automatically. Map these to the expected env var names in railway.toml service variables or use them directly.

### Anti-Patterns to Avoid

- **Alpine base for Python backend:** Alpine lacks glibc. `psycopg2-binary` and `scikit-learn` ship pre-compiled wheels that require glibc. Use `python:3.12-slim` (Debian-based).
- **Single-stage Dockerfile:** Includes gcc, build headers, pip cache in final image — unnecessarily large (~800MB vs ~200MB).
- **Hardcoding internal Railway URLs:** Use Railway reference variables (`${{service.RAILWAY_PRIVATE_DOMAIN}}`) so URLs are configured by Railway, not hardcoded.
- **Volumes mounted during pre-deploy:** Railway docs explicitly state volumes are NOT available during pre-deploy. Run migrations in preDeployCommand (which is fine — only needs DATABASE_URL), mount volume in start command context.
- **`NEXT_PUBLIC_` prefix for server-side-only variables:** The backend URL used in next.config.ts rewrites is server-side only. Do NOT expose it as `NEXT_PUBLIC_` — pass it as a build ARG instead.
- **`gevent` worker class:** conflicts with `asyncio.run()` in parallel_analyzer.py. Already decided: use `gthread`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| DB migration at deploy time | Custom startup script | `flask db upgrade` in preDeployCommand | Built into Flask-Migrate; already in codebase |
| Persistent storage | Custom backup scripts | Railway Volume at /app/data | Drop-in with DATA_DIR env var; Railway manages persistence |
| Health checking | Custom watchdog | Railway healthcheckPath + restartPolicyType | Built into Railway; integrates with deployment pipeline |
| Internal service URLs | Hardcoded IPs | Railway reference variables + private networking | DNS-based; survives redeployments |
| Docker image registry | Self-hosted registry | Railway builds from GitHub automatically | Zero infrastructure; Railway triggers build on push |

**Key insight:** Railway handles the container registry, build triggers, health monitoring, SSL, and DNS — the only work is writing the Dockerfiles and railway.toml configs.

---

## Common Pitfalls

### Pitfall 1: Next.js Rewrite Destination is Build-Time Only

**What goes wrong:** `process.env.NEXT_PUBLIC_BACKEND_URL` in `next.config.ts` rewrites() is evaluated when `next build` runs (i.e., during Docker image build), not at container startup. If you set `BACKEND_URL` as a Railway service variable, it will NOT be picked up at runtime for rewrites.

**Why it happens:** Next.js compiles `next.config.ts` at build time. The `rewrites()` function is called during the build phase to generate the routing table — not dynamically at request time.

**How to avoid:** Pass `BACKEND_URL` as a Docker `ARG` in `Dockerfile.frontend`. In Railway, set `BACKEND_URL` as a build argument (via service variable `BACKEND_URL = ${{backend.RAILWAY_PRIVATE_DOMAIN}}:5000`). The Railway documentation confirms build-time ARGs can reference Railway-injected variables.

**Warning signs:** Requests to `/api/*` in the deployed frontend return 502 or ECONNREFUSED — the rewrite is pointing to `localhost:5000` (the baked-in dev default).

**Important nuance:** The variable should NOT have `NEXT_PUBLIC_` prefix since it's only used server-side in rewrites. Rename `NEXT_PUBLIC_BACKEND_URL` → `BACKEND_URL` in `next.config.ts` for clarity, and pass it as a build ARG only.

### Pitfall 2: python:alpine Breaks psycopg2-binary and scikit-learn

**What goes wrong:** Build succeeds but container crashes at runtime with `ImportError: libpq.so.5` or similar glibc errors.

**Why it happens:** Alpine Linux uses musl libc, not glibc. Pre-compiled wheels for psycopg2-binary and scikit-learn bundle glibc assumptions.

**How to avoid:** Use `python:3.12-slim` (Debian-based, has glibc). Never use `python:3.12-alpine` for this project.

**Warning signs:** `pip install` succeeds but importing `psycopg2` crashes at runtime.

### Pitfall 3: Version Endpoint Fails in Container

**What goes wrong:** `/api/version` crashes or returns `unknown` because there is no `.git` directory in the Docker image (excluded by `.dockerignore`).

**Why it happens:** Current implementation uses `subprocess.check_output(['git', ...])` — git isn't installed in the container and `.git` isn't present.

**How to avoid:** Fix the endpoint to read `GIT_BRANCH` and `GIT_COMMIT` env vars (set these in Railway service variables using `${{RAILWAY_GIT_BRANCH}}` and `${{RAILWAY_GIT_COMMIT_SHA}}`).

**Warning signs:** Header shows `unknown/unknown` for branch/commit in production UI.

### Pitfall 4: Gunicorn Worker Timeout on Long Analysis Requests

**What goes wrong:** Analysis requests (which can run 30-60s for LLM calls) time out with Gunicorn's default 30s worker timeout, killing the connection.

**Why it happens:** Gunicorn default `--timeout=30`. Long-running LLM API calls exceed this.

**How to avoid:** Set `--timeout=120` in the gunicorn command. Note: analysis already runs async (returns immediately with job ID per ASYNC-01), but the LLM call itself runs in a background thread. The HTTP request that kicks it off should still be fast, but be safe with 120s.

**Warning signs:** 502 Bad Gateway on analysis start requests; Gunicorn logs show `[CRITICAL] WORKER TIMEOUT`.

### Pitfall 5: Railway Volume Not Mounted During Pre-Deploy

**What goes wrong:** Pre-deploy command tries to create directories or read files on the volume — fails silently or with permission errors.

**Why it happens:** Railway explicitly states volumes are not mounted during preDeployCommand execution.

**How to avoid:** Only run `flask db upgrade` in preDeployCommand. The Flask app's `create_app()` handles data directory creation on startup (already in `server.py`).

**Warning signs:** First deployment succeeds but volume data paths missing; file upload fails.

### Pitfall 6: FLASK_APP Not Set for flask db upgrade

**What goes wrong:** `flask db upgrade` in preDeployCommand fails with `Error: Could not locate a Flask application`.

**Why it happens:** Flask CLI needs to find the application. Without `FLASK_APP` env var or an `app.py` at the root, it can't discover the app.

**How to avoid:** Set `FLASK_APP=app.server:create_app` as an environment variable in the Railway backend service. Alternative: use `python -m flask db upgrade` with FLASK_APP set.

**Warning signs:** Deployment aborts at pre-deploy stage with Flask discovery error.

### Pitfall 7: docker-compose depends_on Without Healthcheck

**What goes wrong:** Backend starts before Postgres is ready, migration fails with `connection refused`.

**Why it happens:** `depends_on` without `condition: service_healthy` only waits for the container to start, not for Postgres to accept connections.

**How to avoid:** Always use `depends_on: postgres: condition: service_healthy` combined with a proper healthcheck on the postgres service.

---

## Code Examples

### Flask app.server:create_app() gunicorn callable pattern

```python
# gunicorn can call create_app() factory:
# gunicorn "app.server:create_app()"
# This works because gunicorn evaluates the callable at startup.
# Source: gunicorn docs — callable factory pattern
```

### Railway Reference Variables in Service Variables

In the Railway dashboard, set these service variables on the **frontend** service:
```
BACKEND_URL = ${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}
```

Railway resolves `${{service.VARIABLE}}` at deploy time before passing to the build/container.

Source: https://docs.railway.com/variables/reference

### Railway-provided git variables for version endpoint

In Railway backend service variables:
```
GIT_BRANCH  = ${{RAILWAY_GIT_BRANCH}}
GIT_COMMIT  = ${{RAILWAY_GIT_COMMIT_SHA}}
```

Railway automatically provides `RAILWAY_GIT_BRANCH` and `RAILWAY_GIT_COMMIT_SHA` — no manual configuration needed beyond mapping them to the names the endpoint expects.

### flask db upgrade invocation (correct FLASK_APP setup)

```bash
# In railway.toml preDeployCommand — requires FLASK_APP set in service vars
FLASK_APP=app.server:create_app

# railway.toml
[deploy]
preDeployCommand = ["flask", "db", "upgrade"]
```

### Next.js output: standalone in next.config.ts

```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',   // enables .next/standalone for Docker
  turbopack: {
    root: __dirname,      // existing
  },
  async rewrites() {
    // BACKEND_URL is injected as build ARG — evaluated at build time
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

**Note:** Variable renamed from `NEXT_PUBLIC_BACKEND_URL` to `BACKEND_URL` because it's server-side only (rewrites run on the Next.js server, not in the browser). No `NEXT_PUBLIC_` prefix needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| nixpacks.toml for Railway config | railway.toml (config-as-code) | Railway introduced railway.toml as primary config | Use railway.toml — more expressive, git-versioned |
| Separate Dockerfile per service directory | `RAILWAY_DOCKERFILE_PATH` service variable | Railway feature | Supports monorepo with Dockerfiles at root |
| Nixpacks auto-detection | `builder = "DOCKERFILE"` explicit | Always an option | Explicit Dockerfiles give full control over build |
| Single gunicorn sync worker | gthread worker class + threads | gunicorn feature, long-standing | Better for I/O-bound Flask with background threads |

**Deprecated/outdated:**
- `nixpacks.toml`: Still works but railway.toml is the canonical config-as-code format per Railway docs
- `python:3.x` (full image) as base: Use `python:3.x-slim` — full image is ~1GB vs ~130MB for slim

---

## Open Questions

1. **Railway Build ARG injection for `BACKEND_URL`**
   - What we know: Railway service variables can reference other services (`${{backend.RAILWAY_PRIVATE_DOMAIN}}`); ARG values are injected at build time; this is documented behavior
   - What's unclear: Whether Railway correctly substitutes reference variables in build args vs runtime vars — needs verification during actual Railway setup
   - Recommendation: Test with a simple `echo $BACKEND_URL` in Dockerfile builder stage first; fallback is to hardcode the Railway internal hostname pattern (`backend.railway.internal:5000`) since it's predictable

2. **gunicorn + create_app() factory string syntax**
   - What we know: gunicorn supports callable factory pattern with `"module:factory()"` syntax
   - What's unclear: Exact syntax needed for `app.server:create_app()` vs `app.server:create_app` vs running from `/app` workdir
   - Recommendation: Use `--chdir /app` + `app.server:create_app()` — test in docker-compose before Railway deploy

3. **Railway preDeployCommand array vs string syntax**
   - What we know: railway.toml docs show `preDeployCommand = ["npm run db:migrate"]` as array format
   - What's unclear: Whether multi-word commands need to be a flat string or can be array of tokens
   - Recommendation: Use `["flask", "db", "upgrade"]` (array of tokens per docs example) and verify with Railway CLI before production

---

## Sources

### Primary (HIGH confidence)
- https://docs.railway.com/reference/config-as-code — railway.toml syntax, healthcheckPath, restartPolicyType, preDeployCommand, builder options
- https://docs.railway.com/volumes — Volume mount paths, constraints (not during pre-deploy), RAILWAY_VOLUME_MOUNT_PATH
- https://docs.railway.com/databases/postgresql — DATABASE_URL auto-injection, connection variables
- https://docs.railway.com/guides/private-networking — service.railway.internal hostnames, private networking
- https://docs.railway.com/guides/pre-deploy-command — preDeployCommand behavior, failure semantics
- https://docs.railway.com/guides/monorepo — Monorepo patterns, RAILWAY_DOCKERFILE_PATH
- https://nextjs.org/docs/app/getting-started/deploying — Official Next.js deployment guide, standalone mode
- https://nextjs.org/docs/app/guides/self-hosting — Docker patterns, environment variables, build vs runtime
- https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites — Rewrites are build-time configuration (confirmed)

### Secondary (MEDIUM confidence)
- https://pythonspeed.com/articles/gunicorn-in-docker/ — Gunicorn Docker config (--worker-tmp-dir /dev/shm, --log-file=-, multiple workers)
- https://github.com/vercel/next.js/discussions/33932 — Community confirmation that rewrites are build-time only
- https://docs.railway.com/variables/reference — Reference variable syntax `${{service.VAR}}`

### Tertiary (LOW confidence)
- Multiple Railway Help Station threads confirming NEXT_PUBLIC_ + Docker issues (community support, unverified against official docs but consistent pattern)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — official docs confirm all tool choices; psycopg2-binary/glibc constraint verified
- Architecture: HIGH — Railway topology, railway.toml syntax, and Volume behavior all from official Railway docs
- Pitfalls: HIGH for #1 (rewrites build-time), #2 (alpine/glibc), #3 (version endpoint), #5 (volume during pre-deploy) — all from official docs; MEDIUM for #4, #6, #7 — from community sources + general knowledge

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (Railway deploys frequently; re-check railway.toml schema if issues arise)
