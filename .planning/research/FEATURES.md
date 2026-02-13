# Feature Landscape: Railway Deployment

**Domain:** Cloud deployment of Flask + Next.js two-service application
**Researched:** 2026-02-11
**Overall confidence:** HIGH

## Table Stakes

Features required for a functional deployment. Missing = deployment fails or is unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Dockerfiles for both services** | Railway needs containerized builds. Railpack auto-detect unreliable for monorepos with mixed Python + Node.js | Medium | `Dockerfile.flask` (multi-stage Python) + `frontend/Dockerfile.frontend` (multi-stage Node) |
| **Production WSGI server (Gunicorn)** | Flask dev server is single-threaded, crashes under concurrency | Low | Add gunicorn to requirements.txt. gthread worker class for I/O-bound LLM calls |
| **Next.js standalone output** | Reduces Docker image from ~1GB to ~150MB. Required for non-Vercel Docker hosting | Low | Add `output: 'standalone'` to next.config.ts |
| **proxy.ts API routing** | Next.js 16 renamed middleware.ts to proxy.ts. Replaces rewrites() which has a bug in standalone mode (GitHub #87071). Routes /api/* to Flask over private network | Medium | New file: `frontend/proxy.ts`. Reads BACKEND_URL env var at runtime. Removes need for rewrites config |
| **Environment variable externalization** | API keys must not be in repo or Docker image. Railway manages env vars per service | Low | Already uses `os.getenv()` with dotenv fallback. Set vars in Railway dashboard |
| **Railway persistent volume** | Sessions + uploads stored as files in `app/data/`. Without volume, all data lost on every deploy | Medium | Mount at `/app/app/data`. Hobby plan: 5GB. Covers sessions/ and uploads/ |
| **Private networking (Flask internal only)** | Eliminates CORS entirely. Next.js proxies /api/* server-side to Flask | Low | Flask gets no public domain. DNS: `flask.railway.internal:8000`. Zero config |
| **Health check endpoint** | Railway uses healthchecks to verify deploy success | Low | Already exists at `/health`. Just configure in service settings |
| **.dockerignore file** | Prevents secrets (.env, api.txt) and bloat (node_modules, .git, app/data) from Docker context | Low | Create at project root |
| **Public domain for frontend** | User needs HTTPS URL to access the app | Low | Railway auto-generates `*.up.railway.app` with free SSL |
| **gunicorn.conf.py** | Production server config: workers, threads, timeout, binding | Low | Environment-variable-driven. Reads PORT from Railway auto-injection |

## Differentiators

Features that improve deployment quality but are not strictly required for basic functionality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Background job pattern for analysis** | Railway enforces a hard **15-minute HTTP timeout** at the proxy layer. Large documents (50+ page PSAs) may exceed this. Refactor to: POST starts job, returns ID; GET polls for status | **High** | Not needed for MVP if most analyses complete <15 min. Required for very large documents. Defer to next milestone |
| **Session rehydration on startup** | In-memory `sessions = {}` dict starts empty on deploy. Volume persists JSON files but app does not load them on restart | Medium | Scan SESSION_FOLDER on startup, load into memory. Critical for surviving redeploys without losing active sessions |
| **Docker Compose for local dev** | Single command to run both services locally, matching production | Medium | Not blocking. Current `flask run` + `next dev` works |
| **Structured logging** | Railway captures stdout/stderr. JSON logs enable filtering in Log Explorer | Low | Replace prints with Python logging module |
| **Custom domain** | Professional vs `*.up.railway.app` | Low | Railway provides free SSL. Add CNAME record |
| **Service sleep** | Save costs when idle. Single-user tool is idle most of the time | Low | Toggle in settings. Cold start ~5-10s |
| **Volume backups** | Protect session data against accidental deletion | Low | Railway supports manual + automated backups |
| **.gitattributes** | Prevent Windows CRLF line endings from breaking shell scripts in Docker | Low | `* text=auto` + `*.sh text eol=lf` |

## Anti-Features

Features to explicitly NOT build. Over-engineering traps for a single-user tool.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Nginx reverse proxy** | Railway handles SSL, routing, load balancing at edge. Third service with zero benefit | Let Railway's edge handle it |
| **Database (PostgreSQL/Redis)** | File-based storage works for single user. Database adds cost, complexity, migration burden | Keep JSON files on Railway volume |
| **Celery/Redis task queue** | Adds 2-3 extra services for single user | Use Python `threading` if background tasks needed |
| **CI/CD pipeline (GitHub Actions)** | Railway auto-deploys on git push | Push to branch = auto deploy |
| **Kubernetes** | 2 services does not need an orchestrator | Railway IS the orchestration |
| **CDN** | Single user, single region | Serve static from Next.js directly |
| **Horizontal scaling / replicas** | Single user. Volumes incompatible with replicas | Single instance per service |
| **Vault / Doppler** | Two API keys do not justify secrets platform | Railway's environment variables are sufficient |
| **WebSocket for all endpoints** | Only analysis is long-running | HTTP polling for analysis status only |
| **Multi-region** | Single user, Pacific timezone | Deploy us-west |

## Feature Dependencies

```
Dockerfiles --------> .dockerignore
    |
    +-------> gunicorn.conf.py --------> gthread workers + timeout config
    |
    +-------> Next.js standalone output
                  |
                  +-------> proxy.ts (replaces rewrites)
                                |
                                +-------> BACKEND_URL env var (private networking)

Railway volume --------> Mount at /app/app/data
    |
    +-------> Session rehydration on startup

Background job pattern --------> Analysis endpoint refactor
                                (POST start + GET poll)
```

## MVP Recommendation

### Must Have (Deploy Fails Without)

1. **Dockerfile.flask** -- Multi-stage Python build with gunicorn
2. **frontend/Dockerfile.frontend** -- Multi-stage Node build with standalone output
3. **gunicorn.conf.py** -- gthread workers, 1800s timeout, PORT from env
4. **.dockerignore** -- Exclude secrets, data, dev files
5. **`output: 'standalone'` in next.config.ts** -- Required for Docker
6. **frontend/proxy.ts** -- Route /api/* to Flask over private network
7. **Remove rewrites() from next.config.ts** -- Replaced by proxy.ts
8. **Railway environment variables** -- GEMINI_API_KEY, ANTHROPIC_API_KEY, BACKEND_URL
9. **Railway volume** -- Mount at /app/app/data

### Should Have (App Degrades Without)

10. **Session rehydration on startup** -- Without this, sessions invisible after redeploy
11. **Gunicorn timeout tuning** -- Default 30s kills every LLM call

### Defer to Next Milestone

12. **Background job pattern** -- Only for documents exceeding 15-min Railway timeout
13. **Docker Compose** -- Convenient but not blocking
14. **Structured logging** -- Production debugging
15. **Custom domain** -- Cosmetic
16. **Session cleanup** -- Volume space management

## Railway-Specific Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| **15-min HTTP timeout (hard limit)** | Very large document analyses may be killed | Most complete <15 min. Background jobs later |
| **Single volume per service** | Cannot separate uploads from sessions | Both under `app/data/`. One mount covers both |
| **Volume not at build time** | Cannot write to volume during Docker build | App creates dirs at runtime (already does) |
| **Brief downtime on redeploy** | User may lose in-progress work | Acceptable for single-user. Avoid deploying during reviews |
| **Hobby plan: 5GB volume** | Documents + sessions accumulate | Cleanup later. Usage well under 5GB |
| **PORT injected by Railway** | Must listen on Railway's port | Both services already read PORT from env |
| **In-memory state lost on redeploy** | `sessions = {}` resets | Rehydrate from volume-backed JSON on startup |

## Sources

- [Railway Volumes](https://docs.railway.com/reference/volumes) -- HIGH confidence
- [Railway Healthchecks](https://docs.railway.com/reference/healthchecks) -- HIGH confidence
- [Railway Private Networking](https://docs.railway.com/reference/private-networking) -- HIGH confidence
- [Railway Monorepo Guide](https://docs.railway.com/guides/monorepo) -- HIGH confidence
- [Railway Config as Code](https://docs.railway.com/config-as-code/reference) -- HIGH confidence
- [Railway Flask Guide](https://docs.railway.com/guides/flask) -- HIGH confidence
- [Railway Dockerfile Builds](https://docs.railway.com/builds/dockerfiles) -- HIGH confidence
- [Next.js Output Standalone (v16.1.6)](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output) -- HIGH confidence
- [Next.js Proxy (v16.1.6)](https://nextjs.org/docs/app/getting-started/proxy) -- HIGH confidence
- [Next.js 16 Rewrite Bug (#87071)](https://github.com/vercel/next.js/issues/87071) -- HIGH confidence
- [Railway HTTP Timeout](https://station.railway.com/feedback/increase-max-platform-timeout-beyond-5-m-9d15d4ee) -- MEDIUM confidence (community reports vary)
