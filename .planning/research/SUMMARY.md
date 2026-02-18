# Project Research Summary

**Project:** Contract Redlining Tool -- v1.1 Users and Deployment
**Domain:** Professional legal SaaS -- multi-user contract redlining with auth, persistent storage, and cloud deployment
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

This milestone transforms a single-user prototype into a multi-user professional tool. The existing Flask + Next.js stack is sound; what must be added is an identity layer (Clerk), a persistent data layer (PostgreSQL via Flask-SQLAlchemy), and proper workspace isolation so that attorneys never see each others confidential documents. Research strongly recommends Clerk over all alternatives: Auth0 is eliminated due to approximately 34k/year SAML pricing; Supabase Auth lacks native SAML support; WorkOS is viable but has thinner Python SDK DX. Clerk wins because it has the best Next.js integration of any auth provider, a functional Python backend SDK (v5.0.1, Feb 2026), a built-in organization model for future firm-level sharing, and a free tier covering the entire development and early validation phase. The recommended database approach is Flask-SQLAlchemy + Flask-Migrate + psycopg2-binary, using PostgreSQL for lightweight structured metadata and keeping large analysis JSON blobs on the Railway Volume filesystem.

The single most important architectural decision in this milestone is making the blocking LLM analysis endpoint asynchronous before any Railway deployment. Railway enforces a hard 5-minute HTTP timeout at the network layer that cannot be overridden by application configuration. The current analysis endpoint runs synchronously for up to 30 minutes -- this is an absolute deployment blocker. The fix exists in the codebase already (background threading via threading.Thread); the work is restructuring the endpoint to return 202 immediately and let the existing polling pattern handle progress. Every other milestone concern is either well-understood or recoverable; this one is not.

Security posture requires particular attention because this tool handles attorney-client privileged documents. Three risks must be addressed simultaneously when adding auth: (1) all legacy Flask routes must be protected at the Blueprint level rather than per-route to avoid missed endpoints, (2) session lookups must filter by user_id in every database query to prevent IDOR attacks, and (3) uploaded files must be stored in user-scoped paths so that file system organization independently enforces isolation. These are not optional hardening steps -- they are the minimum threshold for a professional legal tool.

---

## Key Findings

### Recommended Stack

New backend dependencies: clerk-backend-api>=5.0.1 (Clerk Python SDK for JWT verification with automatic JWKS key rotation), Flask-SQLAlchemy>=3.1.1 (ORM with Flask app-context integration), Flask-Migrate>=4.1.0 (Alembic-based schema migrations via Flask CLI), psycopg2-binary>=2.9.11 (synchronous PostgreSQL driver -- psycopg3 is NOT recommended because its async advantages do not apply to synchronous Flask, and it is 2.4x slower in synchronous executemany). Frontend addition: @clerk/nextjs (latest 6.x). No other new dependencies are needed -- the rest of the auth UI is built from existing shadcn/ui components.

**Core technologies:**
- Clerk: Identity provider -- best Next.js integration, functional Python SDK, free until SSO needed, built-in org model for v2 firm workspaces
- Flask-SQLAlchemy + Flask-Migrate: ORM + migrations -- official Pallets-maintained stack, Alembic under the hood, Flask CLI integration
- psycopg2-binary: PostgreSQL driver -- synchronous, pre-built Docker wheels, industry standard for sync Flask+SQLAlchemy
- PyJWT + PyJWKClient: JWT verification -- more reliable than Clerk Python SDK for Flask; JWKS key caching eliminates per-request network calls
- Railway PostgreSQL plugin: Managed Postgres -- auto-injects DATABASE_URL, pool_size=3 appropriate for Hobby plan (100 connection limit)

**What NOT to add:** flask-login, flask-jwt-extended, next-auth, Authlib, celery+redis, boto3/S3 (Railway Volume sufficient at this scale), pgBouncer (add only if connection exhaustion appears in logs).

### Expected Features

**Must have (table stakes for this milestone):**
- Email + password signup/login with email verification -- Clerk handles UI, delivery, and hashing
- Google OAuth -- most attorneys use Google Workspace; one toggle in Clerk dashboard
- Per-user workspace isolation -- every session, document, and flag scoped to authenticated user_id; no data bleed between users
- PostgreSQL sessions table -- replaces the in-memory sessions dict + JSON files; required for multi-user data integrity
- Protected routes -- all /api/* return 401 without valid Clerk JWT; frontend redirects to login
- Session history page -- list of past contracts reviewed by this user, resumable (My Projects view)
- User profile in header -- name/avatar confirms identity; useUser() from Clerk
- Document storage isolation -- uploaded files in user-scoped directories
- MFA (TOTP) -- single Clerk toggle; high signal-to-noise for legal professional context

**Should have (differentiators, add after validation):**
- Audit trail -- log revision_generated, revision_accepted, flag_created events with timestamps
- Invite-only/allowlist mode -- controlled rollout to colleagues; Clerk supports domain allowlists
- Microsoft OAuth -- for firms using Microsoft 365

**Defer to v2+:**
- SAML/Okta SSO -- requires Clerk Enterprise plan (5/connection/month); only when a real firm with IT involvement adopts
- Team/firm workspaces -- Clerk Organizations add org-level billing and permissions model; build after individual-user validation
- Admin dashboard -- use Clerk dashboard for user management until scale demands custom UI
- Real-time collaboration -- fundamentally different product; defer indefinitely

**Anti-features (do not build):** Self-hosted/on-premise deployment, per-document access controls, HIPAA compliance work (contract data is not PHI -- HIPAA does not apply to real estate or commercial contracts).

### Architecture Approach

The architecture adds three orthogonal concerns to the existing Flask + Next.js stack: an identity layer (Clerk), a persistent metadata layer (PostgreSQL), and workspace isolation (user_id scoping throughout). Storage is split by data type: PostgreSQL holds lightweight structured data (user records, session metadata, file paths); the Railway Volume holds large blobs (uploaded .docx files, parsed document JSON at 500KB-5MB, analysis JSON at 1-3MB). The in-memory sessions dict is retained as a performance cache over PostgreSQL. JWT verification happens at the Flask Blueprint before_request hook -- one place that protects all 30+ endpoints automatically without per-route decoration. The Next.js middleware.ts (replacing the existing proxy.ts) combines Clerk route protection with API proxying and token injection in a single file.

**Major components:**
1. Clerk (SaaS) -- identity: login, signup, session tokens, JWKS public keys
2. Next.js middleware.ts -- route protection + API proxying with Authorization: Bearer token injected on every /api/* request
3. Flask before_request on api_bp -- verify Clerk JWT; set g.clerk_user_id; upsert user record in PostgreSQL; no per-route decorator needed
4. PostgreSQL users + contract_sessions tables -- persistent metadata with user_id FK on all session records
5. Railway Volume (/data/uploads/{user_id}/{session_id}/) -- binary file storage with user-scoped paths for filesystem-level isolation

**Build order (strict dependency chain):**
1. Clerk in Next.js (frontend auth, no backend changes) -- can run in parallel with step 2
2. PostgreSQL + SQLAlchemy models (independent of auth)
3. Flask JWT middleware (requires knowing Clerk JWT format from step 1)
4. Next.js proxy token injection (requires Flask to accept tokens from step 3)
5. Session storage migration + user scoping (requires all prior steps)
6. Railway deploy with both services configured

### Critical Pitfalls

1. **Railway 5-minute HTTP timeout kills LLM analysis** -- The blocking GET /api/analysis endpoint must be split into POST .../start (returns 202 immediately) + polling via existing GET .../progress. This is an absolute deploy blocker. The threading infrastructure already exists -- this is a restructuring task. Must be done before any Railway deployment.

2. **sessions dict global wiped on every deploy and invisible across Gunicorn workers** -- With 2 workers, requests for the same session can hit different workers and return Session not found. On Railway redeploy, all in-memory state is gone. Fix: migrate session metadata to PostgreSQL; retain dict only as a performance cache.

3. **All legacy routes left open when adding auth** -- With 30+ existing endpoints, per-route decoration is error-prone. Use Blueprint-level @api_bp.before_request with an explicit PUBLIC_ROUTES allowlist. Every new route is automatically protected; public routes must be explicitly opted out. Gate or remove /load-test-session before deployment.

4. **IDOR -- session lookup without ownership filter exposes confidential documents** -- Even after JWT verification, get_session(session_id) without a user_id filter lets any authenticated user access another users session by UUID. Fix: make user_id a mandatory second parameter of get_session().

5. **Clerk webhook async race condition -- user missing on first API call** -- Clerk user.created webhook arrives asynchronously via Svix (2-10 second delay). A user who signs up and immediately hits the API triggers a FK constraint error. Fix: add lazy get_or_create_user() in the JWT middleware, using INSERT ... ON CONFLICT DO UPDATE.

---

## Implications for Roadmap

Phase numbering continues from v1.0 (which ended at Phase 8.1). The prior v1.1 scope covered only Railway deployment (Phases 9-13). This milestone expands that to include user management.

### Phase 9: Database Migration + Async Analysis Fix

**Rationale:** Must come first because it resolves two absolute blockers: the in-memory session dict that dies on every deploy, and the blocking analysis endpoint that Railway 5-minute timeout kills. This phase is independent of auth. Phases 9 and 10 can be developed in parallel.

**Delivers:** PostgreSQL schema with users and contract_sessions tables; Flask-SQLAlchemy + Flask-Migrate configured; get_session() and save_session() backed by PostgreSQL; analysis endpoint restructured to POST /start (202) + GET /progress polling; large-document analysis completes on Railway without timeout.

**Addresses:** Data persists across logins; sessions survive Railway redeploys; analysis completes for large documents.

**Avoids:** Pitfalls 1 (Railway timeout blocker), 2 (sessions dict wiped on deploy), 10 (DB connection pool exhaustion -- configure pool_size=3 + pool_pre_ping=True), 12 (Alembic migration risk -- use alembic stamp head + test on dev DB first), 15 (parsed_doc blob memory bloat).

### Phase 10: Clerk Auth -- Frontend + Route Protection

**Rationale:** Frontend auth can be developed independently from backend auth middleware. Installing Clerk in Next.js, adding sign-in/sign-up pages, and wrapping layout.tsx with ClerkProvider are entirely self-contained. Phases 9 and 10 can be developed in parallel.

**Delivers:** Working email/password signup and login; Google OAuth; user profile avatar/name in header; protected routes (unauthenticated users redirect to sign-in); MFA (TOTP) enabled via Clerk dashboard toggle; sign-in and sign-up pages at /sign-in and /sign-up.

**Uses:** @clerk/nextjs 6.x; ClerkProvider in layout.tsx; clerkMiddleware() in middleware.ts for route protection only (proxy behavior added in Phase 11).

**Avoids:** Pitfall 8 (JWT in browser storage -- use getToken() per request, never localStorage).

### Phase 11: Flask Auth Middleware + API Token Forwarding

**Rationale:** Connects the frontend auth from Phase 10 to the Flask backend. Requires knowing the Clerk JWT format (established in Phase 10). The Next.js proxy token injection and Flask JWT verification must be deployed simultaneously -- both halves must work together for the end-to-end auth flow.

**Delivers:** Flask before_request JWT verification on the api_bp Blueprint using PyJWT + PyJWKClient with JWKS caching (1-hour TTL); g.clerk_user_id available in all route handlers; Next.js middleware.ts upgraded to combine Clerk auth protection + API proxy with Authorization: Bearer token injection; CORS updated to ALLOWED_ORIGINS env var (replacing localhost hardcode); /load-test-session gated to development only.

**Uses:** PyJWT + PyJWKClient; CLERK_ISSUER_URL env var; ALLOWED_ORIGINS env var for Flask-CORS.

**Avoids:** Pitfalls 3 (CORS localhost hardcode), 4 (legacy routes left open), 13 (Clerk Python SDK gaps -- use PyJWT directly with RS256 not HS256).

### Phase 12: Workspace Isolation + Session Storage Migration

**Rationale:** The integration phase. Requires all three prior phases: PostgreSQL (Phase 9), user identity (Phase 10), and g.clerk_user_id in Flask (Phase 11). Wires user identity into every session read/write and file storage path. This is where multi-user safety is actually established.

**Delivers:** get_session(session_id, user_id) filters by both columns in PostgreSQL; save_session() upserts to PostgreSQL with user FK; uploaded files stored at {user_id}/{session_id}/ paths; GET /api/sessions returns only sessions belonging to authenticated user; lazy get_or_create_user() in JWT middleware resolves webhook race condition; session history page in frontend.

**Avoids:** Pitfalls 5 (IDOR -- ownership check in get_session), 6 (file paths with no user scope), 7 (Clerk webhook race -- lazy user creation), UX pitfall (no session list on login).

### Phase 13: Railway Deployment + Production Validation

**Rationale:** Deployment comes last because it depends on all functional components being complete and locally tested. The verification checklist from PITFALLS.md provides a concrete test plan.

**Delivers:** Flask and Next.js services on Railway with private network communication; Railway PostgreSQL plugin configured; DATABASE_URL auto-injected; Clerk env vars set on both services; flask db upgrade as Railway release command; Gunicorn with gthread workers (--worker-class gthread --threads 4 --workers 2 --timeout 1800); .gitattributes with *.sh eol=lf; api.txt and .env in .dockerignore; sleep mode disabled; daily PostgreSQL backups confirmed.

**Avoids:** Pitfalls 9 (Gunicorn gevent conflicts with asyncio -- use gthread), 11 (finalization latency -- verify under 5 minutes), 16 (Windows CRLF in shell scripts), 17 (API keys in Docker image).

### Phase Ordering Rationale

- Phase 9 (DB + async analysis) is independent of auth and unblocks both data integrity AND Railway viability. Must come before Phases 11 and 12.
- Phases 9 and 10 can be developed in parallel (frontend auth vs. backend DB are independent concerns).
- Phase 11 is strictly sequential after Phase 10 (needs Clerk JWT format) and after Phase 9 (needs user_id storable in PostgreSQL).
- Phase 12 is the integration phase -- requires all three prior phases.
- Phase 13 (deployment) is last -- validates the complete system in production.

### Research Flags

Phases needing careful implementation (patterns are known but execution is tricky):

- **Phase 9 (Alembic on existing project):** Use alembic stamp head to baseline before generating the first migration. Review every auto-generated migration before applying. Test on a dev database before touching production PostgreSQL.
- **Phase 11 (PyJWT + Clerk JWKS):** Specifically the azp claim validation and algorithm specification (RS256, not HS256). PITFALLS.md has the exact code pattern. Cache PyJWKClient at module load, not per-request.
- **Phase 12 (get_session refactor):** Touches call sites across all 30+ routes in routes.py. Code review all call sites after the change to confirm none missed the user_id parameter.

Phases with standard, well-documented patterns (low implementation risk):

- **Phase 10 (Clerk frontend):** Clerk Next.js documentation is comprehensive. ClerkProvider + middleware.ts + sign-in pages is a 2-3 hour task.
- **Phase 13 (Railway deployment):** Phase 9 plan already covers Dockerfiles and Railway service configuration. Adding PostgreSQL plugin and Clerk env vars is low-risk incremental work.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library recommendations backed by official PyPI pages and changelogs. Clerk pricing verified against official changelog dated Feb 5, 2026. psycopg2 vs psycopg3 from third-party benchmark corroborated by SQLAlchemy community consensus. |
| Features | HIGH (auth) / MEDIUM (legal SaaS UX) | Auth feature set is well-defined by Clerk capabilities. Legal SaaS UX expectations inferred from competitor analysis and NYC Bar Association guidance, not direct attorney interviews. |
| Architecture | HIGH | Patterns verified against Clerk docs, Railway docs, Flask-SQLAlchemy docs, and direct inspection of the existing codebase (routes.py, server.py, store.ts). Code samples in ARCHITECTURE.md are ready-to-implement. |
| Pitfalls | HIGH | Derived from direct inspection of specific anti-patterns in the current code: the sessions dict on line 50 of routes.py, the blocking analysis endpoint, the localhost CORS config, the unprotected route list. These are documented vulnerabilities in the current code, not hypothetical concerns. |

**Overall confidence:** HIGH

### Gaps to Address

- **Railway Volume vs. Buckets for file storage:** PITFALLS.md recommends Railway Buckets (S3-compatible); ARCHITECTURE.md recommends keeping the Railway Volume for this milestone. Genuine tradeoff: Volume is simpler (no boto3) but is single-mount and lacks URL-based access. Start with Railway Volume; add Buckets only if document loss or multi-instance scaling becomes a real problem. Flag as a post-launch monitoring item.

- **Exact Railway HTTP timeout value:** Research found conflicting information -- Railway help station says 5 minutes at the network layer while some sources cite 15 minutes. The conservative stance (treat as 5 minutes and require async analysis) is correct regardless. The async fix is required either way.

- **SAML SSO timing:** Clerk Enterprise SSO pricing (5/connection/month) makes SAML economical for 1-3 Okta clients, but the trigger is whether David has actual firm clients ready to adopt. This is a product decision, not a technical gap. Defer to v2 planning.

---

## Sources

### Primary (HIGH confidence)
- Clerk Python SDK (clerk-backend-api v5.0.1) https://pypi.org/project/clerk-backend-api/ -- auth SDK, JWT verification
- Clerk Pricing Feb 2026 Update https://clerk.com/changelog/2026-02-05-new-plans-more-value -- SSO fee elimination, Pro plan pricing
- Clerk Next.js Quickstart https://clerk.com/docs/nextjs/getting-started/quickstart -- ClerkProvider, middleware.ts, route protection
- Clerk Manual JWT Verification https://clerk.com/docs/backend-requests/manual-jwt -- JWKS endpoint, RS256 verification, azp claim
- Clerk webhook delivery guarantees https://clerk.com/docs/guides/development/webhooks/syncing -- at-least-once, async, race condition
- Flask-SQLAlchemy 3.1.1 https://pypi.org/project/Flask-SQLAlchemy/ -- ORM setup
- Flask-Migrate 4.1.0 https://pypi.org/project/Flask-Migrate/ -- Alembic migrations for Flask
- psycopg2-binary 2.9.11 https://pypi.org/project/psycopg2-binary/ -- PostgreSQL driver
- Railway PostgreSQL Docs https://docs.railway.com/databases/postgresql -- managed Postgres, DATABASE_URL injection, connection limits
- Railway HTTP timeout https://station.railway.com/questions/any-workarounds-for-the-5-min-request-ti-b055adde -- 5-minute network layer cap confirmed
- Railway Volumes https://docs.railway.com/reference/volumes -- ephemeral vs volume storage
- Railway Buckets https://docs.railway.com/storage-buckets -- S3-compatible object storage pricing
- Flask-Migrate on existing projects https://blog.miguelgrinberg.com/post/how-to-add-flask-migrate-to-an-existing-project -- alembic stamp head pattern
- NYC Bar Cloud Storage https://www2.nycbar.org/pdf/report/uploads/20072378-TheCloudandtheSmallLawFirm.pdf -- data scoping requirements for legal tools
- Auth0 SAML Pricing https://securityboulevard.com/2025/10/why-does-auth0-charge-34k-yr-for-2500-maus-to-enable-saml/ -- Auth0 elimination rationale

### Secondary (MEDIUM confidence)
- Auth Provider Comparison 2026 https://designrevision.com/blog/auth-providers-compared -- Clerk vs WorkOS vs Auth0 comparison
- Supabase vs Clerk https://www.devtoolsacademy.com/blog/supabase-vs-clerk/ -- Supabase Auth SAML gap
- Psycopg2 vs Psycopg3 Benchmark https://www.tigerdata.com/blog/psycopg2-vs-psycopg3-performance-benchmark -- synchronous executemany comparison
- Legal Tech Platforms 2025 https://www.relaw.ai/blog/best-ai-legal-tech-platforms-2025 -- competitor feature analysis
- SaaS Uptime Expectations 2025 https://squareops.com/knowledge/what-is-sre-uptime-and-why-it-matters-for-saas-companies-in-2025/ -- 99.9% uptime expectation

### Tertiary (LOW confidence -- patterns adapted from adjacent domains)
- Clerk with Next.js and Express https://mtarkar.medium.com/integrating-next-js-clerk-auth-with-express-9c7f0407c6f0 -- token injection pattern (not Flask-specific; adapted)
- Clerk + FastAPI JWT verification https://medium.com/@didierlacroix/building-with-clerk-authentication-user-management-part-2-implementing-a-protected-fastapi-f0a727c038e9 -- Flask adaptation of FastAPI patterns

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
