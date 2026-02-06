# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**LLM Services:**
- **Anthropic Claude API** - Deep legal analysis and risk identification
  - SDK: `anthropic>=0.40.0`
  - Auth: `ANTHROPIC_API_KEY` environment variable or `anthropic_api.txt` file
  - Model: claude-opus-4-5-20251101 (Opus 4.5)
  - Usage: `app/services/claude_service.py`
  - Primary function: `analyze_clauses_with_claude()` performs batch risk analysis with concept map extraction
  - Features: Chain-of-thought prompting, risk categorization, relationship mapping (mitigated_by, amplified_by, triggers)
  - Token limits: max_tokens=16000 per request

- **Google Gemini API** - Surgical redline generation
  - SDK: `google-genai>=0.1.0`
  - Auth: `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable, or `api.txt` file
  - Models: gemini-2.0-flash (primary), gemini-1.5-flash (fallback with retry logic)
  - Usage: `app/services/gemini_service.py`
  - Primary function: `generate_revision()` produces revised clause text with rationale
  - Features: Retry logic with exponential backoff for rate limiting (429 errors), safety settings disabled for legal context
  - Token limits: max_output_tokens=4096 per request

## Data Storage

**Databases:**
- None - Project uses in-memory session storage for development
- Session persistence: JSON files written to `app/data/sessions/`
- Test data: JSON files in `output/` folder for test session loading

**File Storage:**
- Local filesystem only
- Upload directory: `app/data/uploads/` (created at runtime, max 50MB per file)
- Output directory: Generated files written to same location as input document
- Word documents: Parsed with python-docx, rebuilt with modifications to preserve formatting

**Caching:**
- None - Project does not implement caching layer
- Document analysis results stored in session memory and persisted to JSON

## Authentication & Identity

**Auth Provider:**
- Custom - No user authentication implemented
- Session management: UUID-based session IDs generated in `app/api/routes.py`
- Approach: Stateful in-memory session storage, persisted to disk as JSON backup

**API Key Management:**
- Anthropic key sources (checked in order):
  1. `ANTHROPIC_API_KEY` environment variable
  2. `anthropic_api.txt` in project root
  3. `.env` file (ANTHROPIC_API_KEY=...)
  4. `~/.anthropic_api_key` in user home
  - Implementation: `get_anthropic_api_key()` in `app/services/claude_service.py`

- Gemini key sources (checked in order):
  1. `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable
  2. `api.txt` in project root
  3. `.env` file (GEMINI_API_KEY=... or GOOGLE_API_KEY=...)
  4. `~/.gemini_api_key` in user home
  - Implementation: `get_api_key()` in `app/services/gemini_service.py`

## Monitoring & Observability

**Error Tracking:**
- None configured - Errors logged to console/Flask logs
- API errors caught and returned as JSON responses with error messages
- Retry logic for Gemini rate limiting: exponential backoff (2s base, up to 3 retries)

**Logs:**
- Console logging via Flask development server
- API responses include error messages for client display
- Progress tracking: Global `analysis_progress` dict in `app/services/claude_service.py` with thread-safe updates
- Progress endpoint: `/api/progress/<session_id>` retrieves current analysis status

**Session Logging:**
- Session data persisted to `app/data/sessions/{session_id}.json`
- Analysis results stored in `analysis.json` within session
- Revision history maintained in session revisions dict

## CI/CD & Deployment

**Hosting:**
- Local development with Flask development server
- Can be deployed to any Python WSGI host (Heroku, Railway, PythonAnywhere, etc.)
- Docker containerization possible (not configured in repo)

**CI Pipeline:**
- None configured
- Manual testing via Flask development server

## Environment Configuration

**Required env vars at runtime:**
- `ANTHROPIC_API_KEY` - For Claude analysis (can be file-based alternative)
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` - For Gemini redlines (can be file-based alternative)
- `PORT` - Optional, defaults to 5000

**Secrets location:**
- Environment variables preferred
- File-based fallback: `anthropic_api.txt`, `api.txt` in project root (must be added to `.gitignore`)
- `.env` file support via python-dotenv (gitignored)

**Build/Deploy config:**
- No build configuration needed
- `requirements.txt` used for dependency installation
- Startup script: `run.py` performs dependency and API key checks before server start

## Webhooks & Callbacks

**Incoming:**
- None - Project is stateless API server, no webhook receivers

**Outgoing:**
- None - Project does not send webhooks to external services
- Gemini API: Calls are synchronous, results returned directly
- Anthropic API: Calls are synchronous, results returned directly

## API Design

**REST Endpoints Overview:**
- `/api/intake` - POST: Initialize session with document and context
- `/api/document` - GET: Retrieve parsed document structure
- `/api/analysis` - GET: Retrieve risk/opportunity analysis results
- `/api/revise` - POST: Generate redline for specific clause
- `/api/flag` - POST: Flag clause for client review
- `/api/finalize` - POST: Generate final Word doc and transmittal
- `/api/suggestions` - GET: App improvement suggestions
- `/api/implement` - POST: Implement approved improvement
- `/api/progress/<session_id>` - GET: Poll analysis progress during async processing
- `/api/load-test-session` - POST: Load saved analysis for testing without re-running expensive LLM

**Response Format:**
- JSON for all API responses
- Error responses: `{"error": "message"}` with HTTP status codes
- Success responses: Vary by endpoint, include data payloads with document, analysis, revisions, etc.

## Data Flow with External APIs

**Risk Analysis Flow:**
1. User uploads contract via `/api/intake` → File saved to uploads folder
2. Document parsed with python-docx → Stored in session
3. `/api/analysis` endpoint calls `analyze_document_with_llm()` in `app/services/claude_service.py`
4. Claude processes document in batches (default 5 clauses per request) → `anthropic.messages.create()`
5. Risk analysis results stored in session with risk_by_paragraph mapping
6. Concept map aggregated across all batches and returned

**Revision Flow:**
1. User clicks "Revise" on risk item → POST `/api/revise`
2. `generate_revision()` in `app/services/gemini_service.py` called with clause, risks, and context
3. Optional precedent search via SimpleRetriever (TF-IDF based, no external API)
4. Gemini called via `client.models.generate_content()` → Returns revised text
5. Inline HTML diff generated via diff-match-patch
6. Revision stored in session and returned to frontend
7. User accepts revision → Stored in revisions dict for final output

**Finalization Flow:**
1. User completes review and triggers finalization via `/api/finalize`
2. `generate_final_output()` in `app/services/document_service.py` called
3. Word document rebuilt with accepted revisions via `rebuild_document()`
4. Track changes attempted via redlines library (fallback to standard rebuild if unavailable)
5. Manifest markdown generated with all changes and rationale
6. Transmittal email template generated
7. All files written to output directory

---

*Integration audit: 2026-02-01*
