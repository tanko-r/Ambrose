# Phase 9: Railway Deployment

**Goal:** Make the app deployable to Railway as a two-service project (Flask backend + Next.js frontend) while preserving local dev workflow.

**Created:** 2026-02-11
**Status:** Pending

---

## Context

The app has two services — Flask backend (:5000) and Next.js frontend (:3000) — currently running locally only. Three issues must be fixed for cloud deployment:

1. **In-memory sessions** — `sessions = {}` dict in routes.py dies on server restart
2. **Hardcoded URLs** — `http://localhost:5000` in api.ts and next.config.ts
3. **No production server** — Flask dev server not suitable for production

---

## Tasks

### Task 1: Add gunicorn to requirements.txt

**File:** `requirements.txt`

- Add `gunicorn>=21.2.0` (production WSGI server for Linux/Railway)
- Local dev on Windows continues using `python run.py` (gunicorn is Linux-only)

---

### Task 2: Make session loading resilient to restarts

**File:** `app/api/routes.py` — `get_session()` (line ~53)

Currently returns `None` if session not in memory dict. Change: if session not in memory, check disk (`SESSION_FOLDER/{id}.json`), auto-load it, and restore `parsed_doc` from `parsed_doc_path`.

Also exclude `parsed_precedent` from `save_session()` serialization (line ~67) to keep session files smaller.

```python
def get_session(session_id):
    """Get session data, auto-loading from disk if not in memory."""
    if session_id in sessions:
        return sessions[session_id]

    # Try loading from disk
    session_path = current_app.config['SESSION_FOLDER'] / f'{session_id}.json'
    if not session_path.exists():
        return None

    with open(session_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Restore parsed_doc from saved path
    parsed_doc_path = data.get('parsed_doc_path')
    if parsed_doc_path:
        p = Path(_normalize_path(parsed_doc_path))
        if p.exists():
            with open(p, 'r', encoding='utf-8') as f:
                data['parsed_doc'] = json.load(f)

    sessions[session_id] = data
    return data
```

For `save_session()`, exclude both `parsed_doc` and `parsed_precedent`:

```python
serializable = {k: v for k, v in data.items() if k not in ('parsed_doc', 'parsed_precedent')}
```

---

### Task 3: Make data directories configurable via env var

**File:** `app/server.py` (lines 32-33)

Replace hardcoded `Path(__file__).parent / 'data'` with `os.environ.get('DATA_DIR', ...)`.

```python
data_dir = Path(os.environ.get('DATA_DIR', str(Path(__file__).parent / 'data')))
app.config['UPLOAD_FOLDER'] = data_dir / 'uploads'
app.config['SESSION_FOLDER'] = data_dir / 'sessions'
```

On Railway: set `DATA_DIR=/data` and mount a persistent volume at `/data`.
Locally: defaults to `app/data/` as before (no behavior change).

---

### Task 4: Make CORS origins configurable

**File:** `app/server.py` (line 28)

Replace hardcoded `r"http://localhost:\d+"` with env-var-driven list.

```python
cors_env = os.environ.get('CORS_ORIGINS')
if cors_env:
    origins = [o.strip() for o in cors_env.split(',')]
else:
    origins = [r"http://localhost:\d+"]
CORS(app, origins=origins)
```

`CORS_ORIGINS` env var: comma-separated list of allowed origins.
Falls back to `http://localhost:*` regex for local dev.

---

### Task 5: Make frontend backend URL configurable

**File:** `frontend/src/lib/api.ts` (line 8)

```typescript
const FLASK_DIRECT = process.env.NEXT_PUBLIC_FLASK_URL || 'http://localhost:5000';
```

`NEXT_PUBLIC_` prefix makes it available in the browser bundle.

**File:** `frontend/next.config.ts` (line 11)

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.FLASK_INTERNAL_URL || 'http://localhost:5000'}/api/:path*`,
      },
    ];
  },
};
```

Add `output: 'standalone'` for smaller Docker images.

---

### Task 6: Create backend Dockerfile

**New file:** `Dockerfile` (repo root)

```dockerfile
FROM python:3.12-slim

# System deps for lxml/python-docx
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libxml2-dev libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY run.py .
COPY fixtures/ fixtures/

# Data directory (mount a volume here in production)
RUN mkdir -p /data/uploads /data/sessions

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "1800", "--workers", "1", "--threads", "4", "--worker-class", "gthread", "app.server:create_app()"]
```

Notes:
- Long timeout (30 min) because analysis can take 5-30+ minutes
- Single worker + 4 threads: analysis is I/O-bound (LLM API calls), not CPU-bound
- `fixtures/` copied for any seed data

---

### Task 7: Create frontend Dockerfile

**New file:** `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG FLASK_INTERNAL_URL=http://backend:5000
ARG NEXT_PUBLIC_FLASK_URL=http://localhost:5000

ENV FLASK_INTERNAL_URL=$FLASK_INTERNAL_URL
ENV NEXT_PUBLIC_FLASK_URL=$NEXT_PUBLIC_FLASK_URL

RUN npm run build

# --- Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
```

Multi-stage build: Node 20 builder + slim runner.
Uses standalone output — copies `.next/standalone`, `.next/static`, `public`.

---

### Task 8: Create docker-compose.yml for local testing

**New file:** `docker-compose.yml`

```yaml
version: "3.8"

services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATA_DIR=/data
      - CORS_ORIGINS=http://localhost:3000,http://frontend:3000
      - PORT=5000
    env_file:
      - .env
    volumes:
      - ./app/data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    build:
      context: ./frontend
      args:
        FLASK_INTERNAL_URL: http://backend:5000
        NEXT_PUBLIC_FLASK_URL: http://localhost:5000
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
    depends_on:
      backend:
        condition: service_healthy
```

Notes:
- Backend mounts `./app/data` as `/data` volume
- Frontend depends on backend health check
- Uses `.env` file for API keys (ANTHROPIC_API_KEY, GOOGLE_API_KEY)

---

### Task 9: Create Railway config files

**New file:** `railway.toml` (backend)

```toml
[build]
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**New file:** `frontend/railway.toml` (frontend)

```toml
[build]
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

---

### Task 10: Update .gitignore

**File:** `.gitignore`

Add:
```
# Docker
docker-compose.override.yml

# Railway
.railway/
```

---

### Task 11: Handle `/api/version` in containers

**File:** `app/api/routes.py` — version endpoint

Add env var fallback (`GIT_COMMIT`, `GIT_BRANCH`) since `.git/` isn't in the Docker image. The existing `try/except` already handles this gracefully, but env vars give accurate info in containers.

```python
# In version endpoint:
commit = os.environ.get('GIT_COMMIT', '')
branch = os.environ.get('GIT_BRANCH', '')
if not commit:
    # existing git subprocess logic
    ...
```

---

## Railway Setup (Manual, after code changes)

1. Create Railway project, add two services both pointing to your GitHub repo
2. Backend: root `/`, config `/railway.toml`, watch paths `/app/**,/requirements.txt,/Dockerfile`
3. Frontend: root `/frontend`, config `/frontend/railway.toml`, watch paths `/frontend/**`
4. Attach persistent volume to backend at `/data` (5GB)
5. Set env vars:
   - **Backend:** `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `DATA_DIR=/data`, `PORT=5000`, `CORS_ORIGINS=https://<frontend-domain>,http://localhost:3000`
   - **Frontend:** `FLASK_INTERNAL_URL=http://<backend-private-domain>:5000`, `NEXT_PUBLIC_FLASK_URL=https://<backend-public-domain>`, `PORT=3000`
6. Generate public domains for both services
7. Deploy

---

## Verification

1. **Local (no Docker):** `python run.py` + `cd frontend && npm run dev` — confirm nothing broke
2. **Local (Docker):** `docker-compose up --build` — confirm both services start and communicate
3. **Session persistence:** Start Docker, upload a doc, restart backend container, verify session auto-loads
4. **Railway:** Deploy, upload a document, run analysis, generate a revision, export Word doc
5. **Long-running ops:** Verify analysis doesn't timeout (gunicorn 30-min timeout)

---

## Files Summary

| File | Action |
|------|--------|
| `requirements.txt` | Modify — add gunicorn |
| `app/server.py` | Modify — configurable DATA_DIR, CORS_ORIGINS |
| `app/api/routes.py` | Modify — auto-load sessions from disk, env-var version |
| `frontend/src/lib/api.ts` | Modify — env-var FLASK_DIRECT |
| `frontend/next.config.ts` | Modify — standalone output, env-var rewrite dest |
| `Dockerfile` | Create — backend image |
| `frontend/Dockerfile` | Create — frontend image |
| `docker-compose.yml` | Create — local Docker dev |
| `railway.toml` | Create — backend Railway config |
| `frontend/railway.toml` | Create — frontend Railway config |
| `.gitignore` | Modify — add Docker/Railway entries |
