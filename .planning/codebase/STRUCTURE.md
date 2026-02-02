# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
claude-redlining/
├── app/                            # Flask application root
│   ├── __init__.py
│   ├── server.py                   # Flask app creation and configuration
│   ├── api/                        # API routes layer
│   │   ├── __init__.py
│   │   └── routes.py               # All 15+ REST endpoints (intake, analysis, revise, finalize, flags, etc.)
│   ├── services/                   # Business logic services
│   │   ├── __init__.py
│   │   ├── document_service.py     # Parse/rebuild docx, generate final outputs
│   │   ├── claude_service.py       # Claude Opus 4.5 risk analysis (batched)
│   │   ├── gemini_service.py       # Gemini 3 Flash revision generation
│   │   ├── analysis_service.py     # Regex-based fallback analysis
│   │   └── map_updater.py          # ConceptMap and RiskMap updates on revision
│   ├── models/                     # Domain models
│   │   ├── __init__.py
│   │   ├── concept_map.py          # Legal provisions grouped by category
│   │   └── risk_map.py             # Risk hierarchy with severity calculation
│   ├── data/                       # Runtime data storage
│   │   ├── sessions/               # Session JSON files (auto-created)
│   │   └── uploads/                # Uploaded contract files (auto-created)
│   ├── static/                     # Frontend assets
│   │   ├── index.html              # Single-page application entry
│   │   ├── css/                    # Stylesheets
│   │   │   ├── style.css
│   │   │   └── ... (theme, responsive, etc.)
│   │   └── js/                     # Frontend modules
│   │       ├── app.js              # App initialization, tab/sidebar management
│   │       ├── intake.js           # Intake form, file upload handling
│   │       ├── document.js         # Document rendering with paragraphs
│   │       ├── analysis.js         # Analysis display, risk card rendering
│   │       ├── sidebar.js          # Sidebar risk/opportunities panel (47KB - largest)
│   │       ├── revision.js         # Revision display, track changes diff (34KB)
│   │       ├── navigation.js       # Document navigation, paragraph jumping
│   │       ├── bottombar.js        # Bottom sheet for revision details
│   │       ├── menu.js             # Top menu, session actions
│   │       ├── flag.js             # Flag UI for client/attorney notes
│   │       ├── state.js            # Centralized AppState object
│   │       ├── utils.js            # Utility functions
│   │       ├── api.js              # API client wrapper
│   │       ├── views.js            # View switching logic
│   │       └── toast.js            # Toast notification system
│   └── README.md                   # Local documentation
├── run.py                          # Application entry point (check deps, start server)
├── requirements.txt                # Python dependencies
├── README.md                       # Project overview
├── CLAUDE.md                       # Project context for Claude (4-phase pipeline explanation)
├── NOTES.md                        # User notes and session context
├── .planning/
│   └── codebase/                   # Codebase documentation (this directory)
│       ├── ARCHITECTURE.md         # Architecture analysis
│       └── STRUCTURE.md            # This file
├── tests/                          # Test directory (minimal coverage)
│   ├── __init__.py
│   └── test_claude_service.py
├── docs/                           # Documentation
│   ├── conversation-snapshots/     # Past conversation records
│   └── plans/                      # Implementation plans from prior sessions
└── WSL_Files/                      # Legacy WSL scripts (not actively used)
    ├── concept_map.py
    ├── risk_map.py
    ├── WSL_claude_service.py
    ├── WSL_gemini_service.py
    ├── WSL_map_updater.py
    └── WSL_routes.py
```

## Directory Purposes

**app/:**
- Purpose: Main Flask application package
- Contains: All production code (routes, services, models, static assets)
- Key files: `server.py` (Flask factory), `api/routes.py` (all endpoints)

**app/api/:**
- Purpose: REST API layer
- Contains: Single file `routes.py` with 15+ endpoints
- Key files: `routes.py` (1000+ lines, monolithic endpoint definitions)

**app/services/:**
- Purpose: Business logic encapsulation
- Contains: 5 service modules handling document parsing, LLM interaction, analysis
- Key files:
  - `claude_service.py`: Risk analysis using Claude Opus 4.5 (450+ lines)
  - `gemini_service.py`: Revision generation using Gemini 3 Flash (350+ lines)
  - `document_service.py`: DOCX parsing and rebuilding (500+ lines)

**app/models/:**
- Purpose: Domain-specific data structures
- Contains: 2 model classes for concept mapping and risk tracking
- Key files:
  - `concept_map.py`: Legal provision categories (~100 lines)
  - `risk_map.py`: Risk relationships and severity calculation (~200 lines)

**app/data/:**
- Purpose: Runtime storage for sessions and uploads
- Contains: Auto-created directories filled with JSON files
- Structure:
  - `sessions/`: One JSON file per session (e.g., `{session_id}.json`)
  - `uploads/{session_id}/`: Original DOCX files + parsed JSONs per session

**app/static/:**
- Purpose: Frontend assets served to browser
- Contains: Single HTML file + CSS/JS modules
- Key files:
  - `index.html`: Main SPA entry point
  - `js/sidebar.js`: Largest module (47KB, handles risk/opportunity rendering)
  - `js/revision.js`: Large module (34KB, displays revisions with diffs)

**tests/:**
- Purpose: Test coverage (minimal)
- Contains: Single test file for claude_service
- Key files: `test_claude_service.py` (basic unit tests)

**docs/:**
- Purpose: Documentation and session history
- Contains: Conversation snapshots and implementation plans from prior sessions

**WSL_Files/:**
- Purpose: Legacy scripts from Windows Subsystem for Linux environment
- Status: Not actively used in current architecture
- Contains: Older versions of services (claude_service, gemini_service, etc.)

## Key File Locations

**Entry Points:**
- `run.py`: Application startup script (checks dependencies, starts Flask)
- `app/server.py`: Flask app factory and configuration
- `app/static/index.html`: Frontend SPA entry point
- `app/api/routes.py`: All REST endpoints

**Configuration:**
- `app/server.py`: Flask config (upload limits, folder paths)
- `requirements.txt`: Python dependencies
- `.env`: Environment variables (API keys) - created by user

**Core Logic:**
- `app/services/claude_service.py`: LLM-based risk analysis
- `app/services/gemini_service.py`: LLM-based revision generation
- `app/services/document_service.py`: Document parsing and rebuilding
- `app/models/concept_map.py`: Legal concept tracking
- `app/models/risk_map.py`: Risk relationship tracking

**Testing:**
- `tests/test_claude_service.py`: Unit tests for Claude service

## Naming Conventions

**Files:**
- Snake case: `document_service.py`, `concept_map.py`, `analysis_service.py`
- Suffix conventions:
  - `_service.py`: Business logic/API client wrappers
  - `.py`: Python modules
  - `.js`: Frontend JavaScript modules
  - `.html`: HTML templates

**Directories:**
- Lowercase plural: `services/`, `models/`, `static/`, `tests/`, `docs/`
- Functional grouping: `api/` (routes), `services/` (business logic), `models/` (data structures)

**Classes:**
- PascalCase: `ConceptMap`, `RiskMap`, `Document`, `Session`

**Functions:**
- Snake case: `analyze_document_with_llm()`, `detect_contract_type()`, `get_session()`, `save_session()`

**Variables:**
- Snake case: `session_id`, `para_id`, `risk_id`, `parsed_doc`, `aggressiveness`
- Prefixes for state: `sessions` (global dict), `analysis_progress` (thread-safe dict)

**HTML/CSS:**
- Kebab case IDs: `sidebar-tab`, `risk-card`, `revision-pane`
- Class names: semantic + utility mix (e.g., `risk-item high-severity`)

## Where to Add New Code

**New Feature (Analysis Enhancement):**
- Primary code: `app/services/claude_service.py` or `app/services/gemini_service.py`
- API endpoint: Add route in `app/api/routes.py`
- Data model: Extend `app/models/` if new domain concepts emerge
- Tests: Add to `tests/test_claude_service.py` or create new `tests/test_[feature].py`

**New Component/Module:**
- UI component: `app/static/js/[component].js` following module pattern (no build step)
- Styles: `app/static/css/style.css` (monolithic, or create `app/static/css/[component].css` and link in `index.html`)
- Backend service: `app/services/[name]_service.py`

**Utilities:**
- Shared helpers: `app/services/document_service.py` (parsing utilities), `app/static/js/utils.js` (frontend utilities)
- Document parsing: Add functions to `document_service.py` (already has 500+ lines but well-structured)

**Configuration/Constants:**
- API keys: `.env` file (loaded by `python-dotenv`)
- Flask config: `app/server.py` (lines 20-33)
- LLM system prompts: `claude_service.py` (build_risk_analysis_prompt()) or `gemini_service.py`

## Special Directories

**app/data/:**
- Purpose: Runtime storage
- Generated: Yes (auto-created by Flask app initialization)
- Committed: No (`.gitignore` should exclude)
- Size: Grows with each session (typically 1-5MB per session with parsed docs)

**app/static/:**
- Purpose: Frontend assets
- Generated: No (committed to repo)
- Committed: Yes
- Notes: No build step; assets served directly by Flask

**tests/:**
- Purpose: Test coverage
- Generated: No (test files committed)
- Committed: Yes
- Coverage: Minimal (~20% of codebase)

**docs/:**
- Purpose: Documentation and session history
- Generated: Partially (conversation snapshots from Claude sessions)
- Committed: Yes (historical record)

**WSL_Files/:**
- Purpose: Legacy Windows Subsystem for Linux environment scripts
- Generated: No (historical, from earlier development)
- Committed: Yes (archive purposes)
- Active: No (replaced by app/services/ modules)

## Frontend Architecture Pattern

**Module System (No Build Step):**
- Each JS file is a module with self-executing functions and event listeners
- State centralized in `app/static/js/state.js` (AppState object)
- Communication via:
  - Direct DOM manipulation
  - API calls via `app/static/js/api.js` wrapper
  - Event listeners on document (delegation)
  - Session data passed through API responses

**Key Modules:**
- `app.js` (300 lines): Bootstrap, tab switching, initialization
- `document.js` (350 lines): Paragraph rendering, click handling
- `sidebar.js` (1400+ lines): Risk/opportunity display, user interactions
- `revision.js` (1000+ lines): Revision diff rendering, acceptance workflow
- `analysis.js` (200 lines): Progress overlay, analysis state
- `navigation.js` (600 lines): Clause navigation, search, jump-to
- `state.js` (50 lines): Global AppState object

## Dependency Graph (High Level)

```
run.py
  └── app/server.py
      └── app/api/routes.py
          ├── app/services/document_service.py
          ├── app/services/claude_service.py
          │   └── anthropic SDK
          ├── app/services/gemini_service.py
          │   └── google-genai SDK
          ├── app/services/analysis_service.py
          ├── app/services/map_updater.py
          ├── app/models/concept_map.py
          ├── app/models/risk_map.py
          └── Flask framework

app/static/index.html
  └── app/static/js/*.js (no build-time dependencies)
      └── REST API (routes.py endpoints)
```

---

*Structure analysis: 2026-02-01*
