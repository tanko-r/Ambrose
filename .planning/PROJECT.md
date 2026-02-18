# Claude Redlining

## What This Is

A collaborative legal contract review tool that helps attorneys analyze documents for risks and opportunities, then generate surgical redlines. Built for David, a real estate lawyer, to reduce the 8+ hours typically spent manually redlining PSAs and other complex agreements.

## Core Value

The tool must analyze contracts intelligently (understanding cross-clause relationships) and generate precise, surgical redlines that attorneys can confidently present to clients and opposing counsel.

## Current Milestone: v1.1 Users and Deployment

**Goal:** Make the app multi-user and cloud-deployable on Railway — individual workspaces with auth, PostgreSQL storage, Docker containers, and production infrastructure.

**Target features:**
- Multi-user with individual workspaces (per-user projects and sessions)
- Auth platform (email/password + OAuth + SSO/Okta) — platform TBD via research
- PostgreSQL for user accounts, session metadata, and project data
- Dockerized backend (gunicorn + Flask) and frontend (Next.js standalone)
- Session resilience across server restarts
- Environment-variable-driven configuration (URLs, CORS, data paths)
- Railway deployment with persistent storage and health checks
- Background analysis to avoid HTTP timeouts
- Zero breaking changes to local development workflow

## Requirements

### Validated

- ✓ Document intake with DOCX upload, representation selection, aggressiveness level — v1.0
- ✓ Contract parsing with section hierarchy, numbering, and defined term extraction — v1.0
- ✓ Risk analysis via Claude Opus with concept mapping and cross-clause awareness — v1.0
- ✓ Risk/opportunity display in sidebar with severity and related clauses — v1.0
- ✓ Revision generation via Gemini Flash with track-changes visualization — v1.0
- ✓ Revision acceptance with automatic concept/risk map updates — v1.0
- ✓ Flagging paragraphs for client or attorney review — v1.0
- ✓ Session persistence to disk with resume capability — v1.0
- ✓ Next.js frontend migration with Tailwind + shadcn/ui — v1.0
- ✓ Precedent split view with related clause highlighting — v1.0
- ✓ Finalize/export Word documents with track changes — v1.0
- ✓ Flag system with categories and margin icons — v1.0

### Active

*(Detailed requirements in REQUIREMENTS.md — will be defined after research)*

### Out of Scope

- Document sharing between users — deferred to future milestone
- Team/organization accounts — individual workspaces only for now
- Automatic clause library building — may add in future milestone
- CI/CD pipeline — Railway auto-deploys from GitHub, no custom pipeline needed
- SSL/TLS configuration — Railway handles HTTPS automatically

## Context

v1.0 delivered the full local tool: Next.js frontend migration, intake through analysis, revision workflow, precedent comparison, flagging, finalization, and Word export. The app is feature-complete for local use as a single-user tool.

v1.1 expands the app to multi-user and deploys it to Railway. Two major workstreams: (1) User management — auth platform integration, PostgreSQL database, per-user workspace isolation, session migration from file-based to DB-backed. (2) Cloud infrastructure — Docker containers, env-var config, Railway deployment, background analysis for long-running jobs. The Flask backend has heavy Python dependencies (python-docx, redlines, scikit-learn, anthropic, google-genai) so it stays Python/Flask.

## Constraints

- **Tech stack**: Python/Flask backend, Next.js frontend — existing architecture preserved
- **Document fidelity**: Output Word docs must preserve original formatting exactly
- **LLM costs**: Use Gemini Flash for generation, Claude Opus only for analysis
- **Backward compatibility**: Local dev workflow (`python run.py` + `npm run dev`) must work unchanged
- **Platform**: Railway for hosting (PaaS with Docker support, persistent volumes)
- **Single worker**: Analysis is I/O-bound (LLM API calls), single gunicorn worker + threads sufficient

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Tailwind v4 + shadcn/ui | Modern stack, Vercel aesthetic | ✓ Good |
| Zustand over Redux | Simpler API for single-user app | ✓ Good |
| Track changes via python-redlines | Maintains Word compatibility | ✓ Good |
| Email via default client (mailto:) | Simplest cross-platform integration | ✓ Good |
| Railway over Vercel/Fly.io | PaaS simplicity, persistent volumes, two-service support | — Pending |
| Gunicorn with 30-min timeout | Analysis takes 5-30+ min; single worker + 4 threads for I/O | — Pending |
| File-based sessions (not Redis/DB) | Single user, adequate for current scale | ⚠️ Revisit — migrating to PostgreSQL for multi-user |
| Auth platform over custom auth | Email + OAuth + SSO needs, single dev, pragmatic | — Pending |
| PostgreSQL for user/session data | Multi-user requires proper database; Railway has managed Postgres | — Pending |

---
*Last updated: 2026-02-18 after v1.1 milestone redefinition (Users and Deployment)*
