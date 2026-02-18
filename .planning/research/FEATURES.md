# Feature Landscape: Multi-User Auth + Cloud Deployment

**Domain:** Professional legal SaaS — multi-attorney contract redlining tool
**Researched:** 2026-02-18
**Confidence:** HIGH (auth platform comparison), MEDIUM (legal SaaS-specific UX expectations)

> **Context:** This file replaces the earlier Phase 9 Railway deployment FEATURES.md.
> That content is now absorbed into ROADMAP.md v1.1 phases 9-13.
> This file covers the NEXT milestone: multi-user authentication, workspace isolation,
> PostgreSQL persistence, and professional deployment expectations.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features attorneys assume exist in any professional SaaS tool. Missing these = the product
feels like a prototype, not a product. Attorneys are especially sensitive to data security
perception — even if the tool is only used internally.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Email + password signup/login** | Universal minimum for any web app | LOW | Clerk handles UI, email delivery, hashing. Do not build yourself. |
| **Email verification on signup** | Required before any sensitive document access | LOW | Clerk sends verification email automatically. Block app access until verified. |
| **Password reset via email** | Every SaaS must have this. Absence = trust killer | LOW | Clerk built-in. Zero backend work. |
| **"Remember me" / persistent session** | Attorneys open app across days-long reviews | LOW | Clerk sessions configurable (7-90 days). |
| **Per-user session isolation** | User A cannot see User B's sessions or documents | MEDIUM | Requires user_id on every session record. Sessions query must filter by user_id. |
| **Logout (all devices)** | Security requirement for shared office computers | LOW | Clerk `signOut()` with `sessionId` param for all devices. |
| **Account settings page** | Change email, change password, profile name | LOW | Clerk `<UserProfile />` component drops in. |
| **Google OAuth login** | Most attorneys use Gmail / Google Workspace | LOW | Clerk social connection — one toggle in dashboard. |
| **Secure document storage** | Uploaded contracts must not leak between users | MEDIUM | Documents stored per-user in scoped directory or with user_id prefix. |
| **HTTPS everywhere** | Non-negotiable for legal documents | LOW | Railway provides free SSL on all domains. Already handled. |
| **Data persists across logins** | Sessions, revisions, flags saved permanently | MEDIUM | Requires PostgreSQL migration from file-based storage. Core of this milestone. |

### Differentiators (Competitive Advantage)

Features that signal "professional tool" rather than "developer side project." Attorneys
will compare this to Clio, Harvey, and ContractPodAi mentally, even if it's a personal tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Microsoft / Okta SSO (SAML)** | Law firms standardize on Microsoft 365 or Okta. SSO = zero friction adoption and satisfies IT security review | HIGH | Requires Auth0 or Clerk Enterprise plan. Defer to v2 unless an actual firm is adopting immediately. |
| **Session history / project list** | "Resume where I left off" across multiple devices. Shows all past contracts reviewed | LOW | Fetch all sessions WHERE user_id = $1, render as dashboard. High value, low cost. |
| **User display name in header** | Personalizes the tool, confirms correct account | LOW | `useUser()` from Clerk. Show name or initials avatar in header. |
| **Audit trail (who did what, when)** | Attorneys are accountability-conscious. Useful for billing (time tracking) and ethics compliance | MEDIUM | Log revision_generated, revision_accepted, flag_created events to DB with timestamps. |
| **Invite-only mode** | Allows controlled rollout to colleagues without open public signup | LOW | Waitlist or admin-approved accounts. Clerk supports `allowlist` domains or manual approval. |
| **MFA (TOTP / authenticator app)** | Law firm IT security often requires MFA for cloud tools holding client data | LOW | Clerk supports TOTP and SMS MFA. Single toggle. High signal-to-noise for attorneys. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that sound good in planning but create disproportionate complexity for a
professional tool at this stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Multi-user document sharing / collaboration** | "Share this contract review with my associate" | Real-time collaboration (Yjs/CRDTs) is a major engineering milestone on its own. Permissions model explodes in complexity. | Defer to v2. For now: export Word doc and share it. Attorneys already work this way. |
| **Team/firm workspaces (multi-org)** | Law firms want firm-level accounts | Adds org-level billing, permissions, member management, subdomain routing. Entire feature set. | Individual accounts first. If firm adoption happens, add Clerk Organizations in v2. |
| **Self-hosted / on-premise option** | "Our IT won't allow cloud storage of client data" | Completely different deployment architecture. Dockerization + instructions alone is weeks of work. | Railway with private networking, volume encryption, and SOC 2 note is sufficient for most. Address by case if it becomes a real objection. |
| **Admin dashboard (user management UI)** | "I want to see all users and their activity" | Requires full admin RBAC, separate admin route protection, UI. | Use Clerk dashboard for user management. Use Railway for usage metrics. Build in v2 if needed. |
| **Per-document access controls** | "Share just this clause analysis, not the whole session" | Requires link tokens, permission rows per document, expiry logic | Not needed when sharing = one user per workspace. Export handles this case. |
| **HIPAA BAA / SOC 2 certification** | "Our firm requires compliance certification" | SOC 2 audit takes 3-6 months and significant cost. HIPAA BAA requires Auth0/specific cloud config. | Note: Contract data is not PHI. Legal documents are not healthcare data. HIPAA does not apply. SOC 2 is a future goal, not v2. |

---

## Feature Dependencies

```
Email/Password Auth
    └──requires──> Clerk account + SDK installed
                       └──requires──> CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY env vars
                                          └──requires──> Railway env vars configured

Per-User Session Isolation
    └──requires──> Auth (user has an ID to attach sessions to)
    └──requires──> PostgreSQL (replaces file-based sessions dict)
                       └──requires──> DATABASE_URL env var on Railway

Session History Dashboard
    └──requires──> Per-User Session Isolation
    └──requires──> PostgreSQL (query sessions by user_id)

Google OAuth
    └──requires──> Clerk account (configured as social connection)
    └──enhances──> Email/Password Auth (same user object, additional login method)

MFA
    └──requires──> Email/Password Auth (MFA augments, not replaces)
    └──enhances──> Per-User Session Isolation (stronger identity guarantee)

SAML SSO (Okta/Microsoft)
    └──requires──> Auth0 OR Clerk Enterprise (both cost significantly more)
    └──conflicts──> Clerk free/pro tier (not available on those plans)

Document Storage Isolation
    └──requires──> Auth (user_id to scope uploads directory)
    └──enhances──> Per-User Session Isolation

Audit Trail
    └──requires──> PostgreSQL (append-only events table)
    └──requires──> Auth (user_id on every event)
    └──enhances──> Session History Dashboard (shows activity within sessions)
```

### Dependency Notes

- **PostgreSQL requires auth:** Without user IDs, a sessions table has no way to scope data. Auth must land first.
- **Session history enhances auth:** Once users can log in, showing their history is a natural next step and high-value feature.
- **SAML SSO conflicts with Clerk Pro:** Clerk's SAML/enterprise SSO requires Enterprise plan ($). Use Auth0 if SAML is genuinely required at launch, otherwise defer.
- **Document storage isolation requires auth:** The file system path `app/data/uploads/{user_id}/` cannot be constructed without a stable user ID.

---

## MVP Definition

### Launch With (this milestone)

Minimum required to support multiple attorneys using the tool without data leakage.

- [ ] **Clerk auth installed** — Email + password signup/login with email verification. This is the foundation everything else depends on.
- [ ] **Google OAuth** — Most attorneys use Google Workspace. Friction-free login option.
- [ ] **Per-user workspace isolation** — Every session, document, and flag scoped to authenticated user_id. No user sees another's data.
- [ ] **PostgreSQL sessions table** — Replaces the in-memory `sessions = {}` dict + JSON files on disk. Required for multi-user data integrity.
- [ ] **User profile in header** — Name/avatar in top bar confirms logged-in identity. "Who am I logged in as?"
- [ ] **Protected routes** — Unauthenticated requests to `/api/*` return 401. Frontend redirects to login if no active session.
- [ ] **Session history page** — List of all past contracts reviewed by this user. Resume any session. "My Projects" view.
- [ ] **MFA (optional, user-controlled)** — Clerk TOTP. Single toggle. Signals professional-grade security.

### Add After Validation (v2.x)

Features to add once multi-user is stable and real attorneys are using it.

- [ ] **Audit trail** — Trigger: attorneys ask "when did I do X?" or billing questions arise.
- [ ] **Invite-only / allowlist** — Trigger: opening the tool to colleagues at the same firm.
- [ ] **Microsoft OAuth** — Trigger: a firm using Microsoft 365 wants to adopt. Currently Google covers most personal use.
- [ ] **Custom domain** — Trigger: firm branding or IT approval process requires non-Railway URL.

### Future Consideration (v3+)

Defer until product-market fit is established with multiple real users.

- [ ] **SAML/Okta SSO** — Requires enterprise auth plan + significant configuration. Only needed for firm-wide rollout with IT involvement.
- [ ] **Team workspaces / Clerk Organizations** — Multi-user firms sharing sessions. Major permissions model work.
- [ ] **Admin dashboard** — Only needed when there are enough users to require oversight.
- [ ] **Real-time collaboration** — Fundamentally different product. Engineering milestone on its own.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Email/password auth (Clerk) | HIGH | LOW | P1 |
| Per-user session isolation | HIGH | MEDIUM | P1 |
| PostgreSQL sessions table | HIGH | MEDIUM | P1 |
| Protected API routes | HIGH | LOW | P1 |
| Google OAuth | HIGH | LOW | P1 |
| User profile in header | MEDIUM | LOW | P1 |
| Session history page | HIGH | LOW | P1 |
| MFA (TOTP) | MEDIUM | LOW | P1 |
| Document storage isolation | HIGH | LOW | P1 |
| Audit trail | MEDIUM | MEDIUM | P2 |
| Invite-only / allowlist | LOW | LOW | P2 |
| Microsoft OAuth | MEDIUM | LOW | P2 |
| SAML SSO | LOW | HIGH | P3 |
| Team workspaces | LOW | HIGH | P3 |
| Admin dashboard | LOW | MEDIUM | P3 |
| Real-time collaboration | LOW | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone (multiple attorneys using safely)
- P2: Should have, add when first real firm adopts
- P3: Future consideration, after product-market fit

---

## Competitor Feature Analysis

| Feature | Clio Duo | Harvey AI | ContractPodAi | Our Approach |
|---------|----------|-----------|---------------|--------------|
| Auth method | Email + Google + SSO | Enterprise SSO | Enterprise SSO | Email + Google (Clerk) |
| MFA | Yes | Yes | Yes | TOTP via Clerk |
| Workspace isolation | Per-firm workspace | Per-firm workspace | Per-org workspace | Per-user (individual attorneys) |
| Session history | Yes (matter management) | Not visible | Yes | Simple project list |
| Document sharing | Yes | Yes | Yes | Export Word doc only (defer) |
| SOC 2 | Type II | Type II | Type II | Not yet (future) |
| HIPAA | Not applicable | Not applicable | Not applicable | Not applicable (contract data is not PHI) |

**Key insight:** Competitors target firm-level adoption with enterprise SSO and org workspaces.
This tool targets individual attorney use first. That is the right starting point — individual
is simpler, faster to ship, and the validation step before firm-wide. Do not try to match
Harvey's enterprise feature set in this milestone.

---

## Legal/Professional SaaS-Specific Notes

### Attorney-Client Privilege and Data Handling

Research confirms (NYC Bar Association, AWS multi-tenant whitepapers): attorneys face
professional responsibility concerns about turning over client data to third parties. The
practical implication for this tool:

1. **Data must be clearly scoped per attorney** — no cross-contamination is not optional.
2. **The tool should never log document content** — only metadata (session IDs, timestamps, contract type). Clause text should not appear in application logs.
3. **Deletion should work cleanly** — if an attorney deletes a session, associated files must also be deleted. No orphan data.
4. **HIPAA does not apply** — contract redlining involves real estate and commercial contracts. These are not health records. Do not let this concern scope-creep into HIPAA compliance work.

### Deployment Reliability Expectations

Professional users (attorneys billing hourly) have higher uptime expectations than consumer
app users. Research findings:

- **99.9% uptime is the minimum expectation** for a professional tool (8.76 hours downtime/year)
- **Railway Hobby plan achieves this in practice** for single-region deployments
- **Cold starts matter** — if Railway puts services to sleep, the 5-10 second cold start is noticeable during a billable review session. Disable sleep mode for production.
- **Daily backups of PostgreSQL** are expected. Railway supports manual + automated volume backups. The auth milestone should establish this as a baseline.

---

## Sources

- [Clerk Multi-Tenant Architecture](https://clerk.com/docs/guides/how-clerk-works/multi-tenant-architecture) — HIGH confidence
- [Clerk Organizations for Next.js](https://clerk.com/articles/organizations-and-role-based-access-control-in-nextjs) — HIGH confidence
- [Auth Provider Comparison 2026](https://designrevision.com/blog/auth-providers-compared) — MEDIUM confidence
- [Supabase vs Clerk Comparison](https://www.devtoolsacademy.com/blog/supabase-vs-clerk/) — MEDIUM confidence
- [PostgreSQL Multi-Tenant RLS (AWS)](https://aws.amazon.com/blogs/database/choose-the-right-postgresql-data-access-pattern-for-your-saas-application/) — HIGH confidence
- [Multi-Tenant SaaS Architecture Guide — WorkOS](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) — HIGH confidence
- [SAML SSO for B2B SaaS](https://www.scalekit.com/blog/saml-sso-in-b2b-saas-the-complete-guide-for-developers-and-enterprise-buyers) — HIGH confidence
- [NYC Bar: Cloud Storage and Attorney Obligations](https://www2.nycbar.org/pdf/report/uploads/20072378-TheCloudandtheSmallLawFirm.pdf) — HIGH confidence
- [Legal Tech Platforms 2025 Comparison](https://www.relaw.ai/blog/best-ai-legal-tech-platforms-2025) — MEDIUM confidence
- [SaaS Uptime Expectations 2025](https://squareops.com/knowledge/what-is-sre-uptime-and-why-it-matters-for-saas-companies-in-2025/) — MEDIUM confidence
- [Railway PostgreSQL Docs](https://docs.railway.com/databases/postgresql) — HIGH confidence

---

*Feature research for: Multi-User Auth + Cloud Deployment milestone (contract redlining tool)*
*Researched: 2026-02-18*
