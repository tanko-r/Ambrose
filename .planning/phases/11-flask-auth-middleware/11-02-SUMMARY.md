# Plan 11-02 Summary: Frontend Token Injection + Env-Var Backend URL

**Status:** Complete
**Completed:** 2026-02-21

## What Was Done

1. **Updated `frontend/src/lib/api.ts`** — Added token provider pattern: `setTokenProvider(fn)` export, `getAuthHeaders()` internal helper. All three fetch helpers (`request`, `requestText`, `requestBlob`) now inject `Authorization: Bearer <token>` header when a provider is set. Replaced hardcoded `FLASK_DIRECT` with `process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'`.

2. **Created `frontend/src/components/providers/auth-token-provider.tsx`** — Client Component that calls `useAuth().getToken` from Clerk and passes it to `api.ts` via `setTokenProvider` on mount. Cleans up on unmount.

3. **Updated `frontend/src/app/layout.tsx`** — `AuthTokenProvider` wraps content inside `ClerkProvider` but outside `ThemeProvider`, ensuring Clerk context is available and tokens are injected before any API calls.

4. **Updated `frontend/next.config.ts`** — Rewrites destination now reads from `NEXT_PUBLIC_BACKEND_URL` env var instead of hardcoded `localhost:${BACKEND_PORT}`.

5. **Updated `frontend/.env.local`** — Added `NEXT_PUBLIC_BACKEND_URL=http://localhost:5000`.

## Verification

- `npx tsc --noEmit` — zero type errors
- `npm run build` — production build succeeds
- `setTokenProvider` is exported from `api.ts`
- `getAuthHeaders()` called 3 times (one per fetch helper)
- `AuthTokenProvider` rendered in `layout.tsx` inside `ClerkProvider`
- `next.config.ts` uses `NEXT_PUBLIC_BACKEND_URL`

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/lib/api.ts` | Modified | Token provider + auth header injection + env-var backend URL |
| `frontend/src/components/providers/auth-token-provider.tsx` | Created | Wires Clerk getToken to api.ts |
| `frontend/src/app/layout.tsx` | Modified | Mounts AuthTokenProvider |
| `frontend/next.config.ts` | Modified | Env-var rewrite destination |
| `frontend/.env.local` | Modified | Added NEXT_PUBLIC_BACKEND_URL |
