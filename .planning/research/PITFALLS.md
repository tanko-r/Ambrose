# Pitfalls Research

**Domain:** Adding multi-user auth + PostgreSQL + cloud deployment to existing single-user Flask + Next.js contract redlining app
**Researched:** 2026-02-18
**Confidence:** HIGH (verified against Railway docs, Clerk docs, SQLAlchemy docs, and live codebase inspection of routes.py, server.py, store.ts)

---

## Critical Pitfalls

Mistakes that cause deployment blockers, data loss, or confidential document exposure.

---

### Pitfall 1: Railway Hard-Kills HTTP Requests at 5 Minutes — Analysis Takes Up to 30 Minutes

**What goes wrong:**
The current `GET /api/analysis/<session_id>` endpoint runs a synchronous, blocking LLM analysis inside the HTTP request handler. The analysis takes 5-30+ minutes depending on contract length. Railway enforces a **5-minute hard limit** at the network proxy layer — the connection is killed at exactly 300 seconds regardless of application or Gunicorn timeout settings. The client browser gets a silent dead connection. The Flask worker keeps burning Gemini API tokens for the remaining 25 minutes with no way to return results.

Note: the existing PITFALLS.md from the prior deployment phase said 15 minutes. Railway's help station explicitly states 5 minutes is the network-level cap even if Railway support says otherwise. Test with a real large document before trusting either number.

**Why it happens:**
On localhost with a single user, a 30-minute blocking HTTP request "just works" — the developer's browser waits. Railway's proxy infrastructure enforces timeouts that cannot be raised via application configuration. This is non-negotiable platform behavior.

**How to avoid:**
The current codebase already has 90% of what's needed. The fix is to split the analysis into true fire-and-forget:

1. `POST /api/analysis/<session_id>/start` — spawn a background thread (already done in `claude_service.py` via threading), return `202 Accepted` with `{"status": "started"}` immediately
2. `GET /api/analysis/<session_id>/progress` — already exists and is already polled by the frontend
3. Remove the blocking analysis logic from `GET /api/analysis/<session_id>` — this endpoint should only return cached analysis if it already exists, or redirect to `/start`

The threading approach (`threading.Thread`) requires zero new infrastructure. Celery + Redis is a later optimization, not a prerequisite.

**Warning signs:**
- Analysis works for small docs on Railway, silently fails for large contracts
- Browser shows no error — request hangs then dies with no message
- Railway logs show Flask worker still executing LLM calls after client disconnected
- Gunicorn gthread workers are blocked

**Phase to address:** Must be resolved before any Railway deployment. Do not deploy the blocking pattern.

---

### Pitfall 2: The `sessions = {}` Global Dict Is Lost on Every Deploy, Restart, and Worker Fork

**What goes wrong:**
`routes.py` line 50 declares `sessions = {}` as a module-level global. This has two fatal production problems:

1. **Gunicorn multi-worker isolation:** Each Gunicorn worker process has its own copy of `sessions`. A session created in Worker 1 is invisible to Worker 2. Railway load-balances across workers — requests for the same session ID are silently routed to workers that have no record of it, returning "Session not found."

2. **Container ephemerality:** Every Railway redeploy creates a new container. All in-memory sessions are wiped. The JSON file backup (`SESSION_FOLDER`) persists on a Railway Volume, but the in-memory dict is empty so `get_session()` returns None for every existing session until the JSON files are manually loaded.

**Why it happens:**
This works perfectly on localhost because `flask run` runs a single process/worker that never restarts during development. The multi-process reality of production is invisible in local dev.

**How to avoid:**
Migrate session storage to PostgreSQL as part of the database phase. The `sessions` dict becomes a `sessions` table with a JSONB column for analysis data. The `save_session()` and `get_session()` functions already abstract the read/write interface — replace their implementations to use the database.

Do NOT use Redis as a session store for this app. Analysis JSON blobs can be 2-10MB. Redis is expensive at this blob size and PostgreSQL JSONB handles it better. The PostgreSQL migration is required anyway for user accounts, so using it for sessions too eliminates Redis as a dependency.

**Warning signs:**
- "Session not found" errors in production that never happen locally
- Sessions disappear after every `git push` (which triggers a redeploy)
- Different refresh requests return different data (hitting different workers)

**Phase to address:** Database Migration Phase — must precede auth and deployment

---

### Pitfall 3: CORS Wildcard Breaks Auth Token Forwarding and Is Hardcoded to Localhost

**What goes wrong:**
`server.py` line 26: `CORS(app, origins=[r"http://localhost:\d+"])`. Two problems:

1. **Production requests rejected:** The Railway-deployed frontend origin (`https://your-app.railway.app`) does not match `http://localhost:\d+`. Every API call from the deployed frontend returns a CORS error.

2. **Credentials incompatibility:** When you add auth (any platform — Clerk, Auth0, etc.), the frontend must send auth tokens via `Authorization` header or cookies. If you use httpOnly cookies for auth, `supports_credentials=True` is required on the Flask CORS config. The wildcard or localhost pattern combined with credentials is a browser-level protocol violation that produces silent failures.

**Why it happens:**
The localhost CORS config was intentional for local dev. Nobody updates CORS before the first prod deploy because it works fine locally.

**How to avoid:**
```python
# server.py
allowed_origins = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
CORS(app, origins=allowed_origins, supports_credentials=True)
```

Set `ALLOWED_ORIGINS=https://your-frontend.railway.app` in Railway environment variables. Do this on day one of deployment setup, not as a post-debug fix.

Do NOT add CORS headers in both Flask and Nginx/Railway proxy — duplicate headers cause browser errors.

**Warning signs:**
- Every API call in production browser console shows CORS errors
- Auth tokens not transmitted because browser refuses credentialed cross-origin requests
- Works in Postman (which ignores CORS) but fails in browser

**Phase to address:** Auth + Deployment Phase — required before any production testing

---

### Pitfall 4: Adding Auth to New Routes While Legacy Routes Stay Open Forever

**What goes wrong:**
When retrofitting auth onto an existing codebase, the instinct is to add a `@require_auth` decorator to new endpoints as they're built. The existing 30+ endpoints in `routes.py` — `/intake`, `/document/<session_id>`, `/revise`, `/accept`, `/finalize`, `/load-test-session`, etc. — remain completely open. Any user who learns a session ID (from browser history, server logs, a shared link, or a referrer header) can access confidential legal documents without authentication.

Session IDs are UUIDs with ~122 bits of entropy. This is security through obscurity. The moment one session ID leaks, the document it protects is fully accessible.

**Why it happens:**
Route-by-route auth decoration is tedious and error-prone. Developers protect the routes they remember. Legacy routes get skipped. There is no compile-time enforcement that every route is protected.

**How to avoid:**
Add auth at the blueprint level with an explicit allowlist of public routes:

```python
# routes.py
PUBLIC_ROUTES = {'api.health_check'}

@api_bp.before_request
def require_auth():
    if request.endpoint in PUBLIC_ROUTES:
        return None
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = verify_clerk_jwt(token)  # raises 401 if invalid/expired
    g.user_id = user_id
```

This approach makes every new route automatically protected. Public routes must be explicitly opted out, not implicitly assumed to need protection.

Also: remove or hard-gate `/load-test-session` — it loads arbitrary saved analysis files without any session ownership check.

**Warning signs:**
- `curl -X GET https://your-app.railway.app/api/document/<any_uuid>` without an Authorization header returns 200 and document data
- `/load-test-session` is accessible from the public internet
- Route count in `routes.py` doesn't match count of `@require_auth` decorators

**Phase to address:** Auth Phase — must be done atomically with JWT verification setup

---

### Pitfall 5: Session ID Lookup Without Ownership Check — IDOR Exposes Any User's Documents

**What goes wrong:**
Even after adding JWT verification (Pitfall 4), if `get_session()` only checks "does this session exist?" rather than "does this session belong to the authenticated user?", any logged-in user can access any other user's session by providing its ID.

Current `get_session()` in `routes.py` lines 53-57:
```python
def get_session(session_id):
    if session_id not in sessions:
        return None
    return sessions[session_id]
```

Post-migration this must become:
```python
def get_session(session_id, user_id):
    session = db.query(Session).filter_by(id=session_id, user_id=user_id).first()
    return session
```

Without the `user_id` filter, authenticated-as-User-B + known-session-ID-of-User-A = full access to User A's confidential legal documents. This is a textbook Insecure Direct Object Reference (IDOR) vulnerability.

**Why it happens:**
The "session ID = authorization" mental model works for single-user apps. The multi-user transition requires a second ownership check that developers often add to new endpoints but forget to retrofit onto the shared helper used by all existing routes.

**How to avoid:**
Fix `get_session()` to require `user_id` as a mandatory parameter. This makes every call site compile-time enforced — any route that calls `get_session()` without passing `g.user_id` will fail, forcing the developer to consciously pass it.

Also namespace file storage by user ID (see Pitfall 6) so the file system layer independently enforces isolation.

**Warning signs:**
- Auth pen test: log in as User B, call `GET /api/document/<User_A_session_id>` with User B's JWT — if it returns data, IDOR is present
- No `user_id` foreign key on the sessions database table
- `get_session()` has one parameter (session_id) instead of two (session_id, user_id)

**Phase to address:** Auth Phase — simultaneously with JWT verification

---

### Pitfall 6: Uploaded Documents at Hardcoded Local Paths — Lost on Redeploy, No User Isolation

**What goes wrong:**
`routes.py` line 149: `upload_folder = current_app.config['UPLOAD_FOLDER'] / session_id`

This stores uploaded `.docx` files at `app/data/uploads/<session_id>/`. In multi-user cloud deployment:

1. **Ephemerality:** Railway's default filesystem is ephemeral. Files written there are destroyed on every redeploy/restart. A Railway Volume helps for single-service deployments but does not work across multiple Flask instances.
2. **No user scope:** File paths contain only the session ID, not the user ID. If a user somehow knows another user's session ID (see Pitfall 5), file paths are derivable.
3. **Finalization output:** The finalize endpoint generates Word output files at similar hardcoded paths. These also vanish post-redeploy, making the finalized document undownloadable.

**Why it happens:**
Local file paths are the simplest possible storage solution. They work perfectly for localhost single-user dev. Cloud storage complexity is deferred until deployment — which is too late.

**How to avoid:**
Use Railway Buckets (native S3-compatible object storage, $0.015/GB-month, unlimited S3 API operations) with paths namespaced by user ID:

```
{user_id}/{session_id}/target.docx
{user_id}/{session_id}/precedent.docx
{user_id}/{session_id}/output.docx
```

Use `boto3` with Railway's bucket `endpoint_url`. The path abstraction already exists via `UPLOAD_FOLDER` config — replace the read/write calls with S3 operations when `RAILWAY_ENVIRONMENT` is set.

For local development, keep the local filesystem path. Use an environment variable to switch between local and S3 storage backends.

**Warning signs:**
- Documents upload on Railway but disappear after next git push
- Finalization fails because the original `.docx` the finalize step needs no longer exists
- No `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or S3 endpoint variables in Railway service settings
- Upload folder path contains no user ID component

**Phase to address:** Storage Migration Phase — must precede deployment

---

### Pitfall 7: Clerk Webhook Arrives After First API Call — User Record Missing, FK Constraint Error

**What goes wrong:**
The standard Clerk + PostgreSQL pattern: Clerk sends a `user.created` webhook → backend creates a row in the `users` table → subsequent requests look up the user by Clerk user ID. The failure mode: webhook delivery is asynchronous and not guaranteed to be fast. A user who signs up and immediately hits the API (which Clerk's frontend SDK can trigger within milliseconds via `useAuth()` returning) will arrive at the Flask backend before the webhook has been processed. The backend throws a foreign key constraint error or "user not found" on the first real API call.

Clerk documents this explicitly: "you can't rely on webhook delivery as part of the user onboarding flow." Svix (the webhook delivery infrastructure Clerk uses) delivers at-least-once — you can also receive duplicate or out-of-order events.

**Why it happens:**
Developers build the "happy path" where webhook arrives first, test it locally with artificial delays, and ship to production where the race condition triggers on every new signup.

**How to avoid:**
Two complementary fixes:

1. Use upsert in the webhook handler:
```python
db.execute("""
    INSERT INTO users (clerk_id, email, created_at)
    VALUES (:clerk_id, :email, NOW())
    ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email
""", ...)
```

2. Add lazy user creation in the JWT verification middleware as a fallback:
```python
user = db.query(User).filter_by(clerk_id=g.clerk_user_id).first()
if not user:
    user = User(clerk_id=g.clerk_user_id, email=g.clerk_email)
    db.add(user)
    db.commit()
    g.user = user
```

**Warning signs:**
- New user signup returns 500 or FK constraint error in Flask logs on first API call
- User authenticates via Clerk frontend but Flask backend returns "user not found"
- Webhook delivery logs show 2-10 second delay after signup

**Phase to address:** Auth Phase — user provisioning design

---

### Pitfall 8: JWT Token Stored in Browser Storage — Legal Documents Are High-Value Targets

**What goes wrong:**
If the Next.js frontend stores Clerk's JWT in `localStorage` or `sessionStorage`, any XSS vulnerability in the application (including those introduced by npm dependencies) can steal the token and impersonate the user. For a legal contract review tool handling confidential client documents, privileged communications, and deal strategy, this is a high-value target.

Clerk's built-in session management stores tokens in memory and uses short-lived JWTs (60-second expiry, auto-refreshed). This is the correct default. The pitfall occurs when developers manually persist tokens — e.g., saving `getToken()` output to `localStorage` for debugging, or building a custom token refresh mechanism.

**Why it happens:**
Tutorials for generic web apps often store JWTs in localStorage for simplicity. Legal document apps handle information that creates liability if leaked, but developers often copy these patterns without considering the confidentiality implications.

**How to avoid:**
Use Clerk's SDK exclusively for token management. When calling Flask APIs from Next.js, call `useAuth().getToken()` per request — this returns a fresh short-lived token each time and stores nothing to browser storage:

```typescript
// api.ts
const token = await getToken();
const response = await fetch('/api/document/' + sessionId, {
  headers: { Authorization: `Bearer ${token}` }
});
```

Never call `localStorage.setItem` with any auth token. On the Flask backend, verify the JWT on every request against Clerk's JWKS endpoint using PyJWT with RS256.

**Warning signs:**
- `localStorage.getItem('token')` or similar returns anything in browser console
- Flask API client reads token from Zustand store state (persisted between page loads) rather than calling `getToken()` per request
- JWT debugging adds a localStorage write "just temporarily"

**Phase to address:** Auth Phase — frontend token handling design

---

## Moderate Pitfalls

---

### Pitfall 9: Analysis Blocks All Gunicorn Workers — All Other Requests Time Out

**What goes wrong:**
With Gunicorn sync workers (the default), running a 30-minute LLM analysis inside a request handler blocks that worker process completely. With 2-4 workers (typical Railway deployment), one ongoing analysis consumes 25-50% of server capacity. Two simultaneous analyses saturate all workers. Health checks, document loads, and revision requests all hang waiting for an available worker.

**Why it happens:**
Invisible on localhost with a single user. Flask's dev server is single-threaded and blocking by design. Multi-worker behavior is only visible in production.

**How to avoid:**
Run Gunicorn with gthread workers:
```
gunicorn app.server:create_app() --worker-class gthread --threads 4 --workers 2 --timeout 1800
```

The `gthread` class uses real OS threads (not gevent's greenlets), which is critical because the codebase uses `asyncio` for parallel Gemini calls. Gevent monkey-patching conflicts with asyncio. Do not use gevent.

Ensure analysis itself runs as a background thread (see Pitfall 1 fix), not inside the request handler. The thread pool handles I/O concurrency; gthread workers handle HTTP concurrency.

**Warning signs:**
- `/health` endpoint stops responding during analysis
- All API calls return 502 or timeout during LLM analysis runs
- Railway CPU shows one worker at 100% while others sit idle

**Phase to address:** Deployment Phase — Gunicorn configuration

---

### Pitfall 10: PostgreSQL Connection Pool Exhaustion from Long-Running Analysis Threads

**What goes wrong:**
When analysis runs as a background thread, that thread may hold an open SQLAlchemy database session for 30 minutes (reading parsed_doc, writing incremental progress). With SQLAlchemy's default pool settings (`pool_size=5`, `max_overflow=10`), 15 concurrent long-running analysis threads saturate the connection pool. All other requests hang waiting for a database connection, then timeout. Railway's hobby PostgreSQL plan allows 25 simultaneous connections total — Gunicorn workers + analysis threads + overhead can hit this within minutes.

**Why it happens:**
Background thread holds a SQLAlchemy session object. SQLAlchemy sessions pin a database connection for their entire lifetime unless explicitly closed. Threads that don't call `session.close()` hold their connection indefinitely.

**How to avoid:**
Scope database sessions explicitly in background threads using context managers:

```python
# analysis thread
with db.session() as session:
    doc = session.query(Document).filter_by(id=session_id).first()
    # do analysis
    session.commit()
# connection returned to pool here
```

Configure pool conservatively for Railway:
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=3,
    max_overflow=5,
    pool_recycle=1800,
    pool_pre_ping=True   # detect stale connections from Railway's idle timeout
)
```

`pool_pre_ping=True` is essential — Railway PostgreSQL drops idle connections after ~5 minutes and SQLAlchemy will try to reuse stale connections without it.

**Warning signs:**
- `QueuePool limit of size X overflow Y reached` errors in Flask logs
- Database connections spike and never decrease in `pg_stat_activity`
- Works for the first 10-15 minutes of deployment, then all DB calls start timing out

**Phase to address:** Database Migration Phase — connection pool design

---

### Pitfall 11: Railway 15-Minute HTTP Timeout (Backup Concern After Pitfall 1 Is Fixed)

**What goes wrong:**
The prior PITFALLS.md for this project (from the deployment milestone) stated Railway's limit is 15 minutes. Research for this milestone found conflicting information: Railway help station posts say 5 minutes is enforced at the network layer, with 15 minutes as the official platform maximum but not always achievable in practice. The exact limit may vary by Railway plan or infrastructure configuration.

**How to avoid:**
Do not rely on any specific HTTP timeout number. If Pitfall 1 is fixed (analysis becomes async/background), this pitfall is irrelevant for analysis. It remains relevant for the `/finalize` endpoint which generates a Word document — verify finalization completes within 2 minutes for all expected document sizes.

**Phase to address:** Deployment Phase — verify finalization latency

---

### Pitfall 12: Alembic Migration Applied to Production Before Testing — Irreversible Data Loss

**What goes wrong:**
SQLAlchemy + Alembic (Flask-Migrate) is the correct tool for managing schema changes. The pitfall: `alembic upgrade head` run against a production PostgreSQL database with wrong migrations can drop columns or tables. Unlike SQLite, PostgreSQL `DROP COLUMN` is immediately permanent and not recoverable without a backup.

**Why it happens:**
Alembic auto-generates migrations from model diffs. If the model definition doesn't match the actual database state (common when adding Alembic to an existing project), auto-generated migrations may include incorrect destructive operations.

**How to avoid:**
1. On first setup of Alembic on an existing database, use `alembic stamp head` to mark the current schema as the baseline without running any migration. Do NOT run `alembic upgrade head` against a database that already has schema.
2. Always review auto-generated migration scripts before applying them — they are not guaranteed to be correct.
3. Set up Railway PostgreSQL with automated daily backups before running any migration in production.
4. Test migrations against a Railway dev environment (separate Railway project) before applying to production.

**Warning signs:**
- Alembic auto-generates `DROP TABLE` or `DROP COLUMN` operations
- First migration script is very long (means Alembic doesn't know the current state)
- No database backup exists before running migration

**Phase to address:** Database Migration Phase — Alembic setup

---

### Pitfall 13: Clerk Python SDK Not Available — Manual JWT Verification Required for Flask

**What goes wrong:**
Clerk has a JavaScript/TypeScript SDK with full-featured backend support. The Python SDK (`clerk-backend-api` on PyPI) is newer, less documented, and may not have parity with the JS SDK for JWT verification patterns. Documentation for Clerk + Flask integration is sparse compared to Clerk + FastAPI or Clerk + Node.

**Why it happens:**
Clerk's primary market is JavaScript/React developers. Flask is a secondary integration target. The Python SDK exists but verification patterns for Flask specifically require manual implementation or adaptation of FastAPI examples.

**How to avoid:**
Use PyJWT directly with Clerk's JWKS endpoint. This is the most reliable approach for Flask and doesn't depend on SDK completeness:

```python
import jwt
from jwt import PyJWKClient

jwks_client = PyJWKClient('https://<your-clerk-frontend-api>/.well-known/jwks.json')

def verify_clerk_jwt(token: str) -> str:
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    data = jwt.decode(
        token,
        signing_key.key,
        algorithms=['RS256'],
        options={'verify_aud': False},  # Clerk doesn't use aud claim
    )
    return data['sub']  # Clerk user ID
```

Set `azp` claim validation to your Railway domain to prevent token use from unauthorized origins.

Cache the JWKS client (it fetches keys from Clerk's servers) — do not create a new `PyJWKClient` per request.

**Warning signs:**
- JWT verification always fails due to HS256 vs RS256 algorithm mismatch
- Decoding works locally but not in production (clock drift — add leeway)
- New JWKS keys after Clerk key rotation invalidate cached keys (PyJWKClient handles this automatically)

**Phase to address:** Auth Phase — backend JWT verification

---

## Minor Pitfalls

---

### Pitfall 14: `/load-test-session` Endpoint Remains Active in Production

**What goes wrong:**
`routes.py` defines `/api/load-test-session` which loads saved analysis files from the `output/` directory without any authentication or session ownership check. In production, this endpoint allows any user to load analysis data that was pre-computed and saved to disk.

**Prevention:** Add an environment guard:
```python
@api_bp.route('/load-test-session', methods=['POST'])
def load_test_session():
    if os.environ.get('FLASK_ENV') != 'development':
        return jsonify({'error': 'Not available in production'}), 404
    ...
```

**Phase to address:** Auth Phase — remove or gate before deployment

---

### Pitfall 15: `parsed_doc` JSON Blob Stored in In-Memory Session Bloats Worker Memory

**What goes wrong:**
The session dict stores `parsed_doc` (the full parsed document JSON) in memory. A large PSA can produce 2-5MB of parsed JSON. With multiple workers and multiple sessions, this accumulates. Railway's hobby tier has limited RAM.

**Prevention:** Store `parsed_doc` only on disk (or in PostgreSQL JSONB). Load it lazily when needed. The current code already writes it to `parsed_doc_path` — remove it from the in-memory dict and always load from disk/DB.

**Phase to address:** Database Migration Phase — session data model

---

### Pitfall 16: Windows CRLF Line Endings Break Docker Entrypoint Scripts

**What goes wrong:**
Shell scripts (`*.sh`) committed from Windows have `\r\n` line endings. Linux Railway containers fail with `\r: command not found`.

**Prevention:** Add to `.gitattributes`: `*.sh text eol=lf`

**Phase to address:** Deployment Phase — pre-deploy checklist

---

### Pitfall 17: API Keys Included in Docker Image Layers via `COPY . .`

**What goes wrong:**
`api.txt` (containing the Gemini API key) or `.env` files copied into Docker image via `COPY . .`. Keys persist in image layers even if deleted in a later layer.

**Prevention:** Add to `.dockerignore`: `api.txt`, `.env`, `*.key`, `output/`, `test documents/`. Use Railway environment variables for all secrets.

**Phase to address:** Deployment Phase — Dockerfile review

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `sessions = {}` as a cache layer over PostgreSQL | Faster reads | Cache-DB inconsistency after crash; stale data | Never — use PostgreSQL as source of truth |
| Skip per-route ownership checks; rely on UUID entropy | Less code | IDOR vulnerability; one leaked session ID exposes confidential legal docs | Never |
| Use Railway Volume for `.docx` files instead of Buckets | Simpler file API | Volume is single-mount; not designed for many binary files; no URL-based access | Acceptable as temporary MVP; migrate to Buckets before scaling |
| Skip Alembic; manage schema via raw SQL | Fewer tools | No migration history; impossible to reproduce schema; high risk of prod errors | Acceptable for first deploy only if schema is finalized before launch |
| Store Clerk JWT in Zustand (persisted state) for convenience | Simpler API client | Token persists in browser storage → XSS risk on sensitive legal documents | Never |
| Deploy without converting analysis to async/background | Fewer moving parts | Deploy blocker — analysis is killed at 5-min Railway timeout | Never |
| Use gevent Gunicorn workers | Better concurrency numbers | Conflicts with asyncio used in parallel_analyzer.py | Never for this codebase |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Clerk + Flask JWT | Attempting HS256 (symmetric) decoding — Clerk uses RS256 (asymmetric) | Fetch public key from `https://<clerk-frontend-api>/.well-known/jwks.json`; use PyJWT with `algorithms=['RS256']` |
| Clerk + Flask JWT | Not validating `azp` (authorized parties) claim | Set `azp` to your Railway frontend domain; reject tokens from unknown origins |
| Clerk webhooks + PostgreSQL | Using `INSERT` for user creation — duplicates break on retry | Always use `INSERT ... ON CONFLICT (clerk_id) DO UPDATE` |
| Railway Buckets + boto3 | Using default `s3.amazonaws.com` endpoint | Set `endpoint_url` to Railway's bucket endpoint (not AWS) |
| PostgreSQL + SQLAlchemy | Not setting `pool_pre_ping=True` | Railway drops idle connections; stale connections cause cryptic errors without pre-ping |
| flask-cors + credentials | `origins='*'` with `supports_credentials=True` | Browsers block this per spec; use explicit origin list with credentials |
| Gunicorn + asyncio | Using gevent workers | Gevent monkey-patches the event loop; breaks asyncio used in parallel_analyzer.py |
| Next.js + Flask on Railway | Deploying as a single Railway service | Deploy as two separate services; Next.js routes `/api/*` to Flask via `next.config.ts` rewrites to Railway internal URL |
| Alembic on existing DB | Running `alembic upgrade head` against a pre-existing database schema | Use `alembic stamp head` to baseline; never auto-migrate a live database without reviewing the generated script |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full `parsed_doc` (2-5MB) into every session dict | High RAM usage per worker; OOM errors | Store in PostgreSQL JSONB; load lazily on demand | At 5+ concurrent users with large documents |
| Serving `.docx` files directly from Flask via `send_file()` | Flask worker blocked during download | Redirect to signed Railway Bucket URL (pre-signed S3 URL) | At 2+ concurrent downloads |
| Re-rendering document HTML on every page load | CPU-intensive; 5-10 second rendering time | Cache rendered HTML keyed by session_id + doc_hash | At 3+ concurrent users |
| DB connection held open for 30-minute analysis thread | Pool exhaustion; all DB calls timeout | Scope sessions with context managers; close connections between analysis steps | At 3+ concurrent analyses |
| JWKS key fetch on every request | Latency spike on every API call; Clerk rate limit risk | Create `PyJWKClient` once at module load; cache signing keys per `kid` | At 50+ requests/second |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No JWT verification on legacy endpoints | Any user can access any session by guessing UUID | `@api_bp.before_request` validates JWT on every route except allowlisted public routes |
| Session ID lookup without `user_id` filter | IDOR — authenticated User B reads User A's confidential documents | `get_session(session_id, user_id)` filters by both columns in PostgreSQL |
| File paths contain only session_id, not user_id | File path guessing if session ID leaks | Namespace file paths as `{user_id}/{session_id}/filename` |
| `/load-test-session` accessible in production | Unauthenticated access to saved analysis data | Gate behind `FLASK_ENV == 'development'` check |
| No rate limiting on `/revise` | One user can trigger unlimited Gemini API calls → runaway costs | Flask-Limiter with per-user limit (e.g., 50 revisions/hour) backed by PostgreSQL or Redis |
| `api.txt` in Docker image | API key leaked to anyone who can pull the image | `.dockerignore`; Railway environment variables for all secrets |
| CORS `supports_credentials=True` without `SameSite` policy | CSRF if cookies used for auth | Set `SameSite=Strict` on auth cookies; use CSRF token for state-mutating requests |
| Legal documents without encryption at rest | Breach exposes attorney-client privileged documents | Railway Buckets encrypt at rest (verify in Railway docs); PostgreSQL encrypts at rest on Railway's managed service |
| Clerk `sub` used directly as user ID in all DB queries | User ID spoofing if JWT verification is skipped elsewhere | Always verify JWT before trusting `sub` claim; the `@before_request` hook is the single verification point |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Session state wipes on browser close mid-analysis | 30-minute analysis lost; must restart from scratch | Store analysis state in PostgreSQL; user can close browser and return to find analysis complete |
| No session list on login — user must know their session ID | Can't resume work after logging back in | Sessions dashboard: list of past sessions with document name, date, status, keyed to authenticated user |
| Auth redirect loop if Clerk token expires mid-session | User loses place in document review | Clerk auto-refreshes tokens in background; handle 401 in API client by re-calling `getToken()` and retrying once |
| No indication that "analysis in background" means browser tab can be closed | Users keep browser open for 30 minutes unnecessarily | Explicit messaging: "Analysis is running. You can close this tab and return — your progress is saved." |
| First-time sign-up + document upload in same immediate flow | Friction on first use; users confused by auth + file upload combined | Separate auth (sign in/up) from document intake; let user authenticate first, then start a new session |

---

## "Looks Done But Isn't" Checklist

- [ ] **Auth on all routes:** `curl -X GET https://your-app.railway.app/api/document/<any_session_id>` without Authorization header returns 401, not 200 with document data
- [ ] **IDOR protection:** Log in as User B; call `GET /api/document/<User_A_session_id>` with User B's JWT; verify 403 or 404 is returned, not document data
- [ ] **Analysis survives Railway redeploy:** Trigger a redeploy mid-analysis; confirm the analysis completes and the session is accessible post-redeploy
- [ ] **Documents survive Railway redeploy:** Upload a `.docx`, trigger a redeploy, verify the file still loads and renders
- [ ] **CORS correct in production:** API calls from Railway frontend succeed; requests from unauthorized origins are blocked
- [ ] **JWT expiry handled gracefully:** Invalidate a Clerk session; confirm Flask returns 401 and Next.js frontend prompts re-login, not a blank error
- [ ] **No analysis blocking workers:** Run two simultaneous analyses; `/health` still responds in under 200ms during both
- [ ] **Connection pool not exhausted:** Two concurrent analyses plus normal document loads; all DB queries complete in under 1 second
- [ ] **No tokens in browser storage:** Open browser devtools; `localStorage.getItem('token')` and similar return null
- [ ] **`/load-test-session` not in production:** Endpoint returns 404 or 401 on Railway deployment

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Analysis killed at Railway timeout (blocking pattern deployed) | MEDIUM | Hotfix: split analysis into POST-start + GET-progress pattern; redeploy; alert active users |
| Sessions dict wiped on redeploy — users lose work | HIGH | Warn users before first production deploy; export session JSON files if volume exists; import into PostgreSQL |
| IDOR discovered post-launch | HIGH | Immediate hotfix: add `user_id` filter to `get_session()`; audit logs for cross-user access events; notify affected users per bar ethics rules |
| Documents lost to ephemeral filesystem | HIGH | No recovery for lost files; migrate to Railway Buckets before first real user upload |
| Connection pool exhaustion | MEDIUM | Railway service restart clears connections; fix pool config and redeploy; add monitoring on `pg_stat_activity` |
| CORS blocking all API calls | LOW | Set `ALLOWED_ORIGINS` env var in Railway; redeploy (minutes to fix) |
| Clerk webhook missing — user locked out on first login | LOW | Add lazy user creation to JWT middleware; affected user resolves by signing out and back in |
| Alembic migration corrupts production schema | HIGH | Restore from Railway database backup; treat daily backups as non-optional before any migration |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Railway 5-min timeout kills analysis | Database Migration + Deployment Phase | Analysis completes on Railway for a 100-page document (proves async path is taken) |
| `sessions = {}` wipes on redeploy | Database Migration Phase | Redeploy Railway service; verify session survives and is accessible post-deploy |
| CORS hardcoded to localhost | Auth + Deployment Phase | API calls succeed from Railway-deployed frontend with auth header |
| All legacy routes open | Auth Phase | `curl` without auth header returns 401 on every route except `/health` |
| IDOR — session lookup without ownership filter | Auth Phase | Cross-user session access attempt returns 403 with valid JWT for wrong user |
| File paths hardcoded to local disk | Storage Migration Phase | Upload document; redeploy; verify document still renders |
| Clerk webhook async — user missing on first login | Auth Phase | New user signup + immediate API call succeeds without 500 |
| Analysis blocks all Gunicorn workers | Deployment Phase | Two simultaneous analyses; health check responds in under 200ms |
| JWT in browser storage | Auth Phase | No auth tokens in localStorage or sessionStorage in browser devtools |
| DB connection pool exhaustion | Database Migration Phase | Load test with 3 concurrent analyses; all response times stay under 1 second |
| `/load-test-session` in production | Auth Phase | Endpoint returns 404 or 401 on Railway |
| Alembic migration risk | Database Migration Phase | Migration tested on dev DB; schema matches expected; backup confirmed before prod migration |

---

## Sources

- [Railway HTTP timeout (5-minute confirmed at network layer)](https://station.railway.com/questions/any-workarounds-for-the-5-min-request-ti-b055adde)
- [Railway Help Station: Increase Max HTTP Timeout](https://station.railway.com/questions/increase-max-http-timeout-1c360bf9)
- [Railway ephemeral storage and Volumes](https://docs.railway.com/reference/volumes)
- [Railway Buckets — S3-compatible object storage ($0.015/GB-month)](https://docs.railway.com/storage-buckets)
- [Gunicorn multi-worker in-memory session isolation](https://medium.com/@jgleeee/sharing-data-across-workers-in-a-gunicorn-flask-application-2ad698591875)
- [Clerk webhook delivery guarantees (at-least-once, async, not immediate)](https://clerk.com/docs/guides/development/webhooks/syncing)
- [Clerk manual JWT verification with JWKS + RS256](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Clerk Python SDK (clerk-backend-api)](https://pypi.org/project/clerk-backend-api/)
- [Clerk: sync user data to database via webhooks](https://clerk.com/articles/how-to-sync-clerk-user-data-to-your-database)
- [SQLAlchemy connection pooling documentation](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [PostgreSQL connection pool exhaustion post-mortem](https://www.c-sharpcorner.com/article/postgresql-connection-pool-exhaustion-lessons-from-a-production-outage/)
- [flask-cors wildcard + credentials conflict (GitHub #202)](https://github.com/corydolphin/flask-cors/issues/202)
- [JWT storage security: localStorage vs httpOnly cookies](https://www.wisp.blog/blog/understanding-token-storage-local-storage-vs-httponly-cookies)
- [Legal document cloud storage — attorney-client privilege risks](https://www.cloudwards.net/best-cloud-storage-for-lawyers/)
- [Multi-tenant data isolation architecture](https://complydog.com/blog/multi-tenant-saas-privacy-data-isolation-compliance-architecture)
- [Flask-Migrate on existing projects — Alembic stamp head pattern](https://blog.miguelgrinberg.com/post/how-to-add-flask-migrate-to-an-existing-project)
- [Clerk + FastAPI JWT verification (adaptable to Flask)](https://medium.com/@didierlacroix/building-with-clerk-authentication-user-management-part-2-implementing-a-protected-fastapi-f0a727c038e9)

---
*Pitfalls research for: Adding multi-user auth + PostgreSQL + Railway deployment to single-user Flask + Next.js contract redlining app*
*Researched: 2026-02-18*
