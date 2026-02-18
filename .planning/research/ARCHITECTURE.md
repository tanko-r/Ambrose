# Architecture Patterns: Multi-User Auth + PostgreSQL + Cloud Deployment

**Domain:** Adding authentication, persistent database, and per-user workspace isolation to existing Flask + Next.js contract redlining app
**Researched:** 2026-02-18
**Confidence:** HIGH (verified against Clerk docs, Railway docs, Flask-SQLAlchemy docs, and existing codebase)

---

## Context: What Already Exists

Before designing additions, what the current codebase does:

- Flask backend on `:5000` with a single `sessions = {}` in-memory dict
- `save_session()` persists to `app/data/sessions/{id}.json` on disk
- `get_session()` reads from memory first, falls back to disk JSON
- Uploaded files stored at `app/data/uploads/{session_id}/target.docx`
- No user concept — any caller can access any session by ID
- Phase 9 plan (`.planning/phases/9-railway-deployment/9-PLAN.md`) already covers Dockerfiles, Gunicorn, and Railway two-service deployment

This milestone adds three orthogonal concerns on top of Phase 9:

1. **Auth** — who is this caller? (Clerk)
2. **Database** — persistent user + session metadata (PostgreSQL via SQLAlchemy)
3. **Workspace isolation** — users can only see their own sessions

---

## Recommended Architecture

### System Overview

```
                        Internet
                           |
              +------------+------------+
              |                         |
        [Next.js Service]         (private only)
        Public domain             [Flask Service]
        :3000                     :8000
              |                         |
              |  Clerk middleware        |  PyJWT + JWKS
              |  (proxy.ts)             |  (before_request)
              |                         |
              +---- Private Network ----+
                   (Railway internal)
                           |
               +-----------+-----------+
               |                       |
        [Railway Postgres]      [Railway Volume]
        user + session metadata  uploaded .docx files
        (managed, replicated)    (mounted at /data)
              |
        [Clerk Backend API]
        (JWKS endpoint for
         token verification)
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Clerk (SaaS) | Identity: login, signup, SSO, session tokens | Next.js (SDK), Flask (JWKS verification) |
| Next.js proxy.ts | Inject `Authorization: Bearer <token>` on all `/api/*` requests | Flask (private network) |
| Flask `auth_middleware.py` | Verify JWT on every request, attach `g.user_id` | Clerk JWKS endpoint (cached) |
| Flask `routes.py` | Scope all session queries to `g.user_id` | PostgreSQL (session metadata), disk (files) |
| PostgreSQL `users` table | Map `clerk_user_id` to internal user record | SQLAlchemy ORM |
| PostgreSQL `contract_sessions` table | Session metadata, status, ownership | SQLAlchemy ORM |
| Railway Volume | Store uploaded `.docx` files, parsed JSON | Flask filesystem reads |

---

## What Changes vs. What Stays

### Component Changes

| Component | Action | What Changes |
|-----------|--------|-------------|
| `app/server.py` | MODIFY | Add SQLAlchemy init, Flask-Migrate, DB URI config |
| `app/api/routes.py` | MODIFY | Import `g.user_id`, scope all session queries to user |
| `frontend/proxy.ts` | MODIFY | Inject `Authorization` header from Clerk session token |
| `requirements.txt` | MODIFY | Add `psycopg2-binary`, `flask-sqlalchemy`, `flask-migrate`, `pyjwt[crypto]` |
| `frontend/package.json` | MODIFY | Add `@clerk/nextjs` |

### New Components

| File | Purpose |
|------|---------|
| `app/auth/middleware.py` | Flask `before_request` JWT verification |
| `app/models/database.py` | SQLAlchemy models: `User`, `ContractSession` |
| `app/models/migrations/` | Alembic migrations directory (created by `flask db init`) |
| `frontend/src/app/layout.tsx` | Wrap with `ClerkProvider` |
| `frontend/src/middleware.ts` | Clerk `clerkMiddleware()` for route protection |

### What Stays the Same

| Component | Why Unchanged |
|-----------|--------------|
| All existing Flask service logic | Session data structure unchanged; only storage layer changes |
| Railway Volume for files | Uploaded `.docx` files remain on disk; PostgreSQL stores metadata only |
| In-memory `sessions = {}` cache | Retained as a performance layer; DB is the source of truth |
| Gunicorn configuration | No changes needed |
| Local dev workflow | Clerk provides dev mode with no real auth required |
| All Next.js components | UI unchanged; auth wraps at layout level |

---

## Auth Flow Diagram

### Login Flow (First Time)

```
Browser
  |
  | 1. Visit app URL
  v
[Next.js middleware.ts]
  | 2. clerkMiddleware() detects no session
  | 3. Redirect to Clerk-hosted sign-in page
  v
[Clerk Sign-In Page]
  | 4. User logs in (email/Google/SSO)
  | 5. Clerk issues session cookie + short-lived JWT (__session cookie)
  v
[Next.js middleware.ts]
  | 6. Session valid, allow through to app
  v
[App UI loads]
```

### Authenticated API Request Flow

```
Browser
  |
  | 1. User action triggers API call (e.g., GET /api/document/abc)
  v
[Next.js proxy.ts]
  | 2. auth() called server-side
  | 3. getToken() retrieves short-lived JWT (60-second TTL)
  | 4. Rewrites to: http://flask.railway.internal:8000/api/document/abc
  | 5. Injects: Authorization: Bearer <clerk_jwt>
  v
[Flask before_request — auth_middleware.py]
  | 6. Extracts Bearer token from Authorization header
  | 7. Fetches JWKS from https://<clerk-domain>/.well-known/jwks.json (cached)
  | 8. Verifies token signature (RS256), expiry, azp claim
  | 9. Extracts clerk_user_id from token sub claim
  | 10. Upserts User record in PostgreSQL
  | 11. Sets flask.g.user_id = clerk_user_id
  v
[Flask route handler]
  | 12. Queries ContractSession WHERE user_id = g.user_id AND id = session_id
  | 13. Returns 403 if session belongs to different user
  | 14. Processes request normally
  v
[Response back to browser via Next.js]
```

### Token Lifecycle

```
Clerk JWT: 60-second TTL (very short — mitigates XSS)
Clerk Session Cookie: ~1 year (httpOnly, secure)
JWKS Cache (Flask): 60-minute TTL (keys rotate rarely)
```

---

## Data Model

### PostgreSQL Tables

```sql
-- Users: maps Clerk identity to app user
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id VARCHAR(255) UNIQUE NOT NULL,  -- "user_abc123" from Clerk
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW()
);

-- Contract sessions: metadata + ownership
CREATE TABLE contract_sessions (
    id UUID PRIMARY KEY,                          -- same as existing session_id
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'initialized',     -- initialized|analyzing|analyzed|finalized
    contract_type VARCHAR(50),
    representation VARCHAR(50),
    approach VARCHAR(50),
    aggressiveness INTEGER,
    target_filename VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- File paths (stored on Railway Volume, not in DB)
    target_path VARCHAR(1000),
    precedent_path VARCHAR(1000),
    parsed_doc_path VARCHAR(1000)
);

CREATE INDEX idx_sessions_user_id ON contract_sessions(user_id);
CREATE INDEX idx_sessions_status ON contract_sessions(status);
```

### SQLAlchemy Models (`app/models/database.py`)

```python
from flask_sqlalchemy import SQLAlchemy
import uuid
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    sessions = db.relationship('ContractSession', backref='user', lazy=True)

class ContractSession(db.Model):
    __tablename__ = 'contract_sessions'

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(50), default='initialized')
    contract_type = db.Column(db.String(50))
    representation = db.Column(db.String(50))
    approach = db.Column(db.String(50))
    aggressiveness = db.Column(db.Integer)
    target_filename = db.Column(db.String(500))
    target_path = db.Column(db.String(1000))
    precedent_path = db.Column(db.String(1000))
    parsed_doc_path = db.Column(db.String(1000))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### What Lives Where

| Data | Storage | Rationale |
|------|---------|-----------|
| User identity | PostgreSQL `users` | Queryable, relational, not large |
| Session metadata (status, contract_type, etc.) | PostgreSQL `contract_sessions` | Lightweight structured data |
| File paths | PostgreSQL `contract_sessions` | Pointer to files on volume |
| Uploaded `.docx` files | Railway Volume (`/data/uploads/{session_id}/`) | Binary blobs, not suitable for DB |
| Parsed document JSON | Railway Volume (`/data/uploads/{session_id}/target_parsed.json`) | Large (~500KB-5MB), not suitable for DB |
| Analysis JSON (risks, concept_map) | Railway Volume (session JSON) | Large, complex nested structure |
| Revision + flag state | Railway Volume (session JSON) | Kept with analysis for locality |
| In-memory session cache | `sessions = {}` dict | Performance cache; DB is source of truth |

---

## Auth Middleware Implementation

### Flask Auth Middleware (`app/auth/middleware.py`)

```python
import os
import time
from functools import wraps
from flask import request, g, jsonify, current_app
import jwt
from jwt import PyJWKClient

# Cache JWKS client to avoid fetching on every request
_jwks_client = None
_jwks_client_created = 0
JWKS_CACHE_TTL = 3600  # 1 hour

def get_jwks_client():
    """Return a cached PyJWKClient for Clerk's JWKS endpoint."""
    global _jwks_client, _jwks_client_created
    now = time.time()
    if _jwks_client is None or (now - _jwks_client_created) > JWKS_CACHE_TTL:
        clerk_domain = os.environ['CLERK_ISSUER_URL']  # e.g. https://your-app.clerk.accounts.dev
        _jwks_client = PyJWKClient(f"{clerk_domain}/.well-known/jwks.json")
        _jwks_client_created = now
    return _jwks_client

def require_auth(f):
    """Decorator: verify Clerk JWT, set g.user_id."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing authorization token'}), 401

        token = auth_header.split(' ', 1)[1]
        try:
            client = get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                options={'verify_exp': True}
            )
            g.user_id = payload['sub']  # Clerk user ID: "user_abc123"
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401

        return f(*args, **kwargs)
    return decorated
```

### Applying Auth to All Routes (Blueprint `before_request`)

```python
# app/api/routes.py

@api_bp.before_request
def authenticate():
    """Verify auth token before every request in this blueprint."""
    # Skip auth for health check (no /api prefix)
    # All routes in api_bp require auth
    from app.auth.middleware import get_jwks_client
    import jwt

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ', 1)[1]
    try:
        client = get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, algorithms=['RS256'])
        g.clerk_user_id = payload['sub']
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Unauthorized'}), 401
```

---

## Next.js Auth Integration

### Wrapping App with ClerkProvider (`frontend/src/app/layout.tsx`)

```typescript
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### Route Protection (`frontend/src/middleware.ts`)

```typescript
// Replaces proxy.ts — handles both auth AND proxying
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  // Protect all non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  // Proxy /api/* to Flask with auth token
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const { getToken } = await auth()
    const token = await getToken()  // Short-lived Clerk JWT

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000'
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      backendUrl
    )

    return NextResponse.rewrite(url, {
      headers: {
        ...Object.fromEntries(request.headers),
        'Authorization': `Bearer ${token}`,
      }
    })
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

**Important:** This replaces the standalone `proxy.ts` from Phase 9. The Clerk middleware already handles routing. Both auth protection and token injection happen in one place.

---

## Session Storage: Migration Pattern

### How `get_session()` Changes

Current flow:
```
check memory dict → check disk JSON → return None
```

New flow:
```
check memory dict → check PostgreSQL (scoped to g.user_id) → load disk JSON → return None
```

### Modified `get_session()` Function

```python
def get_session(session_id):
    """Get session data, verifying ownership and loading from DB+disk."""
    from flask import g
    from app.models.database import ContractSession, db

    # 1. Memory cache hit
    if session_id in sessions:
        cached = sessions[session_id]
        # Verify ownership even on cache hit
        if cached.get('user_id') != g.clerk_user_id:
            return None
        return cached

    # 2. Query PostgreSQL for session metadata + ownership check
    db_session = ContractSession.query.filter_by(
        id=session_id,
        user_id=get_or_create_user(g.clerk_user_id).id
    ).first()

    if not db_session:
        return None  # Not found or wrong user

    # 3. Build session dict from DB metadata
    data = {
        'session_id': str(db_session.id),
        'user_id': g.clerk_user_id,
        'status': db_session.status,
        'contract_type': db_session.contract_type,
        'representation': db_session.representation,
        'approach': db_session.approach,
        'aggressiveness': db_session.aggressiveness,
        'target_filename': db_session.target_filename,
        'target_path': db_session.target_path,
        'precedent_path': db_session.precedent_path,
        'parsed_doc_path': db_session.parsed_doc_path,
    }

    # 4. Load large blobs from disk
    if db_session.parsed_doc_path and Path(db_session.parsed_doc_path).exists():
        with open(db_session.parsed_doc_path, 'r', encoding='utf-8') as f:
            data['parsed_doc'] = json.load(f)

    # Load full session JSON from disk (contains analysis, revisions, flags)
    session_json_path = current_app.config['SESSION_FOLDER'] / f'{session_id}.json'
    if session_json_path.exists():
        with open(session_json_path, 'r', encoding='utf-8') as f:
            disk_data = json.load(f)
            data.update({k: v for k, v in disk_data.items() if k not in data})

    sessions[session_id] = data
    return data
```

### Modified `save_session()` Function

```python
def save_session(session_id, data):
    """Save session: metadata to PostgreSQL, large blobs to disk."""
    from app.models.database import ContractSession, db
    from flask import g

    # 1. Upsert to PostgreSQL (metadata only)
    db_session = ContractSession.query.get(session_id)
    if db_session:
        db_session.status = data.get('status', db_session.status)
        db_session.contract_type = data.get('contract_type', db_session.contract_type)
        # ... update other metadata fields
    else:
        user = get_or_create_user(g.clerk_user_id)
        db_session = ContractSession(
            id=session_id,
            user_id=user.id,
            **extract_metadata(data)
        )
        db.session.add(db_session)

    db.session.commit()

    # 2. Memory cache update
    sessions[session_id] = data

    # 3. Disk JSON (analysis, revisions, flags — too large for DB)
    session_path = current_app.config['SESSION_FOLDER'] / f'{session_id}.json'
    serializable = {
        k: v for k, v in data.items()
        if k not in ('parsed_doc', 'parsed_precedent')
    }
    with open(session_path, 'w', encoding='utf-8') as f:
        json.dump(serializable, f, indent=2, default=str)
```

---

## Per-User File Storage Path Changes

### Current Structure

```
app/data/
  uploads/
    {session_id}/
      target.docx
      precedent.docx
      target_parsed.json
  sessions/
    {session_id}.json
```

### New Structure (unchanged paths, but isolated by session ownership in DB)

```
/data/                              <- Railway Volume mount
  uploads/
    {user_clerk_id}/                <- NEW: user-scoped directory
      {session_id}/
        target.docx
        precedent.docx
        target_parsed.json
  sessions/
    {session_id}.json
```

**Why user-scoped directory:** Easier to bulk-delete all files for a user (GDPR compliance). The DB is the source of truth for ownership; the filesystem organization is defensive.

### Path Change in `intake()` Route

```python
# Current:
upload_folder = current_app.config['UPLOAD_FOLDER'] / session_id

# New:
user_dir = g.clerk_user_id.replace('user_', '')  # sanitize
upload_folder = current_app.config['UPLOAD_FOLDER'] / user_dir / session_id
```

---

## Sessions List Endpoint Changes

### Current

Any caller can list sessions (no concept of "your sessions"). The `/api/sessions` endpoint returns all sessions in memory.

### New

The sessions list endpoint scopes to `g.clerk_user_id`:

```python
@api_bp.route('/sessions', methods=['GET'])
def list_sessions():
    from app.models.database import ContractSession, User, db

    user = get_or_create_user(g.clerk_user_id)
    db_sessions = ContractSession.query.filter_by(user_id=user.id)\
        .order_by(ContractSession.updated_at.desc())\
        .limit(50)\
        .all()

    return jsonify({
        'sessions': [
            {
                'session_id': str(s.id),
                'status': s.status,
                'contract_type': s.contract_type,
                'target_filename': s.target_filename,
                'created_at': s.created_at.isoformat(),
                'updated_at': s.updated_at.isoformat(),
            }
            for s in db_sessions
        ]
    })
```

---

## Architectural Patterns

### Pattern 1: JWT Verification at the Blueprint Layer

**What:** One `@api_bp.before_request` handler verifies auth before every route in the Blueprint. No per-route decorator needed.

**Why:** The existing codebase has 30+ endpoints. Adding `@require_auth` to each one is error-prone — one missed endpoint creates a hole. The Blueprint-level hook protects everything in one place.

**Trade-off:** Every request hits JWKS verification overhead. Mitigated by: (a) JWKS client caching the public key in memory, so verification is pure in-memory RSA signature check after first request; (b) Clerk JWTs are 60 seconds so the PyJWKClient cache TTL of 1 hour is safe.

### Pattern 2: PostgreSQL for Metadata, Disk for Blobs

**What:** PostgreSQL stores lightweight structured data (user IDs, session status, file paths, metadata). The Railway Volume stores large binary blobs (uploaded .docx files, parsed JSON ~500KB-5MB, analysis JSON ~1-3MB).

**Why:** PostgreSQL is not a good store for large JSON blobs. At scale, putting multi-MB analysis results in PostgreSQL would bloat the database, slow queries, and consume expensive managed DB storage. The disk approach already works; adding DB pointers to existing files is minimal change.

**Implication:** The Railway Volume remains required even after adding PostgreSQL. This is two services in Railway: a Postgres plugin AND a Volume attachment on Flask.

### Pattern 3: Clerk User ID as Stable Foreign Key

**What:** Use Clerk's `user_id` (format: `user_abc123`) as the stable foreign key in the `users` table, not email or name.

**Why:** Email can change. Names can change. Clerk's `user_id` is immutable and unique. The `users.clerk_user_id` column has a UNIQUE constraint and is indexed.

**Upsert pattern:** On every authenticated request, `get_or_create_user()` does an upsert: if a User row for this `clerk_user_id` already exists, update `last_seen_at`; if not, create it. This means the `users` table auto-populates as users sign in with no explicit registration step.

### Pattern 4: Retain In-Memory Session Cache

**What:** Keep the existing `sessions = {}` dict as a performance layer. On first access, load from DB + disk. On subsequent requests in the same server process lifetime, serve from memory.

**Why:** Analysis results are large (1-3MB of JSON). Deserializing on every request would be slow. The cache already exists; retaining it with a DB+ownership check on cache miss is the minimal change.

**Multi-worker caveat:** With Gunicorn's `gthread` worker class (multiple threads, single worker process), the in-memory cache is shared within the process but not across multiple workers. The Phase 9 plan uses `workers = 2` for concurrency. If session state diverges between workers (unlikely for this use case since sessions are large, infrequently-updated blobs), use `workers = 1, threads = 4` instead. At current scale (small user base), this is fine.

---

## Build Order

The dependency chain requires this order:

```
1. Add Clerk to Next.js (no backend changes yet)
   - Install @clerk/nextjs
   - Wrap layout with ClerkProvider
   - Add sign-in/sign-up pages
   - Add middleware.ts (auth protection only, no proxy yet)
   - Verify login/logout works locally

2. Set up PostgreSQL (no auth integration yet)
   - Add Flask-SQLAlchemy + Flask-Migrate + psycopg2-binary
   - Create User + ContractSession models
   - Run flask db init && flask db migrate && flask db upgrade
   - Test locally with a dev Postgres (e.g., Docker or Supabase free tier)

3. Add Flask auth middleware (connects auth to Flask)
   - Add CLERK_ISSUER_URL env var
   - Implement before_request JWT verification in api_bp
   - Test: all endpoints return 401 without a valid token
   - Test: valid Clerk token passes through

4. Update Next.js proxy to inject auth token
   - Upgrade middleware.ts to combine Clerk auth + API proxying
   - getToken() injects Bearer token on /api/* requests
   - Test end-to-end: frontend action reaches Flask with valid token

5. Add user isolation to session storage
   - Modify get_session() to scope queries to g.clerk_user_id
   - Modify save_session() to upsert to PostgreSQL
   - Modify intake() to create user-scoped upload path
   - Modify sessions list endpoint to filter by user

6. Deploy to Railway with PostgreSQL
   - Add Railway Postgres plugin to project
   - Set DATABASE_URL on Flask service
   - Set CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY on Flask + Next.js services
   - Set CLERK_ISSUER_URL on Flask service
   - Run flask db upgrade in deployment (Railway start command or release command)
   - Verify end-to-end with production auth
```

**Rationale for this order:**
- Steps 1 and 2 are independent and can be developed in parallel
- Step 3 requires knowing the Clerk JWT format (from Step 1)
- Step 4 requires Step 3 (Flask must accept tokens before Next.js sends them)
- Step 5 requires Steps 2, 3, and 4 (needs DB, needs user_id in g, needs working auth flow)
- Step 6 requires all prior steps working locally

---

## Environment Variables

### Flask Service (new additions)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Railway auto-injects when Postgres plugin is added |
| `CLERK_ISSUER_URL` | `https://your-app.clerk.accounts.dev` | From Clerk dashboard — used for JWKS endpoint |
| `CLERK_SECRET_KEY` | `sk_live_...` | From Clerk dashboard — used for server-side API calls |

### Next.js Service (new additions)

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From Clerk dashboard — client-side |
| `CLERK_SECRET_KEY` | `sk_live_...` | From Clerk dashboard — server-side middleware |

### Local Development

Clerk provides a "development instance" separate from production. Local dev uses `pk_test_...` / `sk_test_...` keys. The Clerk dashboard provides a "development" environment where auth works without real credentials (test accounts can be created instantly).

---

## Integration Points: What Existing Code Touches

| Existing File | Lines Affected | Change Description |
|---------------|---------------|-------------------|
| `app/api/routes.py` | ~53-70 (`get_session`, `save_session`) | Add DB query + ownership check |
| `app/api/routes.py` | ~139-215 (`intake`) | Add user directory scoping in upload path |
| `app/api/routes.py` | Sessions list endpoint | Filter by `g.clerk_user_id` |
| `app/server.py` | ~21-36 (`create_app`) | Add `db.init_app(app)`, `DATABASE_URL` config |
| `frontend/src/lib/api.ts` | Line 8 (`FLASK_DIRECT`) | Unchanged (direct calls go through proxy now) |
| `frontend/next.config.ts` | Rewrites block | Removed (middleware.ts handles proxy) |

---

## Scalability Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 users | Current architecture plus auth + DB as described. No changes needed. |
| 10-100 users | Add `workers = 4` to Gunicorn. Analysis endpoints block workers for 5-30 min, so add Celery + Redis for background tasks. |
| 100+ users | Move file storage from Railway Volume to S3/R2. Add CDN for document HTML rendering. Consider read replicas for PostgreSQL. |

**First bottleneck at scale:** Analysis requests (5-30 min each) blocking Gunicorn workers. Fix: move analysis to a Celery background worker, return a task ID immediately, poll for completion.

**Second bottleneck:** Railway Volume IOPS at high concurrency. Fix: S3-compatible object storage (Railway Buckets or AWS S3) with presigned URLs.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Full Analysis JSON in PostgreSQL

**What people do:** Put the entire `analysis` dict (risks, concept_map, risk_map — 1-3MB) in a `JSONB` column in PostgreSQL.

**Why it's wrong:** Bloats the database, slows queries over the sessions table, costs more managed DB storage. The analysis is write-once, read-many — a blob store (disk/S3) is the right primitive.

**Do this instead:** Store file paths in PostgreSQL, store the actual JSON blobs on the Railway Volume. This is what the pattern above does.

### Anti-Pattern 2: Verifying Clerk JWT via Network Call on Every Request

**What people do:** Call `https://api.clerk.com/v1/sessions/{session_id}/verify` on every API request.

**Why it's wrong:** This is a network call to Clerk's servers on every single Flask request. At 10 users each making 10 API calls per session, that's 100 outbound Clerk API calls per session. Adds 50-200ms latency to every request. Fails if Clerk has an outage.

**Do this instead:** Verify the JWT signature locally using Clerk's JWKS public key (no network call after initial JWKS fetch). This is what `PyJWKClient` does — fetches the key once, caches it, and verifies signatures locally in microseconds.

### Anti-Pattern 3: Skipping Session Ownership Checks on Cache Hits

**What people do:** Check ownership when loading from DB, but skip the check when returning from the in-memory cache (reasoning: "it was already validated when loaded").

**Why it's wrong:** If multiple users are on the same server instance, User A's session could end up in the cache. User B requests a session ID they somehow obtained (guessed, URL-shared), hits the cache, and gets User A's session back without an ownership check.

**Do this instead:** Check `g.clerk_user_id` against `cached.get('user_id')` even on memory cache hits. The overhead is a single string comparison.

### Anti-Pattern 4: Using a Single Clerk Key for Both Dev and Production

**What people do:** Use the same Clerk instance/keys for local development and production deployment.

**Why it's wrong:** Dev users pollute the production user database. Test accounts linger. If you reset the dev environment, you invalidate production sessions.

**Do this instead:** Clerk provides separate "development" and "production" instances. Use dev keys (`pk_test_`, `sk_test_`) locally and in Railway staging. Use production keys (`pk_live_`, `sk_live_`) in Railway production.

### Anti-Pattern 5: Requiring Database to Be Up for Local Dev

**What people do:** Design the system so that the Flask server fails to start if `DATABASE_URL` is not set.

**Why it's wrong:** Local dev without a running Postgres becomes painful. The existing file-based session pattern still works fine locally.

**Do this instead:** Make `DATABASE_URL` optional. If not set, skip DB initialization and fall through to the existing disk-only session storage. Use a `USE_DATABASE = bool(os.environ.get('DATABASE_URL'))` flag in `create_app()`.

---

## Sources

- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) — ClerkProvider, middleware.ts setup
- [Clerk Manual JWT Verification](https://clerk.com/docs/backend-requests/manual-jwt) — JWKS endpoint, RS256 verification steps, azp claim
- [Clerk Python SDK](https://github.com/clerk/clerk-sdk-python/blob/main/README.md) — Official Python SDK for Clerk
- [Integrating Clerk with Next.js and Express](https://mtarkar.medium.com/integrating-next-js-clerk-auth-with-express-9c7f0407c6f0) — Token injection pattern (MEDIUM confidence — not Flask-specific)
- [Clerk verifyToken()](https://clerk.com/docs/reference/backend/verify-token) — Token verification API reference
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql) — Managed Postgres, DATABASE_URL injection
- [Railway Monorepo](https://docs.railway.com/guides/monorepo) — Two-service deployment from one repo
- [Flask-SQLAlchemy Configuration](https://flask-sqlalchemy.readthedocs.io/en/stable/config/) — DATABASE_URL config key
- [Flask-Migrate](https://flask-migrate.readthedocs.io/) — Alembic migrations for Flask apps
- [Flask Blueprint before_request](https://flask.palletsprojects.com/en/stable/tutorial/views/) — Blueprint-level auth hooks
- [PyJWT Usage](https://pyjwt.readthedocs.io/en/latest/usage.html) — RS256 verification, PyJWKClient
- [Using JWTs in Python Flask (AppSignal, 2025)](https://blog.appsignal.com/2025/04/30/using-jwts-in-python-flask-rest-framework.html) — Flask JWT patterns with PyJWT
- [Next.js proxy.ts file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — Middleware/proxy file for API routing

---

*Architecture research for: multi-user auth + PostgreSQL + workspace isolation on Flask + Next.js*
*Researched: 2026-02-18*
