# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
claude-redlining/
├── .planning/                       # GSD planning documents
│   └── codebase/                    # This analysis
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
├── app/                             # Main Flask application
│   ├── __init__.py                  # Package initialization
│   ├── server.py                    # Flask app factory and entry point
│   ├── api/                         # API routes
│   │   ├── __init__.py
│   │   └── routes.py                # All HTTP endpoints (intake, analysis, revise, finalize, etc.)
│   ├── services/                    # Business logic services
│   │   ├── __init__.py
│   │   ├── claude_service.py        # Claude Opus integration for document analysis
│   │   ├── gemini_service.py        # Gemini API integration for redline generation
│   │   ├── document_service.py      # DOCX parsing and track changes generation
│   │   ├── analysis_service.py      # Regex-based fallback analysis
│   │   └── map_updater.py           # Concept/risk map updates on revisions
│   ├── models/                      # Data models for complex relationships
│   │   ├── __init__.py
│   │   ├── concept_map.py           # ConceptMap: provisions grouped by legal concept
│   │   └── risk_map.py              # RiskMap: risks with dependency relationships
│   ├── data/                        # Runtime data storage
│   │   ├── uploads/                 # Session-specific uploaded files
│   │   │   └── {session_id}/
│   │   │       ├── target.docx
│   │   │       ├── precedent.docx (optional)
│   │   │       ├── target_parsed.json
│   │   │       └── precedent_parsed.json (optional)
│   │   └── sessions/                # Session state JSON files
│   │       └── {session_id}.json
│   └── static/                      # Frontend assets
│       ├── index.html               # Single-page app HTML
│       ├── css/
│       │   └── main.css             # Styling (legal document theme)
│       └── js/
│           └── analysis.js          # Frontend logic
├── .claude/                         # Claude Code CLI configuration
│   └── commands/
│       └── redline.md               # Original redline skill (reference)
├── docs/                            # Documentation
├── tests/                           # Test files
├── requirements.txt                 # Python dependencies
├── run.py                           # Quick start script
├── CLAUDE.md                        # Project planning and context
├── README.md                        # User-facing documentation
├── NOTES.md                         # Development notes
└── .gitignore                       # Git exclusions
```

## Directory Purposes

**`app/`:**
- Purpose: All application code (Flask server, services, models, templates)
- Contains: Python modules implementing the web application
- Key files: `server.py` (entry point), `routes.py` (API), service modules

**`app/api/`:**
- Purpose: HTTP request routing and session management
- Contains: Flask Blueprint with endpoints for all workflows
- Key files: `routes.py` - endpoints for intake (POST /api/intake), analysis (GET /api/analysis/{session_id}), revision (POST /api/revise), acceptance (POST /api/accept), finalization (POST /api/finalize)

**`app/services/`:**
- Purpose: Business logic, external integrations, document processing
- Contains:
  - `claude_service.py`: Sends parsed documents to Claude Opus 4.5 for analysis, tracks progress, handles API failures
  - `gemini_service.py`: Integrates with Google Gemini API for redline generation with chain-of-thought prompting
  - `document_service.py`: Parses DOCX files into JSON structure, rebuilds DOCX with track changes, generates manifests
  - `analysis_service.py`: Fallback regex-based analysis when Claude API fails, generates improvement suggestions
  - `map_updater.py`: Detects concept changes in revisions, updates ConceptMap and RiskMap relationships

**`app/models/`:**
- Purpose: Data structures for document-wide relationships
- Contains:
  - `concept_map.py`: ConceptMap class organizing provisions by 5 categories: liability_limitations, knowledge_standards, termination_triggers, default_remedies, defined_terms
  - `risk_map.py`: RiskMap class with Risk objects tracking mitigator/amplifier relationships and severity recalculation

**`app/data/`:**
- Purpose: Runtime data storage (uploaded files and session state)
- Contains:
  - `uploads/{session_id}/`: User-uploaded DOCX files and parsed JSON representations
  - `sessions/{session_id}.json`: Persisted session state (analysis, revisions, flags)
- Generated: Yes (created at runtime)
- Committed: No (git-ignored)

**`app/static/`:**
- Purpose: Frontend HTML, CSS, JavaScript
- Contains:
  - `index.html`: Single-page app with intake form, document viewer, analysis sidebar, revision UI
  - `css/main.css`: Legal document styling (serif fonts, appropriate spacing)
  - `js/analysis.js`: Frontend state management, API calls, UI interactions

**`.planning/codebase/`:**
- Purpose: GSD analysis documents consumed by orchestrator
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

## Key File Locations

**Entry Points:**
- `C:\Users\david\Documents\claude-redlining\run.py`: Quick start script that checks dependencies and starts Flask server
- `C:\Users\david\Documents\claude-redlining\app\server.py`: Flask app factory (create_app() function), registered blueprints, static file serving

**Configuration:**
- `C:\Users\david\Documents\claude-redlining\requirements.txt`: Python package dependencies (flask, python-docx, anthropic, google-genai, diff-match-patch)
- Environment variables: ANTHROPIC_API_KEY, GEMINI_API_KEY (or stored in anthropic_api.txt / api.txt)
- Flask config set in `app/server.py`: MAX_CONTENT_LENGTH (50MB), UPLOAD_FOLDER, SESSION_FOLDER

**Core Logic:**
- `C:\Users\david\Documents\claude-redlining\app\api\routes.py`: All HTTP endpoints (929 lines) - primary request handler
- `C:\Users\david\Documents\claude-redlining\app\services\claude_service.py`: Document analysis orchestration
- `C:\Users\david\Documents\claude-redlining\app\services\gemini_service.py`: Revision generation
- `C:\Users\david\Documents\claude-redlining\app\services\document_service.py`: Document parsing and output generation

**Data Models:**
- `C:\Users\david\Documents\claude-redlining\app\models\concept_map.py`: Legal concept organization (93 lines)
- `C:\Users\david\Documents\claude-redlining\app\models\risk_map.py`: Risk dependency tracking (210 lines)

**Frontend:**
- `C:\Users\david\Documents\claude-redlining\app\static\index.html`: Complete single-page app
- `C:\Users\david\Documents\claude-redlining\app\static\css\main.css`: Application styling

**Testing:**
- `C:\Users\david\Documents\claude-redlining\tests/`: Test directory (currently minimal)

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `claude_service.py`, `concept_map.py`)
- HTML/CSS/JS: lowercase with hyphens (e.g., `index.html`, `main.css`, `analysis.js`)
- Configuration: dotfiles for environment (`.env`, `.gitignore`)
- Session files: `{session_id}.json` where session_id is a UUID v4

**Directories:**
- Lowercase with underscores: `app/`, `app/api/`, `app/services/`, `app/models/`, `app/data/`
- Special prefixes: `.` for system (`.planning/`, `.claude/`, `.git/`)

**API Endpoints:**
- Kebab-case resource names: `/api/intake`, `/api/document`, `/api/analysis`, `/api/revise`, `/api/accept`
- Path parameters in angle brackets: `/api/analysis/{session_id}`, `/api/document/<session_id>`

**Session Data Keys:**
- snake_case: `session_id`, `created_at`, `representation`, `contract_type`, `aggressiveness`, `parsed_doc`, `revisions`, `flags`
- Prefixed collections: `risk_by_paragraph`, `defined_terms`

**CSS Classes:**
- Kebab-case: `.header`, `.intake-screen`, `.upload-area`, `.btn-primary`
- State classes: `.hidden`, `.active`

**Function Names:**
- snake_case: `parse_document()`, `generate_revision()`, `detect_contract_type()`
- Private functions: Leading underscore (e.g., `_build_risk_prompt()`)

## Where to Add New Code

**New Feature:**
- Primary code: `C:\Users\david\Documents\claude-redlining\app\services\` (new service module if external integration) or existing service if enhancing current logic
- API endpoint: Add method to `C:\Users\david\Documents\claude-redlining\app\api\routes.py` with appropriate route decorator
- Frontend: Add UI to `C:\Users\david\Documents\claude-redlining\app\static\index.html` and logic to `js/analysis.js`
- Tests: `C:\Users\david\Documents\claude-redlining\tests\test_[feature].py`

**New Contract Type Support:**
- Update `detect_contract_type()` in `C:\Users\david\Documents\claude-redlining\app\api\routes.py` to detect new type (keywords)
- Add type-specific prompting in `C:\Users\david\Documents\claude-redlining\app\services\claude_service.py` within risk analysis prompt
- Add category examples to concept_map valid categories if needed

**New Analysis Provider (beyond Claude/Gemini):**
- Create `C:\Users\david\Documents\claude-redlining\app\services\[provider]_service.py`
- Export main functions: `analyze_document_with_llm()` (if analysis) or `generate_revision()` (if revision)
- Update `routes.py` to handle import and fallback logic

**Utilities/Helpers:**
- Shared functions: `C:\Users\david\Documents\claude-redlining\app\services\` as utility functions in appropriate service module
- Text processing: Add to `document_service.py` if document-related
- API helpers: Add to `routes.py` as module-level functions (e.g., `detect_contract_type()`)

**New Component/Module:**
- Implementation: `C:\Users\david\Documents\claude-redlining\app\[module_name]/[component].py`
- Models (if data structure needed): `C:\Users\david\Documents\claude-redlining\app\models\[model].py`
- Ensure module has `__init__.py` if it's a package

## Special Directories

**`app/data/`:**
- Purpose: Runtime data storage (session state and uploaded files)
- Generated: Yes (created at runtime by Flask app)
- Committed: No (excluded by .gitignore)
- Cleanup: Session files accumulate; consider periodical cleanup policy

**`.planning/`:**
- Purpose: GSD orchestrator planning documents
- Generated: Yes (by /gsd commands)
- Committed: Yes (version control needed)
- Used by: /gsd:plan-phase and /gsd:execute-phase commands

**`.claude/`:**
- Purpose: Original redline skill definitions (reference/legacy)
- Generated: No (manually created)
- Committed: Yes
- Note: App moved to webapp architecture; CLI commands are reference only

**`tests/`:**
- Purpose: Test files
- Generated: No (manually created)
- Committed: Yes
- Current state: Minimal/placeholder

## Database/Persistence Pattern

No traditional database. Session persistence is file-based:

1. **In-memory cache:** `sessions = {}` in `routes.py` holds active sessions
2. **Disk persistence:** Each session auto-saved to `app/data/sessions/{session_id}.json`
3. **File uploads:** Stored in `app/data/uploads/{session_id}/`
4. **Parsed JSON:** Generated on intake, stored in uploads folder for reconstruction

When app restarts:
- In-memory sessions lost (but persisted JSON can be reloaded)
- `GET /api/sessions` only returns in-memory sessions
- Load test sessions via `POST /api/load-test-session` from saved output

---

*Structure analysis: 2026-02-01*
