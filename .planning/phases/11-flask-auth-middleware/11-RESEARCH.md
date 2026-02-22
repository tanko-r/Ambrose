# Phase 11: Flask Auth Middleware + API Token Forwarding - Research

**Researched:** 2026-02-21
**Domain:** Flask Blueprint JWT middleware, PyJWT JWKS verification, Next.js token forwarding, Flask-CORS env-var configuration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROT-01 | All /api/* endpoints return 401 without valid auth token | Blueprint-level `before_request` guard covers all 30+ endpoints in `api_bp` in one place; explicit `PUBLIC_ROUTES` set for `/health` exemption |
| PROT-03 | Flask verifies Clerk JWT on every API request via Blueprint-level middleware | `api_bp.before_request` + PyJWT + PyJWKClient against Clerk JWKS URL; singleton client instance provides caching |
| CONF-01 | CORS origins configurable via CORS_ORIGINS env var (falls back to localhost for dev) | `flask-cors` reads `app.config['CORS_ORIGINS']`; populate from `os.environ.get('CORS_ORIGINS', 'http://localhost:3000')` during app factory |
| CONF-03 | Backend URL configurable in frontend via env var (no hardcoded localhost) | `NEXT_PUBLIC_BACKEND_URL` env var replaces hardcoded `'http://localhost:5000'` in `api.ts`; Next.js rewrites destination already reads `BACKEND_PORT` — extend to full URL |
</phase_requirements>

---

## Summary

Phase 11 adds JWT authentication enforcement to Flask's API layer, automatically injects Clerk session tokens from Next.js API calls, and makes CORS and backend URL configurable via environment variables — without touching individual route handler functions.

The Flask side uses a single `api_bp.before_request()` handler (Blueprint-level, not app-level) to intercept every request to `/api/*` before any route logic runs. It extracts the Bearer token from the `Authorization` header, verifies it against Clerk's JWKS endpoint using PyJWT + PyJWKClient (with built-in 5-minute JWKS caching), and returns a 401 if anything fails. A small `PUBLIC_ROUTES` set exempts the `/health` endpoint.

The Next.js side requires changes to `api.ts`: the existing `request()` helper must be wrapped to inject `Authorization: Bearer <token>` on every call. Because `api.ts` is a plain TypeScript module (not a React component), it cannot use the `useAuth()` hook directly. The correct approach is to pass `getToken` as a function at initialization time (setter pattern) or use a Next.js Route Handler as a thin proxy that fetches the token server-side via `auth()` and forwards it. The cleanest fit for this codebase is a **token provider pattern**: `api.ts` exports a `setTokenProvider(fn)` function; a top-level Client Component calls it once with `useAuth().getToken` on mount.

CORS is already handled by `flask-cors` in `server.py`. The current hardcoded regex `r"http://localhost:\d+"` must be replaced with a value read from an environment variable, with a safe local-dev default.

**Primary recommendation:** Add `PyJWT[cryptography]` to requirements.txt; add `before_request` to `api_bp` in `routes.py`; add `setTokenProvider` + token injection to `api.ts`; replace hardcoded CORS origin in `server.py` with env-var-driven list; replace hardcoded `FLASK_DIRECT` in `api.ts` with `process.env.NEXT_PUBLIC_BACKEND_URL`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `PyJWT[cryptography]` | 2.10.x (latest) | JWT decode + RS256 signature verification | Official Python JWT library; `[cryptography]` extra required for RS256 asymmetric keys |
| `PyJWKClient` | bundled with PyJWT | Fetch and cache Clerk's public keys from JWKS endpoint | Built into PyJWT; two-tier cache (JWK Set TTL=300s + per-key LRU); no extra dependency |
| `flask-cors` | >=4.0.0 (already in requirements.txt) | CORS headers + env-var-driven origin list | Already present; reads from `app.config['CORS_ORIGINS']` |
| `@clerk/nextjs` | ^6.38.0 (already installed) | `useAuth().getToken()` for client-side token retrieval; `auth().getToken()` for server-side | Already installed from Phase 10 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT + PyJWKClient | Clerk Python SDK (`authenticate_request`) | SDK wraps the same PyJWT logic but adds a full SDK dependency; PyJWT direct is lighter and already-decided |
| `api_bp.before_request` | Per-route `@require_auth` decorator | Decorator requires touching all 30+ route functions; before_request touches none |
| Token provider singleton in `api.ts` | Next.js Route Handler proxy | Route Handler adds a round-trip hop; token provider is in-process with no latency |
| `NEXT_PUBLIC_BACKEND_URL` env var | Keep `BACKEND_PORT` + construct URL in code | Full URL is more flexible (HTTPS, non-standard paths, Docker service names); already partially done (next.config.ts reads BACKEND_PORT) |

**Installation (backend only — frontend already has Clerk):**
```bash
pip install "PyJWT[cryptography]"
```
Add to `requirements.txt`:
```
PyJWT[cryptography]>=2.10.0
```

---

## Architecture Patterns

### Files Changed

```
app/
├── auth.py                          # NEW — PyJWKClient singleton + verify_clerk_token()
├── api/routes.py                    # MODIFY — add api_bp.before_request(check_auth)
└── server.py                        # MODIFY — env-var-driven CORS_ORIGINS

frontend/
├── src/
│   ├── lib/
│   │   └── api.ts                   # MODIFY — setTokenProvider + inject header; replace FLASK_DIRECT
│   └── components/
│       └── providers/
│           └── auth-token-provider.tsx  # NEW — Client Component that calls setTokenProvider once
```

### Pattern 1: Blueprint-Level JWT Guard (Flask)

**What:** A single `before_request` function on `api_bp` runs before every route in the blueprint. Routes do not need decorators.
**When to use:** When all (or almost all) endpoints in a blueprint require auth.

```python
# app/api/routes.py — add near top after blueprint creation
# Source: Flask docs https://flask.palletsprojects.com/en/3.x/blueprints/#before-request

from app.auth import verify_clerk_token

# Routes that don't require auth — checked by path suffix after /api prefix
PUBLIC_ROUTES = {'/health'}  # health is on app, not blueprint, so this may be empty

@api_bp.before_request
def check_auth():
    # Allow OPTIONS preflight through (CORS handles it)
    if request.method == 'OPTIONS':
        return None

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing or invalid Authorization header'}), 401

    token = auth_header[7:]  # strip "Bearer "
    try:
        payload = verify_clerk_token(token)
        # Store user_id on Flask's per-request context for routes that need it
        from flask import g
        g.clerk_user_id = payload.get('sub')
    except ValueError as e:
        return jsonify({'error': str(e)}), 401
```

### Pattern 2: PyJWKClient Singleton (Flask)

**What:** A module-level `PyJWKClient` instance is created once per process. Its built-in JWK Set cache (TTL=300s) avoids fetching Clerk's JWKS on every request.
**When to use:** Any Flask app verifying external RS256 JWTs at scale.

```python
# app/auth.py — NEW FILE
# Source: PyJWT docs https://pyjwt.readthedocs.io/en/stable/usage.html#retrieve-rsa-signing-keys-from-a-jwks-endpoint

import os
import jwt
from jwt import PyJWKClient

# Clerk Frontend API JWKS URL (preferred over api.clerk.com/v1/jwks)
# Set CLERK_FRONTEND_API_URL to e.g. https://your-instance.clerk.accounts.dev
_CLERK_JWKS_URL = os.environ.get(
    'CLERK_JWKS_URL',
    f"https://{os.environ.get('CLERK_FRONTEND_API_URL', '')}/.well-known/jwks.json"
        if os.environ.get('CLERK_FRONTEND_API_URL')
        else 'https://api.clerk.com/v1/jwks'
)

# Singleton — created once at import time, caches JWKS for 300s (default)
_jwks_client = PyJWKClient(
    _CLERK_JWKS_URL,
    cache_jwk_set=True,   # default True — caches entire JWK Set
    lifespan=300,         # default 300s — re-fetches after 5 minutes
    cache_keys=True,      # enable per-key LRU cache (16 keys max)
    max_cached_keys=16,
)


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk JWT. Returns decoded payload if valid.
    Raises ValueError with a safe message if invalid.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=['RS256'],
            options={
                'verify_exp': True,
                'verify_nbf': True,
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError('Token has expired')
    except jwt.InvalidTokenError as e:
        raise ValueError(f'Invalid token: {e}')
```

**Note on JWKS URL:** Clerk recommends the Frontend API URL (`.well-known/jwks.json` on your Clerk domain) over `api.clerk.com/v1/jwks`. Set `CLERK_FRONTEND_API_URL` to your Clerk Frontend API hostname (found in Clerk Dashboard > API Keys). The fallback to `api.clerk.com/v1/jwks` works in dev when the env var is not set.

### Pattern 3: Env-Var CORS (Flask server.py)

**What:** Parse `CORS_ORIGINS` environment variable as a comma-separated list. Pass to `flask-cors` via `app.config`.
**When to use:** Any deployment environment where allowed origins change without a code deploy.

```python
# app/server.py — replace the hardcoded CORS() call
import os

def create_app():
    app = Flask(__name__)

    # Parse CORS_ORIGINS env var — comma-separated list of allowed origins
    # Dev default: localhost:3000 (Next.js dev server)
    cors_origins_raw = os.environ.get('CORS_ORIGINS', 'http://localhost:3000')
    cors_origins = [o.strip() for o in cors_origins_raw.split(',') if o.strip()]

    CORS(app, origins=cors_origins)
    # ... rest of create_app unchanged
```

**flask-cors note:** `CORS(app, origins=list)` takes precedence over `app.config['CORS_ORIGINS']`. Using the constructor argument directly (as shown) is cleaner than setting `app.config` first and relying on auto-reading.

### Pattern 4: Token Provider in api.ts (Next.js)

**What:** `api.ts` (a plain module, no React context) cannot call hooks. Export a `setTokenProvider` setter. A Client Component calls it once on mount with `useAuth().getToken`. The `request()` helper calls the stored provider before every fetch.

```typescript
// frontend/src/lib/api.ts — additions

// Token provider — set once by AuthTokenProvider component
type TokenProvider = (() => Promise<string | null>) | null;
let _tokenProvider: TokenProvider = null;

export function setTokenProvider(fn: TokenProvider): void {
  _tokenProvider = fn;
}

// Replace the existing request() helper:
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // Inject Clerk JWT if token provider is available
  if (_tokenProvider) {
    const token = await _tokenProvider();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiClientError(res.status, data);
  }
  return res.json();
}

// Replace FLASK_DIRECT constant:
const FLASK_DIRECT = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
```

```typescript
// frontend/src/components/providers/auth-token-provider.tsx — NEW FILE
// Source: Clerk docs https://clerk.com/docs/nextjs/reference/hooks/use-auth
'use client'
import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { setTokenProvider } from '@/lib/api'

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()

  useEffect(() => {
    setTokenProvider(getToken)
    return () => setTokenProvider(null)  // cleanup on unmount
  }, [getToken])

  return <>{children}</>
}
```

```typescript
// Mount in frontend/src/app/layout.tsx — wrap existing providers
// Add inside ClerkProvider, outside ThemeProvider:
import { AuthTokenProvider } from '@/components/providers/auth-token-provider'

// In RootLayout body:
<ClerkProvider ...>
  <html>
    <body>
      <AuthTokenProvider>
        <ThemeProvider>
          {children}
          ...
        </ThemeProvider>
      </AuthTokenProvider>
    </body>
  </html>
</ClerkProvider>
```

### Pattern 5: NEXT_PUBLIC_BACKEND_URL in next.config.ts

**What:** The current hardcoded `FLASK_DIRECT` and the `next.config.ts` rewrite destination both hardcode `localhost:5000`. Replace with a single env var.

```typescript
// frontend/next.config.ts — already partially env-var-driven
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
```

```bash
# frontend/.env.local — add:
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

### Anti-Patterns to Avoid

- **Do NOT put `before_request` on the Flask app** — `app.before_request` would catch `/health` too (which has no auth requirement). Blueprint-level targets only routes registered on `api_bp`.
- **Do NOT check for `__session` cookie in Flask** — `__session` is set on the Clerk domain, not forwarded cross-origin to Flask. All auth flows through `Authorization: Bearer` header.
- **Do NOT create a new `PyJWKClient` per request** — that fetches JWKS on every API call. The singleton approach is mandatory for performance.
- **Do NOT use `useAuth()` inside `api.ts`** — `api.ts` is a plain module; React hooks only work inside components/hooks. The token provider setter pattern solves this correctly.
- **Do NOT add `NEXT_PUBLIC_` prefix to secrets** — `CLERK_SECRET_KEY` must never be `NEXT_PUBLIC_`. `NEXT_PUBLIC_BACKEND_URL` is safe (it's just a URL).
- **Do NOT forget OPTIONS preflight** — `before_request` fires on OPTIONS too. Return `None` to let flask-cors handle the preflight response; returning 401 on OPTIONS breaks CORS.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RS256 signature verification | Custom RSA verify logic | `PyJWT + PyJWKClient` | Key rotation, JWK-to-PEM conversion, algorithm confusion attacks — solved by PyJWT internals |
| JWKS caching | `lru_cache` on `requests.get()` | `PyJWKClient(cache_jwk_set=True, lifespan=300)` | Built-in two-tier cache handles key rotation (kid mismatch triggers re-fetch) automatically |
| Token extraction from headers | Custom header parsing | `request.headers.get('Authorization', '').removeprefix('Bearer ')` | One line; no library needed |
| Per-route auth decorators | `@require_auth` on each of 30+ endpoints | `api_bp.before_request` | One function covers all current and future routes on the blueprint |
| Cross-origin token forwarding in Next.js | Custom server-side proxy | `useAuth().getToken()` + token provider pattern | Clerk manages token refresh automatically; getToken always returns a fresh, valid token |

---

## Common Pitfalls

### Pitfall 1: OPTIONS Preflight Returns 401
**What goes wrong:** Browser CORS preflight (OPTIONS) hits `before_request`, which returns 401 before flask-cors can add `Access-Control-Allow-Origin`. All API calls fail with CORS errors, not 401s — misleading error.
**Why it happens:** `before_request` fires before ANY response headers are set, including CORS headers.
**How to avoid:** First line of the auth check: `if request.method == 'OPTIONS': return None`. Flask-cors then handles the preflight normally.
**Warning signs:** Browser console shows CORS error on all requests, not 401.

### Pitfall 2: JWKS Client Created Per Request
**What goes wrong:** App fetches Clerk's JWKS endpoint on every API call. Rate limited or slow.
**Why it happens:** PyJWKClient instantiated inside the `before_request` function body.
**How to avoid:** Instantiate at module level in `app/auth.py`. The singleton lives for the Flask process lifetime; its internal cache avoids refetches.
**Warning signs:** Network logs show JWKS requests on every API call; Clerk rate limit errors under load.

### Pitfall 3: JWKS URL Misconfiguration
**What goes wrong:** `PyJWKClient` fetches the wrong JWKS URL (e.g., a different Clerk instance), signature verification always fails.
**Why it happens:** `CLERK_FRONTEND_API_URL` or `CLERK_JWKS_URL` not set; fallback points to wrong endpoint.
**How to avoid:** Set `CLERK_JWKS_URL` (or `CLERK_FRONTEND_API_URL`) explicitly in `.env`. Verify by hitting the URL directly in a browser — should return JSON with `{"keys": [...]}`.
**Warning signs:** All valid tokens return 401; PyJWT logs "Unable to find a signing key" errors.

### Pitfall 4: Token Not Injected for Direct Flask Calls
**What goes wrong:** Long-running calls (`revise`, `accept`, `reject`, `reanalyze`) use `FLASK_DIRECT` constant (`http://localhost:5000`) directly and bypass the Next.js rewrite proxy. After this phase, those calls also need `Authorization` header.
**Why it happens:** The existing `api.ts` uses two calling paths: proxied (`/api/*`) and direct (`${FLASK_DIRECT}/api/*`). Both paths go through the same `request()` helper, so if the helper is updated to inject the token, both paths are covered automatically.
**How to avoid:** Confirm `request()`, `requestText()`, and `requestBlob()` all use the updated helper that injects the header. `requestBlob()` currently calls `fetch` directly — update it too.
**Warning signs:** Revise/accept/reject calls work locally (no auth) but fail after auth is enabled.

### Pitfall 5: Token Provider Not Set Before First API Call
**What goes wrong:** App renders, immediately triggers a data-loading API call (e.g., `listSessions()`), but `AuthTokenProvider` hasn't run its `useEffect` yet — no token, 401.
**Why it happens:** `useEffect` runs after first render. If data loading is triggered in the same render cycle, the provider isn't ready.
**How to avoid:** Mount `AuthTokenProvider` as high as possible in the tree (directly inside `ClerkProvider`). Route-level data loading happens in child components that render after the provider's `useEffect`. The Clerk `SignedIn` / route protection means authenticated pages only render after Clerk session is available.
**Warning signs:** First load after sign-in returns 401; subsequent calls succeed.

### Pitfall 6: CORS_ORIGINS Env Var Not Parsed Correctly
**What goes wrong:** Setting `CORS_ORIGINS=https://foo.com,https://bar.com` causes flask-cors to treat the whole string as one origin (including the comma), blocking all requests.
**Why it happens:** Passing the raw env var string directly to `origins=` instead of splitting on commas first.
**How to avoid:** `[o.strip() for o in cors_origins_raw.split(',') if o.strip()]` before passing to `CORS()`.
**Warning signs:** Preflight requests blocked even when Origin matches; flask-cors debug logs show origin mismatch.

---

## Code Examples

### Complete app/auth.py

```python
# app/auth.py — NEW FILE
# Source: PyJWT docs https://pyjwt.readthedocs.io/en/stable/usage.html
# Source: Clerk manual JWT docs https://clerk.com/docs/backend-requests/manual-jwt
import os
import jwt
from jwt import PyJWKClient

# Clerk JWKS URL — use Frontend API URL if set (preferred), else Backend API fallback
_frontend_api = os.environ.get('CLERK_FRONTEND_API_URL', '').rstrip('/')
if _frontend_api:
    _CLERK_JWKS_URL = f"{_frontend_api}/.well-known/jwks.json"
else:
    # Fallback: Backend API JWKS (works in dev; set CLERK_FRONTEND_API_URL for production)
    _CLERK_JWKS_URL = os.environ.get('CLERK_JWKS_URL', 'https://api.clerk.com/v1/jwks')

# Singleton PyJWKClient — module-level for caching
_jwks_client = PyJWKClient(
    _CLERK_JWKS_URL,
    cache_jwk_set=True,    # Cache the entire JWK Set response
    lifespan=300,          # Re-fetch after 5 minutes
    cache_keys=True,       # Also cache individual parsed keys by kid
    max_cached_keys=16,
)


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk session JWT.
    Returns decoded payload dict if valid.
    Raises ValueError with a user-safe message if invalid.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=['RS256'],
            options={
                'verify_exp': True,
                'verify_nbf': True,
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError('Token expired')
    except jwt.InvalidTokenError as e:
        raise ValueError(f'Invalid token: {e}')
```

### Blueprint before_request Addition (routes.py)

```python
# app/api/routes.py — add after api_bp = Blueprint('api', __name__)
from flask import g

@api_bp.before_request
def check_auth():
    """Require valid Clerk JWT for all API endpoints."""
    # Pass OPTIONS through — flask-cors handles preflight
    if request.method == 'OPTIONS':
        return None

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authentication required'}), 401

    token = auth_header[7:]  # strip "Bearer "
    try:
        from app.auth import verify_clerk_token
        payload = verify_clerk_token(token)
        g.clerk_user_id = payload.get('sub')  # available to all routes
    except ValueError as e:
        return jsonify({'error': str(e)}), 401
```

### Updated server.py CORS Section

```python
# app/server.py — replace CORS(app, origins=[r"http://localhost:\d+"])
cors_origins_raw = os.environ.get('CORS_ORIGINS', 'http://localhost:3000')
cors_origins = [o.strip() for o in cors_origins_raw.split(',') if o.strip()]
CORS(app, origins=cors_origins)
```

### Updated api.ts Token Injection

```typescript
// frontend/src/lib/api.ts — updated FLASK_DIRECT and request helper

const FLASK_DIRECT = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

type TokenProvider = (() => Promise<string | null>) | null;
let _tokenProvider: TokenProvider = null;

export function setTokenProvider(fn: TokenProvider): void {
  _tokenProvider = fn;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!_tokenProvider) return {};
  const token = await _tokenProvider();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string>),
      ...authHeaders,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiClientError(res.status, data);
  }
  return res.json();
}

async function requestText(url: string, options?: RequestInit): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string>),
      ...authHeaders,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiClientError(res.status, data);
  }
  return res.text();
}

async function requestBlob(url: string): Promise<Blob> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) {
    throw new ApiClientError(res.status, { error: `Download failed: HTTP ${res.status}` });
  }
  return res.blob();
}
```

### New AuthTokenProvider Component

```typescript
// frontend/src/components/providers/auth-token-provider.tsx — NEW FILE
// Source: Clerk useAuth() docs https://clerk.com/docs/nextjs/reference/hooks/use-auth
'use client'
import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { setTokenProvider } from '@/lib/api'

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()

  useEffect(() => {
    setTokenProvider(getToken)
    return () => setTokenProvider(null)
  }, [getToken])

  return <>{children}</>
}
```

### .env.local additions (frontend)

```bash
# frontend/.env.local — add:
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

### Flask .env additions

```bash
# .env (project root) — add:
CLERK_FRONTEND_API_URL=https://your-instance.clerk.accounts.dev
CORS_ORIGINS=http://localhost:3000
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-route `@require_auth` decorator | `Blueprint.before_request()` | Flask 0.7+ | One guard covers all current + future endpoints; no missed routes |
| `requests.get(jwks_url)` + `lru_cache` | `PyJWKClient(cache_jwk_set=True)` | PyJWT 2.4+ | Built-in two-tier cache + automatic key rotation handling |
| `python-jose` for JWT verification | `PyJWT[cryptography]` | 2022–2024 | `python-jose` unmaintained; PyJWT is actively maintained with RS256 support |
| Hardcoded FLASK_DIRECT in api.ts | `process.env.NEXT_PUBLIC_BACKEND_URL` | This phase | Required for deployment to non-localhost backends |

**Deprecated/outdated:**
- `python-jose`: Last release 2022. Use `PyJWT[cryptography]` instead.
- `flask-jwt-extended`: Appropriate when Flask owns the auth (issues tokens itself). Not needed here — Clerk issues tokens, Flask only verifies.
- `@app.before_request` for API auth: Would intercept `/health` and any non-API routes added in future. Use `@api_bp.before_request` for targeted coverage.

---

## Open Questions

1. **azp (authorized parties) claim validation**
   - What we know: Clerk docs state validating `azp` is "highly recommended" to prevent CSRF. The `azp` value is the origin of the requesting app (e.g., `http://localhost:3000`).
   - What's unclear: Whether the `azp` claim is set in Clerk's default session tokens for Next.js or only when using JWT templates.
   - Recommendation: Add optional `azp` check — if `payload.get('azp')` is present, verify it matches `CORS_ORIGINS`. Make it a warning/log rather than hard rejection initially to avoid breaking dev flows, then harden after confirming `azp` is set.

2. **Flask dev server vs production WSGI: singleton `_jwks_client` behavior**
   - What we know: Flask debug mode uses a single process by default; the singleton works. If deployed with gunicorn multi-worker, each worker process gets its own `_jwks_client` instance (separate JWKS caches).
   - What's unclear: Whether Railway (the target production host) uses gunicorn workers or single-process.
   - Recommendation: Non-issue for correctness (each worker independently caches JWKS). If JWKS fetch volume is a concern at scale, a shared cache (Redis) can be added later. Not needed now.

3. **Token expiry during long-running analysis jobs**
   - What we know: Clerk session tokens expire by default after 1 minute (short-lived); `getToken()` on the client automatically refreshes them using the session cookie.
   - What's unclear: The `/api/analysis/{session_id}/progress` polling endpoint is called repeatedly during the multi-minute async analysis job. If the token expires mid-job, polling calls will 401.
   - Recommendation: Since `getToken()` handles refresh automatically on the client, each poll call fetches a fresh token. This is fine as long as `AuthTokenProvider` is mounted for the duration. No server-side change needed.

---

## Sources

### Primary (HIGH confidence)
- [Clerk Manual JWT Verification](https://clerk.com/docs/backend-requests/manual-jwt) — JWKS URL options (Frontend API preferred), token location (cookie vs header), required claim validation (exp, nbf, azp)
- [PyJWT PyJWKClient source](https://github.com/jpadilla/pyjwt/blob/master/jwt/jwks_client.py) — `__init__` signature with `cache_jwk_set`, `lifespan`, `cache_keys`, `max_cached_keys`; `get_signing_key_from_jwt` method
- [PyJWT Usage Docs](https://pyjwt.readthedocs.io/en/stable/usage.html) — Basic PyJWKClient usage, `jwt.decode()` with RS256 and options dict
- [Clerk useAuth() Docs](https://clerk.com/docs/nextjs/reference/hooks/use-auth) — `getToken()` client-side usage, returns Promise<string|null>
- [Clerk auth() Docs](https://clerk.com/docs/references/nextjs/auth) — Server-side `auth().getToken()` in Route Handlers
- [flask-cors Configuration Docs](https://flask-cors.readthedocs.io/en/latest/configuration.html) — `origins` parameter, priority over `app.config`, comma-separated value handling
- [Flask Blueprint.before_request Docs](https://flask.palletsprojects.com/en/3.x/blueprints/#before-request) — Blueprint-level pre-request hook

### Secondary (MEDIUM confidence)
- [Clerk Making Requests Guide](https://clerk.com/docs/guides/development/making-requests) — Authorization Bearer header pattern confirmed for cross-origin requests
- [PyJWKClient caching issue thread](https://github.com/jpadilla/pyjwt/issues/615) — Two-tier caching behavior (JWK Set + per-key LRU) documented in issue comments

### Tertiary (LOW confidence)
- WebSearch results confirming Clerk's recommended JWKS URL is Frontend API (`.well-known/jwks.json`) rather than Backend API (`api.clerk.com/v1/jwks`) — cross-referenced with official Clerk JWKS docs

---

## Metadata

**Confidence breakdown:**
- Standard stack (PyJWT, PyJWKClient): HIGH — Official PyJWT source code read directly; constructor signature confirmed
- Blueprint `before_request` pattern: HIGH — Flask official docs
- CORS env-var pattern: HIGH — flask-cors docs confirm `app.config` and constructor arg behavior
- Token injection via provider pattern: HIGH — Clerk `useAuth()` docs confirmed; pattern is idiomatic React
- JWKS URL recommendation (Frontend API preferred): MEDIUM — Clerk docs state both work; FastAPI community examples confirm Frontend API URL convention

**Research date:** 2026-02-21
**Valid until:** 2026-03-23 (30 days — PyJWT and flask-cors are stable; Clerk API patterns change slowly)
