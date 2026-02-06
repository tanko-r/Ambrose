# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- Python 3.8+ - Backend server, document parsing, LLM integrations, services
- JavaScript (ES6+) - Frontend web application with modular architecture
- HTML5 - Document rendering and UI markup

**Secondary:**
- Markdown - Configuration files, documentation, manifest generation
- JSON - Configuration, data serialization, API responses

## Runtime

**Environment:**
- Python 3.8 or higher (specified in run.py dependency checks)

**Package Manager:**
- pip - Python dependency management
- Lockfile: `requirements.txt` (present, contains pinned versions)

## Frameworks

**Core:**
- Flask 2.0.0+ - Web framework for REST API server at `app/server.py`
- Python-docx 0.8.11+ - Word document parsing and generation at `app/services/document_service.py`

**LLM Integrations:**
- Anthropic SDK (`anthropic>=0.40.0`) - Claude API client for risk analysis
  - Model: claude-opus-4-5-20251101 (Opus 4.5 with thinking capability)
  - Used in: `app/services/claude_service.py`
- Google Genai SDK (`google-genai>=0.1.0`) - Gemini API client for redline generation
  - Models: gemini-2.0-flash (primary), gemini-1.5-flash (fallback)
  - Used in: `app/services/gemini_service.py`

**Diff & Visualization:**
- diff-match-patch 20200713+ - Inline HTML diff generation for track changes visualization
  - Used in: `app/services/document_service.py` (generate_inline_diff_html function)
  - Library not required but improves diff quality when available

**Track Changes (Optional):**
- Python-redlines 0.4.0+ - Native Word track changes generation (commented out, not currently used)
  - Attempted integration in: `app/services/document_service.py`

## Key Dependencies

**Critical:**
- `flask>=2.0.0` - Web server framework, serves REST API and frontend
- `python-docx>=0.8.11` - Parses .docx files and rebuilds them with revisions
- `anthropic>=0.40.0` - Claude API client, required for risk analysis with Opus 4.5
- `google-genai>=0.1.0` - Gemini API client, required for redline generation
- `python-dotenv>=0.19.0` - Environment variable loading from .env files

**Infrastructure:**
- `diff-match-patch>=20200713` - High-quality semantic diff HTML generation (optional, falls back gracefully)

## Configuration

**Environment:**
- `.env` file support via python-dotenv
- API keys loaded from multiple sources:
  - `ANTHROPIC_API_KEY` environment variable (Claude)
  - `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable (Gemini)
  - Key files: `anthropic_api.txt`, `api.txt`, `~/.anthropic_api_key`, `~/.gemini_api_key`
  - Parse logic in: `app/services/claude_service.py` (get_anthropic_api_key)
  - Parse logic in: `app/services/gemini_service.py` (get_api_key)

**Key Environment Variables:**
- `ANTHROPIC_API_KEY` - Required for Claude risk analysis
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Required for Gemini redline generation
- `PORT` - Server port (defaults to 5000)

**Build/Dev:**
- Flask development server with auto-reload at `app/server.py`
- Debug mode enabled (app.run with debug=True)
- Max upload size: 50MB (configured in app/server.py)

## Flask Application Structure

**Entry Point:**
- `run.py` - Checks dependencies and starts Flask server via `app.server.main()`

**Server Configuration:**
- `app/server.py` - Creates Flask app with blueprints, configures folders
- Static folder: `app/static/` (serves index.html, CSS, JavaScript)
- Upload folder: `app/data/uploads/` (created at runtime)
- Session folder: `app/data/sessions/` (created at runtime)

**API Blueprint:**
- Prefix: `/api`
- Routes file: `app/api/routes.py`
- Endpoints handle: intake, document parsing, analysis, revisions, finalization

## Platform Requirements

**Development:**
- Python 3.8+
- pip package manager
- All dependencies from requirements.txt
- Optional: Browser for testing UI at http://localhost:5000

**Production:**
- Python 3.8+ runtime
- All packages from requirements.txt installed
- Anthropic API key with access to claude-opus-4-5-20251101
- Google Gemini API key with access to gemini-2.0-flash or gemini-1.5-flash
- Flask can be deployed behind any WSGI server (gunicorn, uWSGI, etc.)
- No database required (in-memory session storage for development)

## Dependency Validation

**Startup Checks (run.py):**
- `flask` - Required, exit if missing
- `python-docx` (imports as `docx`) - Required, exit if missing
- `python-dotenv` - Required, exit if missing
- `google-genai` (imports as `google.genai`) - Required, exit if missing
- `diff-match-patch` - Optional, app continues with reduced diff quality if missing
- `anthropic` - Optional in startup, but required for analysis features

**Conditional Imports:**
- `anthropic` - Check: HAS_ANTHROPIC flag at top of `app/services/claude_service.py`
- `google.genai` - Check: HAS_GEMINI flag at top of `app/services/gemini_service.py`
- `redlines` - Check: HAS_REDLINES flag at top of `app/services/document_service.py`

---

*Stack analysis: 2026-02-01*
