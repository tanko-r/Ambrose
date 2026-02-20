# Phase 10: Clerk Frontend Auth - Research

**Researched:** 2026-02-19
**Domain:** Clerk authentication, Next.js 16 App Router, OAuth, MFA
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign up with email and password | `<SignIn />` / `<SignUp />` prebuilt components handle this natively; configure email+password in Clerk Dashboard |
| AUTH-02 | User receives email verification after signup; must verify before accessing app | Clerk dashboard setting: enable email verification code/link; `auth.protect()` in middleware blocks unverified users |
| AUTH-03 | User can reset password via email link | Built into `<SignIn />` component — "Forgot password?" flow is automatic |
| AUTH-04 | User can log in with Google OAuth | Enable Google in Clerk Dashboard SSO connections; no code changes needed for prebuilt components |
| AUTH-05 | User can log in with Microsoft OAuth | Enable Microsoft in Clerk Dashboard SSO connections; no code changes needed for prebuilt components |
| AUTH-06 | User can enable MFA (TOTP/authenticator app) on their account | Enable MFA in Clerk Dashboard; `<UserProfile />` component exposes TOTP setup automatically |
| AUTH-07 | User can log out (including all devices) | `useClerk().signOut()` in single-session context logs out all sessions; `<UserButton />` includes sign-out |
| AUTH-08 | User session persists across browser close/reopen (configurable duration) | Clerk default: 7-day max lifetime; configurable in Dashboard Sessions page; `touchSession` prop controls refresh |
| PROT-02 | Frontend redirects unauthenticated users to sign-in page | `clerkMiddleware` + `createRouteMatcher` + `auth.protect()` in `src/proxy.ts` |
</phase_requirements>

---

## Summary

Clerk is the locked decision for this project. It offers first-class Next.js App Router support and handles all AUTH requirements with minimal custom code. The prebuilt `<SignIn />`, `<SignUp />`, `<UserProfile />`, and `<UserButton />` components cover email/password, OAuth (Google + Microsoft), MFA (TOTP), session management, and sign-out entirely through Dashboard configuration — no custom flows required.

The most significant integration point is the middleware file. Because this project runs **Next.js 16**, the middleware file is named `src/proxy.ts` (not `middleware.ts`, which is the Next.js ≤15 convention). Clerk's `clerkMiddleware()` is placed there, with a route matcher that makes all routes private except `/sign-in(.*)`.

The existing `header.tsx` has a placeholder "Logout" button and a placeholder "Profile" menu item. Both need to be wired to Clerk — the `<UserButton />` component from `@clerk/nextjs` is the cleanest replacement for the entire user dropdown, as it includes the avatar, user name display, account management modal (with TOTP MFA settings), and sign-out in one component.

**Primary recommendation:** Install `@clerk/nextjs@latest` + `@clerk/themes`, create `src/proxy.ts` with `clerkMiddleware()` protecting all routes except `/sign-in`, wrap `layout.tsx` with `<ClerkProvider>` using the `shadcn` theme, create `src/app/sign-in/[[...sign-in]]/page.tsx`, and replace the header's user dropdown with `<UserButton />`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@clerk/nextjs` | 6.37.4 (latest) | Clerk SDK for Next.js App Router | Official SDK; ClerkProvider, hooks, prebuilt components, middleware |
| `@clerk/themes` | latest | Clerk UI theming | shadcn theme auto-matches app's existing shadcn/Tailwind design tokens |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prebuilt `<SignIn />` component | Custom sign-in form via Clerk Elements | Custom flows add weeks of work; prebuilt handles OAuth buttons, email verification, password reset automatically |
| `<UserButton />` in header | Custom user menu with `useUser()` + `useClerk().signOut()` | UserButton has less styling control but handles account management modal with MFA settings out of the box |

**Installation:**
```bash
npm install @clerk/nextjs@latest @clerk/themes
```

---

## Architecture Patterns

### Required File Changes

```
frontend/src/
├── proxy.ts                              # NEW — clerkMiddleware (replaces non-existent middleware.ts)
├── app/
│   ├── layout.tsx                        # MODIFY — wrap with <ClerkProvider>
│   ├── sign-in/
│   │   └── [[...sign-in]]/
│   │       └── page.tsx                  # NEW — <SignIn /> component catch-all route
│   └── (authenticated)/                  # OPTIONAL — route group for clarity
│       └── layout.tsx                    # OPTIONAL — extra auth check if needed
└── components/
    └── layout/
        └── header.tsx                    # MODIFY — replace user dropdown with <UserButton />
```

### Pattern 1: Protect All Routes (allow only /sign-in)

**What:** `clerkMiddleware()` in `src/proxy.ts` makes the entire app private. Only `/sign-in` is public.
**When to use:** App with no public landing page — all paths require auth.

```typescript
// src/proxy.ts
// Source: https://clerk.com/docs/reference/nextjs/clerk-middleware
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

### Pattern 2: ClerkProvider in layout.tsx

**What:** Wraps the entire app to provide auth context. Use `shadcn` theme for visual consistency.

```typescript
// src/app/layout.tsx
// Source: https://clerk.com/docs/nextjs/getting-started/quickstart
import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/themes'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{ baseTheme: shadcn }}
      afterSignOutUrl="/sign-in"
    >
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider>
            {children}
            {/* ...existing providers */}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

**Note:** `ClerkProvider` must be the outermost wrapper — place it outside `ThemeProvider`.

### Pattern 3: Sign-In Page (catch-all route)

**What:** Next.js optional catch-all route hosts the `<SignIn />` component. Clerk uses sub-paths internally (e.g. `/sign-in/factor-one`), so the catch-all is mandatory.

```typescript
// src/app/sign-in/[[...sign-in]]/page.tsx
// Source: https://clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn />
    </div>
  )
}
```

### Pattern 4: UserButton in Header

**What:** Replace the current placeholder user dropdown in `header.tsx` with Clerk's `<UserButton />`. It renders the user's avatar, handles sign-out, and opens the account management modal (which includes TOTP MFA settings automatically once enabled in Dashboard).

```typescript
// src/components/layout/header.tsx — right section
// Source: https://clerk.com/docs/nextjs/reference/components/user/user-button
import { UserButton, SignedIn, SignedOut } from '@clerk/nextjs'

// Replace existing user dropdown with:
<SignedIn>
  <UserButton
    showName={false}
    userProfileMode="modal"
    appearance={{
      elements: {
        avatarBox: 'h-8 w-8',
      }
    }}
  />
</SignedIn>
```

### Pattern 5: Passing Auth Token to Flask Backend

**What:** Clerk issues short-lived JWTs (stored as `__session` cookie). For Flask API calls, the token must be forwarded. The existing Next.js proxy rewrites `/api/*` to Flask — the cookie is forwarded automatically. For explicit Bearer token usage:

```typescript
// Anywhere you need to call Flask with auth
import { useAuth } from '@clerk/nextjs'

const { getToken } = useAuth()
const token = await getToken()
// Pass as Authorization: Bearer <token> header to Flask
```

Flask then validates via PyJWT + JWKS (as previously decided — Phase 10 is frontend only; backend JWT verification is a separate concern).

### Anti-Patterns to Avoid

- **Do NOT use `middleware.ts` filename** — Next.js 16 uses `proxy.ts`. Using the old name will cause the middleware to be silently ignored.
- **Do NOT call `auth()` without `await`** — In `@clerk/nextjs` v6, `auth()` is async. Forgetting `await` returns a Promise, not the auth object.
- **Do NOT wrap `<ClerkProvider>` inside `<ThemeProvider>`** — ClerkProvider must be the outermost provider to render the SignIn redirect correctly.
- **Do NOT add a `/sign-up` route** — The `<SignIn />` component includes a "Don't have an account? Sign up" link that handles registration inline. A separate sign-up page is redundant and creates routing complexity.
- **Do NOT store Clerk's JWT in Zustand** — Zustand does not need to hold auth state. `useAuth()` / `useUser()` hooks are the source of truth, and Clerk manages the token lifecycle automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email verification flow | Custom email send + token verify endpoint | Clerk Dashboard setting (email code/link) + prebuilt `<SignIn />` | Clerk handles OTP generation, expiry (10 min for links), device-matching option |
| Password reset | Custom forgot-password page | Built into `<SignIn />` component | Automatic "Forgot password?" link with secure email link |
| Google/Microsoft OAuth buttons | Custom OAuth redirect flow | Clerk Dashboard SSO connections | Clerk handles PKCE, token exchange, account linking — zero code |
| MFA setup UI | Custom TOTP QR code + backup code flow | Clerk Dashboard + `<UserProfile />` component | TOTP QR generation, backup codes, and enable/disable are built in |
| Session expiry logic | Custom token refresh polling | Clerk's `touchSession` (default: on) | Clerk calls `touch` on the Frontend API on page focus to keep sessions alive |
| Sign-out all devices | Iterating user sessions via API | `useClerk().signOut()` in single-session mode | In single-session apps, `signOut()` deactivates the current session; UserButton sign-out clears all local sessions |
| Auth redirect for unauthenticated users | Manual `useEffect` redirect checks | `auth.protect()` in `proxy.ts` | Server-side redirect before React renders — no flash of unauthenticated content |

**Key insight:** Every AUTH requirement in this phase is addressed by Dashboard configuration + Clerk's prebuilt components. Custom flows are only needed if Clerk's UI is not acceptable, which is not the case here.

---

## Common Pitfalls

### Pitfall 1: Wrong Middleware Filename (Next.js 16)
**What goes wrong:** Auth protection never runs. All routes are accessible without login.
**Why it happens:** Developer creates `src/middleware.ts` following Next.js ≤15 tutorials. Next.js 16 only reads `proxy.ts`.
**How to avoid:** Always create `src/proxy.ts`. Verify with `next info` output or check Next.js 16 upgrade docs.
**Warning signs:** `clerkMiddleware()` logs never appear; unauthenticated users reach protected pages.

### Pitfall 2: `auth()` Called Without `await` (v6 Breaking Change)
**What goes wrong:** `auth()` returns a Promise. Accessing `.userId` on it returns `undefined`. Auth checks silently pass.
**Why it happens:** `@clerk/nextjs` v6 made `auth()` async. Pre-v6 tutorials omit `await`.
**How to avoid:** Always `const { userId } = await auth()` in Server Components and route handlers.
**Warning signs:** `userId` is undefined even when user is signed in; Clerk shows warning "auth() was called but returned a Promise".

### Pitfall 3: `<ClerkProvider>` Inside `<ThemeProvider>`
**What goes wrong:** Next.js rendering errors or hydration mismatches when Clerk redirects to sign-in.
**Why it happens:** Clerk's redirect logic runs at the provider level and needs to be outermost.
**How to avoid:** `<ClerkProvider>` wraps `<html>` → `<body>` → `<ThemeProvider>` in that order.
**Warning signs:** Hydration errors in the browser console on first load of protected pages.

### Pitfall 4: Missing Catch-All Route for Sign-In Page
**What goes wrong:** `<SignIn />` component breaks on sub-paths like `/sign-in/factor-one` (MFA step) or `/sign-in/verify-email-address` — returns 404.
**Why it happens:** Clerk's multi-step auth uses sub-routes internally. A plain `/sign-in/page.tsx` only matches exactly `/sign-in`.
**How to avoid:** Always use the `[[...sign-in]]` optional catch-all pattern.
**Warning signs:** Auth flow works for direct login but fails on password reset, MFA step, or email verification.

### Pitfall 5: Clerk Session Cookie vs. Flask JWT
**What goes wrong:** Flask API returns 401 even though user is authenticated in Next.js.
**Why it happens:** Clerk's `__session` cookie is set on the Clerk domain, not forwarded to Flask, OR Flask is being called directly (not via Next.js proxy rewrite).
**How to avoid:** All API calls must go through the Next.js proxy (`/api/*`). The session cookie IS forwarded through the proxy rewrites. For explicit auth, use `getToken()` and pass as `Authorization: Bearer`.
**Warning signs:** API calls from client components return 401; backend logs show no auth header.

### Pitfall 6: OAuth in Production Requires Custom Credentials
**What goes wrong:** Google/Microsoft OAuth works in dev (Clerk provides shared credentials) but fails in production.
**Why it happens:** Clerk's shared dev credentials don't work on production domains.
**How to avoid:** Before launching, configure custom Google OAuth credentials (Google Cloud Console) and Microsoft OAuth credentials (Azure App Registration) in Clerk Dashboard. This is a Dashboard task, not a code task.
**Warning signs:** OAuth redirects fail or error with "redirect_uri_mismatch" in production.

### Pitfall 7: MFA Not Available Without Dashboard Config
**What goes wrong:** `<UserProfile />` component renders but shows no MFA settings tab.
**Why it happens:** MFA strategies must be explicitly enabled in Clerk Dashboard under "Multi-factor".
**How to avoid:** In Clerk Dashboard → User & Authentication → Multi-factor → enable "Authenticator application" and "Backup codes".
**Warning signs:** UserProfile component renders security tab but TOTP option is absent.

---

## Code Examples

### Complete proxy.ts (Route Protection)
```typescript
// src/proxy.ts
// Source: https://clerk.com/docs/reference/nextjs/clerk-middleware
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

### Complete layout.tsx Integration
```typescript
// src/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/themes'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SmallScreenWarning } from '@/components/small-screen-warning'
import { AxeAccessibility } from '@/components/axe-accessibility'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Contract Review',
  description: 'Collaborative contract review and redlining tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{ baseTheme: shadcn }}
      afterSignOutUrl="/sign-in"
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider>
            {children}
            <SmallScreenWarning />
            <AxeAccessibility />
            <Toaster position="bottom-right" richColors theme="system" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

### Sign-In Page
```typescript
// src/app/sign-in/[[...sign-in]]/page.tsx
// Source: https://clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn />
    </div>
  )
}
```

### Header UserButton Integration
```typescript
// src/components/layout/header.tsx — right-side user area
import { UserButton, SignedIn } from '@clerk/nextjs'

// Inside the right-side <div className="flex items-center gap-2">
// Replace the existing user DropdownMenu block with:
<SignedIn>
  <UserButton
    showName={false}
    userProfileMode="modal"
    appearance={{
      elements: {
        avatarBox: 'h-8 w-8',
      },
    }}
  />
</SignedIn>
```

### Reading User Data in Header (if custom display needed)
```typescript
// For displaying user name/email manually instead of UserButton
'use client'
import { useUser } from '@clerk/nextjs'

function UserDisplay() {
  const { isLoaded, isSignedIn, user } = useUser()
  if (!isLoaded || !isSignedIn) return null
  return (
    <span className="text-sm text-muted-foreground">
      {user.firstName ?? user.emailAddresses[0]?.emailAddress}
    </span>
  )
}
```

### Required .env.local Variables
```bash
# .env.local — get from Clerk Dashboard > API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Tell Clerk where the sign-in page lives
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `authMiddleware()` | `clerkMiddleware()` | @clerk/nextjs v5 | Old API removed in v6; new API is async-first |
| `middleware.ts` filename | `proxy.ts` filename | Next.js 16 | Must rename file — old name is ignored by Next.js 16 |
| `auth()` synchronous | `auth()` async/await | @clerk/nextjs v6 | Must add await everywhere auth() is called |
| `afterSignInUrl` prop | `signInFallbackRedirectUrl` prop on ClerkProvider | @clerk/nextjs v6 | Old props deprecated |
| `ClerkProvider` opts whole app into dynamic rendering | Static by default; add `dynamic` prop to opt in | @clerk/nextjs v6 | Better performance; only matters if using RSC auth data |

**Deprecated/outdated:**
- `authMiddleware()`: Removed in v6. Use `clerkMiddleware()`.
- `afterSignOutUrl` on `<UserButton />`: Deprecated. Configure on `<ClerkProvider>` instead.
- `middleware.ts` filename: Ignored by Next.js 16. Use `proxy.ts`.

---

## Open Questions

1. **Custom appearance for `<SignIn />` component**
   - What we know: The `shadcn` theme from `@clerk/themes` auto-matches shadcn/Tailwind v4 design tokens
   - What's unclear: Whether the shadcn theme correctly picks up the `oklch` color variables defined in `globals.css` for the project's custom design tokens (pure white bg, blue primary)
   - Recommendation: Test in dev. If colors mismatch, pass `variables` override to the `appearance` prop to manually set `colorPrimary`, `colorBackground`.

2. **Dark mode in Clerk's sign-in component**
   - What we know: The `dark` theme from `@clerk/themes` exists; the app uses `next-themes` for dark mode
   - What's unclear: Whether the `shadcn` theme auto-responds to `next-themes` CSS class changes
   - Recommendation: Test toggling theme. If Clerk component stays light in dark mode, dynamically pass `baseTheme: [shadcn, dark]` based on `resolvedTheme` from `useTheme()`.

3. **Sign-out all sessions vs current session**
   - What we know: This is a single-session app (no multi-user switching). `signOut()` in single-session mode deactivates the current session only.
   - What's unclear: Whether AUTH-07 requirement "all browser sessions terminated" means literally all devices or just current
   - Recommendation: Use `<UserButton />` default sign-out behavior (terminates current session). The requirement likely means "no lingering local session", not cross-device revocation. Clerk's Dashboard allows admins to revoke all sessions for a user if needed.

---

## Sources

### Primary (HIGH confidence)
- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) — ClerkProvider setup, env vars, component usage
- [clerkMiddleware() Reference](https://clerk.com/docs/reference/nextjs/clerk-middleware) — route protection patterns, createRouteMatcher, auth.protect()
- [Custom Sign-In Page Guide](https://clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page) — catch-all route pattern, env vars
- [UserButton Component](https://clerk.com/docs/nextjs/reference/components/user/user-button) — props, showName, userProfileMode, sign-out behavior
- [Upgrade to @clerk/nextjs v6](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/nextjs-v6) — breaking changes, async auth(), removed APIs
- [ClerkProvider Reference](https://clerk.com/docs/nextjs/reference/components/clerk-provider) — afterSignOutUrl, touchSession, signInFallbackRedirectUrl
- [Session Options](https://clerk.com/docs/guides/secure/session-options) — max lifetime (7 days default), inactivity timeout
- [useAuth() Reference](https://clerk.com/docs/nextjs/reference/hooks/use-auth) — return values, isLoaded, isSignedIn, userId, getToken
- [shadcn theme changelog](https://clerk.com/changelog/2025-07-23-shadcn-theme) — @clerk/themes shadcn theme, Tailwind v4 support

### Secondary (MEDIUM confidence)
- [Next.js 16 proxy.ts convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — filename change from middleware.ts confirmed via Next.js official docs
- [Sign-up/sign-in options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options) — email verification code vs link configuration
- [Google OAuth Guide](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) — dev vs production credential requirements
- [MFA TOTP Guide](https://clerk.com/docs/guides/development/custom-flows/account-updates/manage-totp-based-mfa) — Dashboard config required, UserProfile handles it

### Tertiary (LOW confidence)
- WebSearch results confirming @clerk/nextjs 6.37.4 is latest version (as of 2026-02-19; verify with npm before install)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Clerk is locked decision; SDK version verified via npm
- Architecture: HIGH — Quickstart docs and v6 upgrade guide confirmed
- Pitfalls: HIGH — middleware filename change confirmed via official Next.js 16 docs; async auth() confirmed via v6 upgrade guide
- OAuth/MFA config: MEDIUM — Dashboard configuration steps confirmed but not hands-on verified

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days — Clerk SDK updates frequently but patterns are stable)
