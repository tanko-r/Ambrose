# Technology Stack: Multi-User Auth + PostgreSQL

**Project:** Contract Redlining Tool -- Auth & Database Milestone
**Researched:** 2026-02-18
**Overall confidence:** HIGH

---

## Context

This file covers ONLY new additions for the multi-user milestone. The prior Railway deployment stack (gunicorn, Docker, Next.js standalone, proxy.ts) is documented in the previous STACK.md entry and is NOT reproduced here. The existing stack is:

- Flask 3.x + Flask-CORS, Python 3.12
- Next.js 16, Tailwind v4, shadcn/ui, Zustand
- python-docx, redlines, scikit-learn, anthropic SDK, google-genai
- File-based sessions (JSON on disk) -- REPLACING with PostgreSQL
- Railway for hosting, Docker containers

---

## Auth Platform Recommendation: Clerk

**Use Clerk.** Not Auth0. Not Supabase Auth. Not WorkOS.

### Decision Rationale

This project needs email/password, Google OAuth, Microsoft OAuth, and SSO via Okta/SAML. The evaluation compared Clerk, Auth0, WorkOS, and Supabase Auth on four axes: SSO pricing, Flask backend integration, Next.js integration quality, and total cost of ownership for a single developer.

**Auth0 is eliminated immediately.** SAML/Enterprise connections require the B2B Professional plan, which runs approximately $34,000/year once SAML is enabled. One source found auth0 charging $34k/yr for 2,500 MAUs with SAML enabled. There is no practical path to affordable SSO with Auth0 for a small-scale legal tool. Auth0 is optimized for large enterprises with procurement teams, not solo developers.

**Supabase Auth is eliminated** because it lacks native SAML SSO support. Supabase handles OIDC federation but does NOT provide the customer-configurable SAML connections that Okta enterprise clients expect. Supabase Auth also requires building your own React sign-in forms -- no drop-in UI components. For a tool where David needs to focus on contract logic, not auth UX, this is a poor tradeoff.

**WorkOS is a viable runner-up** and worth understanding. WorkOS AuthKit is free up to 1 million users, with SSO connections at $125/month each. A single Okta SAML connection = $125/month. WorkOS has solid Next.js SDK (`@workos-inc/authkit-nextjs`) and supports Flask via JWT verification. The reason WorkOS loses is DX: its Python SDK is thinner, and the Next.js AuthKit integration requires more manual wiring than Clerk's. For a solo developer who wants to ship auth quickly and move on, Clerk is faster.

**Clerk wins** because:

1. As of February 2026 Clerk eliminated per-connection SSO fees and now meters Enterprise Connections (SAML/OIDC) within the Pro plan at $75/connection/month. For David's use case (1-3 Okta clients), cost is $20/mo (Pro) + $75-225/mo per connection -- comparable to WorkOS or cheaper.
2. Clerk has the best Next.js integration of any auth provider. `@clerk/nextjs` provides middleware, App Router server components, `useUser()`, `useAuth()`, and pre-built `<SignIn>` and `<SignUp>` components that match any Tailwind theme. Zero custom UI required.
3. Clerk published a Python backend SDK (`clerk-backend-api` v5.0.1, Feb 18 2026) with `authenticate_request()` that works with Flask directly. Flask gets a decorator pattern -- no manual JWKS fetching needed.
4. Clerk's free tier (Hobby) now includes 50,000 MRU. David can develop and test with real users without paying until Okta connections are needed.
5. Clerk's organization model is built-in. If David ever adds shared workspaces (multiple attorneys at a firm), Clerk Organizations handle it without new infrastructure.

### Cost Comparison

| Provider | Email+OAuth cost | +SAML (1 connection) | +SAML (5 connections) |
|----------|-----------------|---------------------|-----------------------|
| Clerk | Free (Hobby) / $20/mo (Pro) | $20 + $75 = $95/mo | $20 + $375 = $395/mo |
| Auth0 | $0-240/mo | ~$2,500-$34k/yr | ~$34k/yr |
| WorkOS | Free | $125/mo | $625/mo |
| Supabase Auth | Free | Not supported | Not supported |

---

## New Dependencies: Auth (Backend)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `clerk-backend-api` | `>=5.0.1` | Clerk Python SDK for Flask JWT verification | Official Clerk SDK. `authenticate_request()` method validates session tokens from the Next.js frontend. Handles JWKS key rotation automatically. Released Feb 18 2026. Python >=3.10 required. |
| `PyJWT` | `>=2.8.0` | JWT decode fallback | Needed if Clerk SDK is unavailable or for custom token inspection. Also used for any internal service tokens. |

**Do NOT add:** `flask-login`, `flask-security`, `Authlib`. Clerk manages auth state on the frontend; the Flask backend only verifies JWTs. These libraries are for apps that manage their own sessions, which conflicts with Clerk's model.

### Flask Integration Pattern

Clerk sends a session JWT on every request (via `Authorization: Bearer <token>` or the `__session` cookie). Flask verifies it with the Clerk SDK:

```python
# app/auth.py -- new file
from functools import wraps
from flask import request, jsonify, g
import clerk_backend_api as clerk

_clerk = clerk.Clerk(bearer_auth=os.environ["CLERK_SECRET_KEY"])

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        req_state = _clerk.authenticate_request(
            request,
            authorized_parties=["https://your-domain.up.railway.app"]
        )
        if not req_state.is_signed_in:
            return jsonify({"error": "Unauthorized"}), 401
        g.user_id = req_state.payload["sub"]  # Clerk user ID
        return f(*args, **kwargs)
    return decorated
```

Apply `@require_auth` to any route that needs authentication. `g.user_id` is the Clerk user ID -- use it as the FK for workspace isolation.

---

## New Dependencies: Auth (Frontend)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@clerk/nextjs` | `latest` (6.x) | Clerk Next.js SDK | Official SDK. Provides `ClerkProvider`, `<SignIn>`, `<SignUp>`, `useUser()`, `useAuth()`, App Router server component helpers, and middleware auth protection. Works with Next.js 16. |

**Do NOT add:** `next-auth`, `passport`, `iron-session`. These are session management layers that duplicate what Clerk already provides, and conflict with Clerk's JWT-based model.

### Next.js Integration Pattern

Wrap the app in `ClerkProvider` in `layout.tsx`. Protect routes in `proxy.ts` (the existing middleware file):

```typescript
// frontend/proxy.ts -- extend existing file
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware((auth, request) => {
  // Auth protection
  if (!isPublicRoute(request)) {
    auth.protect()
  }
  // Existing API proxy logic
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      BACKEND_URL
    )
    return NextResponse.rewrite(url)
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

**IMPORTANT:** Clerk middleware must run before the API proxy. The order above handles this correctly. The session JWT is automatically forwarded on fetch calls when using `useAuth()` to get a token.

---

## New Dependencies: Database (Backend)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `Flask-SQLAlchemy` | `>=3.1.1` | ORM integration for Flask | Official Pallets-maintained extension. 3.1.x is the current stable branch (Sep 2023). Wraps SQLAlchemy 2.0 with Flask app context and teardown handling. Simpler than raw SQLAlchemy for Flask apps. |
| `Flask-Migrate` | `>=4.1.0` | Database migrations via Alembic | Official wrapper from Miguel Grinberg. v4.1.0 is latest (Jan 2025). Auto-enables `compare_type=True` (detects column type changes) and `render_as_batch=True`. Adds `flask db init/migrate/upgrade` CLI commands. |
| `psycopg2-binary` | `>=2.9.11` | PostgreSQL driver | v2.9.11 is latest stable (Oct 2025). Binary package -- no C compilation needed in Docker (unlike psycopg2 from source). Reliable for synchronous Flask + SQLAlchemy. NOT psycopg3 (see rationale below). |
| `SQLAlchemy` | `>=2.0.0` | ORM (transitive via Flask-SQLAlchemy) | Pin to 2.x for the new 2.0 API. Do not allow SQLAlchemy 1.x. |

**Why psycopg2-binary and NOT psycopg3:**
The existing codebase uses `asyncio` in `parallel_analyzer.py` (via `aiohttp`/`aiolimiter`). The Flask routes are synchronous (gthread workers). psycopg3's async features would not be used, and psycopg3 has 2.4x slower `executemany` performance compared to psycopg2 in synchronous contexts. psycopg2-binary is the industry standard for synchronous Flask + SQLAlchemy and has prebuilt wheels for `python:3.12-slim-bookworm`. Stick with psycopg2-binary until there is a concrete reason to migrate.

**Railway PostgreSQL specifics:**
- Railway provides managed PostgreSQL (default 100 connection limit on Hobby plan)
- Railway injects `DATABASE_URL` env var automatically -- Flask-SQLAlchemy reads this directly via `SQLALCHEMY_DATABASE_URI`
- Railway offers a Postgres + PgBouncer template for connection pooling if needed
- For 2-10 concurrent users, SQLAlchemy's default pool (`pool_size=5`, `max_overflow=10`) is fine without PgBouncer
- PgBouncer: add only if connection exhaustion errors appear in logs

**SQLAlchemy pool configuration for Railway:**

```python
# app/server.py -- add to create_app()
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://localhost/redlining')
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 3,       # Conservative: Railway Hobby = 100 max connections
    'max_overflow': 5,    # Burst headroom
    'pool_pre_ping': True,  # Detect stale connections after Railway restarts
    'pool_recycle': 300,  # Recycle connections every 5 min (Railway idle timeout)
}
```

---

## Per-User Workspace Isolation Pattern

Do NOT use PostgreSQL Row-Level Security (RLS) for this milestone. RLS requires two database users, separate migration roles, and SQLAlchemy event listener plumbing. It is the right pattern at scale but is over-engineering for a single-developer tool with 2-20 users. The correct approach for this milestone is **application-level user_id scoping**.

### Model Pattern

Every table that contains user data gets a `user_id` column (Clerk user ID string, not integer) as a non-nullable column with an index:

```python
# app/db/models.py -- new file
from app.db import db
from datetime import datetime

class Review(db.Model):
    __tablename__ = 'reviews'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(64), nullable=False, index=True)  # Clerk user ID
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Document metadata
    document_filename = db.Column(db.String(255))
    intake_data = db.Column(db.JSON)  # replaces JSON session file
    analysis_data = db.Column(db.JSON)  # risk map
    review_state = db.Column(db.JSON)  # approved revisions, flags

class Flag(db.Model):
    __tablename__ = 'flags'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id = db.Column(db.String(36), db.ForeignKey('reviews.id'), nullable=False)
    user_id = db.Column(db.String(64), nullable=False, index=True)  # denormalized for query simplicity
    para_id = db.Column(db.String(64), nullable=False)
    note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### Query Pattern

ALL queries are scoped by `g.user_id` from the `@require_auth` decorator. Never query without the filter:

```python
# CORRECT
review = Review.query.filter_by(id=review_id, user_id=g.user_id).first_or_404()

# WRONG -- data leak
review = Review.query.filter_by(id=review_id).first_or_404()
```

### File Storage Pattern

Uploaded .docx files move from `/app/data/uploads/` (flat) to per-user directories:

```
/app/data/uploads/{user_id}/{review_id}/contract.docx
/app/data/uploads/{user_id}/{review_id}/precedent.docx
```

This provides filesystem-level isolation and makes user data easy to audit or delete.

---

## Migration Strategy: Sessions to PostgreSQL

The existing `sessions` dict in `routes.py` and JSON files on disk need migration to PostgreSQL. The recommended approach:

1. Add `Flask-SQLAlchemy` + `Flask-Migrate` + `psycopg2-binary` to `requirements.txt`
2. Create `app/db/__init__.py` with SQLAlchemy instance
3. Create `app/db/models.py` with `Review` and `Flag` models
4. Register SQLAlchemy with `create_app()`
5. Run `flask db init` to create `migrations/` directory
6. Run `flask db migrate -m "initial schema"`
7. Run `flask db upgrade` to apply to Railway PostgreSQL
8. Replace `sessions = {}` dict in routes.py with DB queries
9. Convert each `sessions[session_id]` access to `Review.query.filter_by(...)`

**Railway migration workflow:**

```bash
# Local: generate migration
flask db migrate -m "add reviews table"

# Railway: apply in deploy (add to Dockerfile.flask CMD or a startup script)
flask db upgrade && gunicorn --config gunicorn.conf.py app.server:create_app()
```

Or create a separate one-off Railway deploy command for migrations (preferred for safety).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Auth platform | Clerk | Auth0 | Auth0 SAML costs $34k/yr. Eliminated. |
| Auth platform | Clerk | WorkOS | WorkOS is viable but has thinner Python SDK DX. Clerk wins on Next.js integration speed. |
| Auth platform | Clerk | Supabase Auth | No native SAML/OIDC enterprise connections. Requires building own auth UI. |
| Auth platform | Clerk | Self-hosted Keycloak | Requires running a third service. Operational burden for single developer. |
| PostgreSQL driver | psycopg2-binary | psycopg3 (`psycopg[binary]`) | psycopg3 is 2.4x slower in synchronous executemany. No async benefit in sync Flask. psycopg2-binary is the de facto standard for Flask+SQLAlchemy. |
| ORM | Flask-SQLAlchemy | raw SQLAlchemy | Flask-SQLAlchemy adds app context teardown, CLI integration, and scoped sessions with zero cost. Use it. |
| ORM | Flask-SQLAlchemy | SQLModel | SQLModel merges SQLAlchemy + Pydantic, designed for FastAPI. Wrong tool for Flask. |
| Migrations | Flask-Migrate | raw Alembic | Flask-Migrate wraps Alembic with Flask CLI integration. No reason to use raw Alembic. |
| Tenant isolation | user_id FK scoping | PostgreSQL RLS | RLS requires two DB users, migration role complexity, and SQLAlchemy event listeners. Over-engineering for 2-20 users. FK scoping + query filters is correct at this scale. |
| Connection pooling | SQLAlchemy pool | PgBouncer | PgBouncer adds a third Railway service. Only add if connection exhaustion occurs (unlikely for 2-10 users with pool_size=3). |
| Session JWT | Clerk SDK (`authenticate_request`) | manual JWKS fetch + PyJWT | Manual JWKS is more fragile. Clerk SDK handles key rotation, clock skew, and authorized_parties validation. |

---

## Required Environment Variables (New)

| Variable | Service | Value | Notes |
|----------|---------|-------|-------|
| `CLERK_SECRET_KEY` | flask | `sk_live_...` | Clerk dashboard > API Keys. Never commit. |
| `CLERK_PUBLISHABLE_KEY` | frontend | `pk_live_...` | Clerk dashboard > API Keys. Safe to expose. |
| `DATABASE_URL` | flask | Railway auto-injects | Format: `postgresql://user:pass@host:port/dbname`. Flask-SQLAlchemy reads this automatically. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | frontend | same as `CLERK_PUBLISHABLE_KEY` | Required by `@clerk/nextjs`. Must be prefixed `NEXT_PUBLIC_` to be available client-side. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | frontend | `/sign-in` | Tells Clerk where the sign-in page lives. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | frontend | `/sign-up` | Tells Clerk where the sign-up page lives. |

---

## Installation

```bash
# Backend (add to requirements.txt)
Flask-SQLAlchemy>=3.1.1
Flask-Migrate>=4.1.0
psycopg2-binary>=2.9.11
clerk-backend-api>=5.0.1
PyJWT>=2.8.0

# Frontend (npm install in frontend/)
npm install @clerk/nextjs
```

No other new dependencies needed. The rest of the auth UI (sign-in page, user button, protected layouts) is built using existing shadcn/ui components with Clerk's headless hooks.

---

## What NOT to Add

| Library | Why NOT |
|---------|---------|
| `flask-login` | Manages server-side sessions. Clerk handles auth state. Conflict. |
| `flask-jwt-extended` | Redundant with Clerk SDK's `authenticate_request`. |
| `next-auth` | Duplicate of Clerk. Clerk is the auth provider. |
| `Authlib` | OAuth library for building your own OAuth server. Clerk handles OAuth. |
| `celery` + `redis` | Background job queue. Out of scope for this milestone. |
| `supabase-py` | Not using Supabase. |
| `boto3` (S3) | File storage stays on Railway volume. S3 adds complexity without benefit at this scale. |
| `pgBouncer` (initially) | Add only if Railway logs show connection exhaustion. |

---

## Sources

- [Clerk Python SDK (clerk-backend-api v5.0.1)](https://pypi.org/project/clerk-backend-api/) -- HIGH confidence (official PyPI, Feb 18 2026)
- [Clerk Pricing Feb 2026 Update](https://clerk.com/changelog/2026-02-05-new-plans-more-value) -- HIGH confidence (official changelog)
- [Clerk EASIE SSO + SSO Fee Elimination](https://clerk.com/blog/clerk-launches-easio-sso-and-drops-all-sso-fees) -- HIGH confidence (official blog)
- [Clerk Pricing Page](https://clerk.com/pricing) -- HIGH confidence (official, verified $75/connection, Feb 2026)
- [Auth0 SAML Pricing Analysis](https://securityboulevard.com/2025/10/why-does-auth0-charge-34k-yr-for-2500-maus-to-enable-saml/) -- HIGH confidence (corroborated by multiple sources)
- [WorkOS Pricing](https://workos.com/pricing) -- HIGH confidence (official, $125/SSO connection)
- [Flask-SQLAlchemy 3.1.1 PyPI](https://pypi.org/project/Flask-SQLAlchemy/) -- HIGH confidence (official, Sep 2023)
- [Flask-Migrate 4.1.0 PyPI](https://pypi.org/project/Flask-Migrate/) -- HIGH confidence (official, Jan 2025)
- [psycopg2-binary 2.9.11 PyPI](https://pypi.org/project/psycopg2-binary/) -- HIGH confidence (official, Oct 2025)
- [Railway PostgreSQL + PgBouncer](https://railway.com/deploy/postgres-pgbouncer) -- HIGH confidence (official Railway template)
- [Railway Database Connection Pooling Guide](https://blog.railway.com/p/database-connection-pooling) -- HIGH confidence (official Railway blog)
- [Psycopg2 vs Psycopg3 Performance Benchmark](https://www.tigerdata.com/blog/psycopg2-vs-psycopg3-performance-benchmark) -- MEDIUM confidence (third-party benchmark)
- [Auth Provider Comparison 2026](https://designrevision.com/blog/auth-providers-compared) -- MEDIUM confidence (third-party, corroborated by multiple sources)
- [Supabase vs Clerk Comparison](https://www.devtoolsacademy.com/blog/supabase-vs-clerk/) -- MEDIUM confidence (third-party)
