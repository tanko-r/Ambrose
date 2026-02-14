# Phase 8: Cleanup + Cutover - Research

**Researched:** 2026-02-13
**Domain:** Flask/Next.js migration cleanup, dev workflow streamlining
**Confidence:** HIGH

## Summary

Phase 8 is a cleanup and cutover phase with no new libraries or complex integrations. The work consists of five discrete operations: (1) archiving the old vanilla JS frontend in `app/static/`, (2) stripping Flask's static-file-serving code from `app/server.py`, (3) adding a root-level `package.json` with a `concurrently`-based dev script, (4) updating all documentation to reflect the Next.js-only frontend, and (5) sweeping the codebase for stale references to the old frontend.

The primary risk is accidentally breaking the Flask API by removing too much from `server.py`, or missing stale references that confuse future developers. The codebase is well-understood and the changes are mechanical.

**Primary recommendation:** Archive `app/static/` to `_archived/static/`, remove Flask's `static_folder` config and `index()` route, add a root `package.json` with `concurrently` to run both servers, then sweep all docs.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| concurrently | ^9.x | Run Flask + Next.js dev servers in parallel from one command | Most popular npm package for parallel process management (40M+ weekly downloads), colored output per process, automatic cleanup |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | This phase requires no additional supporting libraries |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| concurrently (npm) | npm-run-all / run-p | npm-run-all is less maintained; concurrently has better error handling and process coloring |
| concurrently (npm) | Shell script (start.sh / start.ps1) | Shell scripts are platform-specific; David uses Git Bash on Windows, so a cross-platform npm solution is better |
| concurrently (npm) | docker-compose | Overkill for dev; docker-compose is planned for Phase 9 (Railway deployment) |
| concurrently (npm) | Makefile | David doesn't have Make installed; less ergonomic on Windows |

**Installation:**
```bash
# From project root (not frontend/)
npm init -y
npm install --save-dev concurrently
```

## Architecture Patterns

### Recommended Root package.json Structure

The root `package.json` acts as a dev orchestrator only -- it does NOT contain the Next.js app. The Next.js app stays in `frontend/`.

```json
{
  "name": "claude-redlining",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently --kill-others-on-fail --names flask,next --prefix-colors blue,green \"python run.py\" \"npm run dev --prefix frontend\"",
    "dev:flask": "python run.py",
    "dev:next": "npm run dev --prefix frontend",
    "build": "npm run build --prefix frontend"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

### Pattern 1: Archive Rather Than Delete

**What:** Move `app/static/` to `_archived/static/` at project root, rather than deleting it.
**When to use:** When removing legacy code that may be needed for reference during the transition.
**Why:** The old vanilla JS frontend has useful implementation patterns that were ported to React (e.g., `revision.js` -> `track-changes.ts`). Archiving preserves git history access at the original path while clearly marking the code as retired. Also, if something was missed in the migration, the archived code is immediately available for reference.

### Pattern 2: Flask API-Only Server

**What:** Strip Flask's static file serving so it only handles `/api/*` and `/health`.
**When to use:** After the Next.js frontend fully replaces the old HTML/JS frontend.
**Example of current code to modify (`app/server.py`):

```python
# CURRENT (lines 22-45) -- serves static files + has index route
app = Flask(__name__,
            static_folder='static',
            static_url_path='/static')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')
```

```python
# TARGET -- API-only, no static serving
app = Flask(__name__)

# Remove: @app.route('/') index() handler
# Keep: @app.route('/health') health() handler
# Keep: app.register_blueprint(api_bp, url_prefix='/api')
```

### Pattern 3: Unused Import Cleanup

**What:** After removing `send_from_directory`, clean up the import line in `server.py`.
**Current:**
```python
from flask import Flask, send_from_directory
```
**Target:**
```python
from flask import Flask
```

### Anti-Patterns to Avoid

- **Deleting the archive too early:** Keep `_archived/` until at least Phase 9 (Railway deployment) is complete and the app is verified in production.
- **Leaving the root `/` route dead:** Without `index()`, hitting `http://localhost:5000/` returns 404. This is correct behavior -- the Flask backend is API-only. But ensure `run.py`'s startup message directs users to `http://localhost:3000` instead of `:5000`.
- **Breaking the CI workflow:** `.github/workflows/npm-publish.yml` runs `npm ci` and `npm test` from the root. Currently there's no root `package.json`. Adding one changes CI behavior. Review this file and either update it or leave it alone (it's for npm publishing, which this project doesn't use).

## Current State Inventory

### Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `app/server.py` | Remove `static_folder`, `static_url_path`, `send_from_directory` import, `index()` route | Flask should only serve API |
| `run.py` | Update startup message to point to `localhost:3000` | Users should open Next.js, not Flask |
| `README.md` | Major update: remove "Migration from Vanilla JS" section, update "Development Status", update "Common Tasks", update architecture diagram | Reflects Next.js-only reality |
| `app/README.md` | Remove references to `app/static/`, update "Quick Start" to remove `localhost:5000` browser instruction | Old README describes vanilla JS frontend |
| `NOTES.md` | Minor cleanup: mark old items as historical | Session notes reference old frontend |
| `.planning/codebase/ARCHITECTURE.md` | Update Presentation Layer to point to `frontend/` instead of `app/static/` | Stale architecture doc |
| `.planning/codebase/STRUCTURE.md` | Update `app/static/` section, add note about `_archived/` | Stale structure doc |
| `tasks/todo.md` | Mark Phase 8 items complete | Progress tracker |
| `.github/workflows/npm-publish.yml` | Review/update or remove | Currently runs `npm ci`/`npm test` from root, which will now find the new root `package.json` |

### Files to Move (Archive)

| Source | Destination | Size |
|--------|-------------|------|
| `app/static/` (entire directory) | `_archived/static/` | 415KB |

Contents of `app/static/`:
- `index.html` (36KB) -- single-page app
- `css/main.css` (128KB) -- all styles
- `js/` (18 files, ~225KB total) -- modular vanilla JS: `analysis.js`, `api.js`, `app.js`, `bottombar.js`, `document.js`, `flag.js`, `intake.js`, `menu.js`, `navigation.js`, `new-project.js`, `precedent.js`, `revision.js`, `sidebar.js`, `state.js`, `toast.js`, `utils.js`, `views.js`

### Files to Create

| File | Purpose |
|------|---------|
| `package.json` (root) | Dev orchestrator with `concurrently` for one-command startup |
| `.gitignore` addition | Add `_archived/` to gitignore? Or keep tracked for reference. Decision: keep tracked -- it's only 415KB and useful for reference. |

### Files That Already Reference the Old Frontend (sweep targets)

Found via grep across `*.md`, `*.py`, `*.ts` files:

1. **`app/server.py`** -- `static_folder='static'`, `send_from_directory(app.static_folder, 'index.html')` (CRITICAL: modify)
2. **`README.md`** -- "Migration from Vanilla JS" section, "app/static/" in project structure, "Currently migrating" language (UPDATE)
3. **`app/README.md`** -- "Frontend webapp (vanilla JS)", "open http://localhost:5000" (UPDATE)
4. **`NOTES.md`** -- "Refactored index.html into modular CSS/JS files" (MINOR: historical context, can leave)
5. **`.planning/codebase/ARCHITECTURE.md`** -- Presentation Layer points to `app/static/` (UPDATE)
6. **`.planning/codebase/STRUCTURE.md`** -- Documents `app/static/` contents (UPDATE)
7. **`.planning/codebase/CONCERNS.md`** -- References `app/static/js/sidebar.js` etc. (UPDATE or annotate as historical)
8. **`docs/conversation-snapshots/2026-01-29-ui-ux-design-session.md`** -- References `app/static/js/` (LEAVE: historical snapshot)
9. **`frontend/src/lib/track-changes.ts`** -- Comment "Ported from app/static/js/revision.js" (LEAVE: useful provenance comment)
10. **`frontend/src/components/review/track-changes-editor.tsx`** -- Comment "Ported from app/static/js/revision.js" (LEAVE: useful provenance comment)
11. **`tasks/todo.md`** -- Phase 8 checklist items (UPDATE when complete)
12. **`.planning/ROADMAP.md`** -- Phase 8 success criteria (LEAVE: planning doc)
13. **Phase research docs (03, 04, 05)** -- Reference old `app/static/js/*.js` files as source material (LEAVE: historical research)

### Classification of References

| Category | Action | Files |
|----------|--------|-------|
| **Code that serves old frontend** | MUST modify | `app/server.py` |
| **Docs describing current architecture** | MUST update | `README.md`, `app/README.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` |
| **Code comments noting provenance** | LEAVE (useful context) | `track-changes.ts`, `track-changes-editor.tsx` |
| **Historical snapshots/research** | LEAVE (read-only history) | `docs/conversation-snapshots/`, phase research docs, `NOTES.md` |
| **Planning docs** | LEAVE (planning artifacts) | `.planning/ROADMAP.md`, `.planning/codebase/CONCERNS.md` |
| **Progress tracker** | UPDATE when complete | `tasks/todo.md` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel process runner | Bash script with `&` and `trap` | `concurrently` npm package | Cross-platform (Windows/Mac/Linux), colored output, proper signal handling, `--kill-others-on-fail` |
| Root monorepo orchestration | Custom CLI tool | Root `package.json` scripts | Standard pattern, no learning curve, npm handles it |

**Key insight:** This is a cleanup phase. There is zero justification for building anything custom. Every operation is a file move, a code deletion, a doc edit, or an npm install.

## Common Pitfalls

### Pitfall 1: Breaking Flask by Removing Too Much

**What goes wrong:** Removing `static_folder` from Flask constructor might break if any other code (e.g., routes.py) references `current_app.static_folder` or `url_for('static', ...)`.
**Why it happens:** Flask has a default `static_folder` even if you don't set one. Removing the constructor arg changes behavior but doesn't eliminate the attribute.
**How to avoid:** Grep for `static_folder`, `url_for('static'`, and `send_from_directory` across all `.py` files before modifying. Verified: only `app/server.py` references these (confirmed via grep above).
**Warning signs:** Flask startup errors, 500 errors on API calls.

### Pitfall 2: CI Workflow Breaks After Adding Root package.json

**What goes wrong:** `.github/workflows/npm-publish.yml` runs `npm ci` and `npm test` from the project root. A new root `package.json` without a `test` script causes `npm test` to fail.
**Why it happens:** The workflow was boilerplate and likely never actually ran (there's no npm registry publishing configured for this project).
**How to avoid:** Either (a) add a `"test": "echo no tests"` script to root `package.json`, or (b) update/remove the workflow file, or (c) leave it alone since it only triggers on GitHub releases which aren't being used.
**Warning signs:** GitHub Actions failures on release creation.

### Pitfall 3: Stale References Create Confusion

**What goes wrong:** Future developers (or David returning after a break) find docs pointing to `app/static/` which no longer exists.
**Why it happens:** Incomplete doc sweep -- easy to miss references in `.planning/` subdirectories.
**How to avoid:** Run a comprehensive grep after archiving. For historical/research docs, add a note like "NOTE: `app/static/` has been archived to `_archived/static/`" rather than rewriting history.
**Warning signs:** Confusion when onboarding or resuming after a break.

### Pitfall 4: run.py Still Points Users to :5000

**What goes wrong:** `run.py` prints a startup banner saying "Open http://localhost:5000". After cutover, the frontend is at :3000.
**Why it happens:** `run.py` was the original entry point when Flask served everything.
**How to avoid:** Update the banner text. If using `concurrently` via root `package.json`, the `run.py` banner is less prominent, but `run.py` still works standalone (for backend-only development), so update it to say "API server running at :5000. Open http://localhost:3000 for the UI."
**Warning signs:** User opens :5000 and sees a 404.

### Pitfall 5: Forgetting to Update app/__init__.py Docstring

**What goes wrong:** `app/__init__.py` says "A Flask-based webapp for interactive contract review with AI-powered redlining." After cutover, Flask is just the API backend.
**Why it happens:** Easy to overlook a 5-line init file.
**How to avoid:** Include in the doc sweep task.

## Code Examples

### server.py After Cleanup

```python
#!/usr/bin/env python3
"""
Contract Review API Server

Flask-based backend providing REST API endpoints for the contract redlining webapp.
The frontend is served separately by Next.js.
"""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from flask import Flask
from flask_cors import CORS
from app.api.routes import api_bp

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Allow cross-origin requests from Next.js dev server (any localhost port)
    CORS(app, origins=[r"http://localhost:\d+"])

    # Configuration
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload
    app.config['UPLOAD_FOLDER'] = Path(__file__).parent / 'data' / 'uploads'
    app.config['SESSION_FOLDER'] = Path(__file__).parent / 'data' / 'sessions'

    # Ensure data directories exist
    app.config['UPLOAD_FOLDER'].mkdir(parents=True, exist_ok=True)
    app.config['SESSION_FOLDER'].mkdir(parents=True, exist_ok=True)

    # Register blueprints
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/health')
    def health():
        return {'status': 'ok'}

    return app
```

### run.py Startup Banner After Cleanup

```python
print(f"""
+==================================================================+
|           Contract Review API Server                             |
+==================================================================+
|  API running at: http://localhost:{port:<5}                          |
|  Frontend at:    http://localhost:3000                            |
|                                                                  |
|  Start both with: npm run dev (from project root)                |
|  Press Ctrl+C to stop the server.                                |
+==================================================================+
""")
```

### Root package.json

```json
{
  "name": "claude-redlining",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently --kill-others-on-fail -n flask,next -c blue,green \"python run.py\" \"npm run dev --prefix frontend\"",
    "dev:flask": "python run.py",
    "dev:next": "npm run dev --prefix frontend",
    "build": "npm run build --prefix frontend",
    "test": "echo \"See pytest for backend tests\""
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flask serves HTML + API | Flask serves API only, Next.js serves UI | This phase (Phase 8) | Clean separation of concerns |
| Two terminal windows to start dev | One `npm run dev` command | This phase (Phase 8) | Better DX |
| `python run.py` as primary entry point | `npm run dev` as primary, `python run.py` for backend-only | This phase (Phase 8) | Aligns with Node.js-first workflow |

**Deprecated/outdated after this phase:**
- `app/static/` -- archived to `_archived/static/`
- Opening `http://localhost:5000` in browser -- Flask no longer serves HTML
- "vanilla JS frontend" terminology in docs -- replaced by Next.js

## Open Questions

1. **Should `_archived/` be git-tracked or gitignored?**
   - What we know: The directory is 415KB (tiny). It's useful reference material. Git history preserves it either way.
   - What's unclear: Whether David wants it visible in the repo or hidden.
   - Recommendation: Keep it git-tracked. It's small, provides immediate reference without `git log` spelunking, and can be removed in a future cleanup. Add a README inside `_archived/` explaining what it is.

2. **Should the `.github/workflows/npm-publish.yml` be updated or removed?**
   - What we know: It's a boilerplate workflow for npm publishing. This project is private and doesn't publish to npm. It only triggers on GitHub releases.
   - What's unclear: Whether David has any plans to use GitHub releases.
   - Recommendation: Remove it. It's unused boilerplate that will cause confusing CI failures if a release is ever accidentally created. If npm publishing is needed later, it can be recreated.

3. **Should `app/README.md` be removed or updated?**
   - What we know: It describes the old Flask-serves-everything architecture. The root `README.md` is the canonical project documentation.
   - What's unclear: Whether a backend-specific README adds value.
   - Recommendation: Update it to be a backend-focused README describing just the API layer, services, and data models. Remove all frontend references.

4. **Should `BOTTOM-SHEET-SUMMARY.md`, `GITHUB-ISSUE-CONTEXT.md`, and other root-level markdown files be cleaned up?**
   - What we know: These are working documents from specific development sessions. They add clutter to the root.
   - Recommendation: Out of scope for Phase 8 (which is specifically about old-frontend cleanup). Can be addressed as a separate housekeeping task.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** -- Direct reading of `app/server.py`, `run.py`, `README.md`, `app/README.md`, `package.json`, `.gitignore`, `.github/workflows/npm-publish.yml`, and all files in `app/static/`
- **Grep results** -- Comprehensive search for `static`, `static_folder`, `send_from_directory`, `index.html`, `vanilla`, `legacy`, `app/static` across all `.py`, `.ts`, `.tsx`, `.md`, `.json`, `.yml` files
- **[concurrently npm package](https://www.npmjs.com/package/concurrently)** -- Official npm page confirming API, `--kill-others-on-fail`, `-n` naming, `-c` coloring flags

### Secondary (MEDIUM confidence)

- **[How to Run Multiple NPM Scripts Using Concurrently](https://peoray.dev/blog/using-concurrently)** -- Confirmed `concurrently` usage pattern for multi-server setups
- **[Concurrently NPM package explained](https://jimfilippou.com/articles/2025/concurrently-npm-package-explained)** -- 2025 article confirming current API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `concurrently` is the only new dependency, well-established and widely used
- Architecture: HIGH -- all changes are mechanical modifications to existing files, no new patterns
- Pitfalls: HIGH -- identified from direct codebase inspection, all verifiable

**Research date:** 2026-02-13
**Valid until:** Indefinite (cleanup phase, no version-sensitive dependencies)
