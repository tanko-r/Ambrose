# Plan 11-01 Summary: Backend JWT Guard + Env-Var CORS

**Status:** Complete
**Completed:** 2026-02-21

## What Was Done

1. **Created `app/auth.py`** — Singleton `PyJWKClient` that caches Clerk's JWKS (public keys) for 5 minutes. Exports `verify_clerk_token(token) -> dict` which verifies RS256 JWTs and returns the decoded payload. Raises `ValueError` with safe messages on failure.

2. **Added `before_request` guard to `api_bp`** in `app/api/routes.py` — Every API request under `/api/*` must include a valid `Authorization: Bearer <token>` header. OPTIONS preflight passes through for CORS. On success, `g.clerk_user_id` is set from the JWT `sub` claim for downstream route use.

3. **Updated CORS in `app/server.py`** — Replaced hardcoded regex `r"http://localhost:\d+"` with env-var-driven `CORS_ORIGINS` (comma-separated list, defaults to `http://localhost:3000`).

4. **Added `PyJWT>=2.10.0` and `cryptography>=42.0.0` to `requirements.txt`**.

## Verification

- `python -c "from app.auth import verify_clerk_token"` — import succeeds
- `before_request_funcs` shows `['check_auth']` registered on `api_bp`
- `GET /health` returns 200 (no auth, app-level route)
- `GET /api/sessions` without auth returns 401 `{"error": "Authentication required"}`
- `OPTIONS /api/sessions` returns 200 (CORS preflight passes)
- `GET /api/sessions` with invalid token returns 401 `{"error": "Invalid token: Not enough segments"}`

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `app/auth.py` | Created | PyJWKClient singleton + verify_clerk_token |
| `app/api/routes.py` | Modified | Added `check_auth` before_request guard |
| `app/server.py` | Modified | Env-var CORS_ORIGINS |
| `requirements.txt` | Modified | Added PyJWT + cryptography |
