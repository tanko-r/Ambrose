# Plan 10-01 Summary: Install Clerk SDK, Middleware, ClerkProvider, Sign-In Page

**Completed:** 2026-02-19
**Status:** Done

## What Was Built

1. **Clerk SDK installed** -- `@clerk/nextjs@latest` and `@clerk/themes` added to frontend dependencies (14 new packages).

2. **Route-protection middleware** (`frontend/src/proxy.ts`) -- Uses `clerkMiddleware` + `createRouteMatcher` to protect all routes except `/sign-in(.*)`. File is named `proxy.ts` per Next.js 16 convention (not `middleware.ts`).

3. **Environment template** (`frontend/.env.local`) -- Contains placeholder values for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and Clerk routing vars. Already covered by `.gitignore` (`.env*` pattern).

4. **ClerkProvider in layout** (`frontend/src/app/layout.tsx`) -- `ClerkProvider` wraps the entire app as the outermost provider (outside `<html>`), using `shadcn` theme from `@clerk/themes` and `afterSignOutUrl="/sign-in"`. Added `export const dynamic = "force-dynamic"` to prevent static page generation from failing when Clerk keys are not yet configured.

5. **Sign-in page** (`frontend/src/app/sign-in/[[...sign-in]]/page.tsx`) -- Catch-all route hosting Clerk's prebuilt `<SignIn />` component, centered on screen. The catch-all pattern is required for Clerk's multi-step flows (MFA, email verification, password reset).

## Verification

- `npx tsc --noEmit` -- passes with zero errors
- `npm run build` -- passes, all routes render as dynamic (force-dynamic)
- `proxy.ts` exists at correct path (not `middleware.ts`)
- `.env.local` has all required Clerk env vars (placeholder values)

## Files Changed

| File | Action |
|------|--------|
| `frontend/package.json` | Modified (added @clerk/nextjs, @clerk/themes) |
| `frontend/src/proxy.ts` | Created |
| `frontend/.env.local` | Created |
| `frontend/src/app/layout.tsx` | Modified (ClerkProvider wrapper, force-dynamic) |
| `frontend/src/app/sign-in/[[...sign-in]]/page.tsx` | Created |

## User Action Required

Before the auth flow will work, David must:
1. Create a Clerk application at https://dashboard.clerk.com
2. Enable email+password, Google OAuth, Microsoft OAuth, and MFA in the Dashboard
3. Replace the placeholder values in `frontend/.env.local` with real API keys
