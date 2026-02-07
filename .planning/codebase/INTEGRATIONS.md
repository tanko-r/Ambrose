# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**LLM Analysis (Risk Assessment):**
- Anthropic Claude Opus 4.5 - Deep legal contract analysis identifying risks, opportunities, and concept maps
  - SDK/Client: `anthropic` Python package (0.40.0+)
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Used in: `app/services/claude_service.py` (lines 52-84 for key loading)
  - Endpoint: Anthropic API (implicit, handled by SDK)
  - Purpose: Phase 1 risk/opportunity analysis per clause with extended thinking

**LLM Redlining (Text Generation):**
- Google Gemini 3 Flash - Surgical redline generation for specific clauses
  - SDK/Client: `google-genai` Python package (0.1.0+)
  - Auth: `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variables
  - Used in: `app/services/gemini_service.py` (lines 26-59 for key loading)
  - Purpose: Phase 3 revision generation with chain-of-thought prompting
  - Selected for: Cost efficiency vs. Claude Opus for revision task

## Data Storage

**Databases:**
- None - Project uses local filesystem for session/document storage

**File Storage:**
- Local filesystem only
  - Upload folder: `app/data/uploads/` - Temporary storage of user-uploaded .docx files and parsed JSON
  - Session folder: `app/data/sessions/` - Session state persistence (JSON files per session_id)
  - Output folder: `app/data/output/` - Final generated files (revised.docx, manifest.md, etc.)
  - Parsed documents: `uploads/{session_id}/target_parsed.json`, `precedent_parsed.json`
  - Revisions stored in-memory in session object, persisted to JSON

**Caching:**
- In-memory session dictionary (`sessions = {}` in `app/api/routes.py` line 25)
- Thread-safe analysis progress tracking (`analysis_progress` dict in `app/services/claude_service.py` lines 20, 24-43)
- Optional disk-based caching: Test session data in `output/saved_document.json` and `output/saved_analysis.json`

## Authentication & Identity

**Auth Provider:**
- None - No user authentication system. Single-user local application.
- No login/session management beyond Flask session ID generation for document review workflows

## Monitoring & Observability

**Error Tracking:**
- None - Project uses try/except blocks and returns JSON error responses
- Logging via Flask built-in (print statements for server console)
- No external error tracking (Sentry, etc.)

**Logs:**
- Console output only (printed to terminal via Flask development server)
- No persistent log files or external logging service
- Progress tracking via in-memory dict returned to UI during analysis (`app/services/claude_service.py` lines 24-43)

## CI/CD & Deployment

**Hosting:**
- Local development only - Flask development server on `localhost:5000`
- No cloud deployment configured
- No Docker/containerization files present
- Can be run via `python run.py` from project root

**CI Pipeline:**
- None - No GitHub Actions, Jenkins, or other CI configured
- Dependencies installed manually via `pip install -r requirements.txt`

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Claude Opus 4.5 API key (required for analysis phase)
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Google Gemini API key (required for redline generation)
- `PORT` - Optional, defaults to 5000

**Optional env vars:**
- Flask debug mode can be controlled via `FLASK_ENV`

**Secrets location:**
- Environment variables loaded by `app/services/claude_service.py` (lines 60-84)
- Fallback sources: `api.txt`, `anthropic_api.txt`, `.env` in project root or user home
- User's preferred location: `api.txt` in project root (from historical Gemini work)

## Webhooks & Callbacks

**Incoming:**
- None - Application is request-response only

**Outgoing:**
- None - No external webhook integrations
- Email generation is local (no SMTP integration) - transmittal email is generated as text, not sent

## API Endpoints

**Document Processing:**
- POST `/api/intake` - Upload contract, precedent, and review parameters
- GET `/api/document/{session_id}` - Retrieve parsed document structure
- GET `/api/analysis/{session_id}` - Trigger or retrieve risk analysis
- GET `/api/analysis/{session_id}/progress` - Real-time analysis progress

**Revision Workflow:**
- POST `/api/revise` - Generate redline for specific clause (calls Gemini)
- POST `/api/accept` - Accept a proposed revision
- POST `/api/reject` - Reject a proposed revision
- POST `/api/reanalyze` - Re-analyze clause with updated context
- POST `/api/flag` - Flag item for client/attorney review

**Finalization:**
- POST `/api/finalize` - Generate final Word doc with track changes + transmittal email
- GET `/api/download/{session_id}/{file_type}` - Download generated files (docx, transmittal, manifest)

**Session Management:**
- POST `/api/load-test-session` - Load pre-saved analysis for testing
- GET `/api/sessions` - List all active sessions
- GET `/api/suggestions/{session_id}` - Get improvement suggestions
- POST `/api/implement` - Implement approved improvement
- GET `/api/version` - Get git branch/commit for UI header

## LLM Context & Prompting

**Claude Opus 4.5 (Risk Analysis):**
- System prompt built in `app/services/claude_service.py` (lines 87-238)
- Batched analysis: 5 clauses per API call for efficiency (`app/api/routes.py` line 298)
- Requests structured JSON output with:
  - Risk objects (risk_type, severity, title, description, problematic_text, offsets)
  - Concept map (liability limitations, knowledge standards, termination triggers, etc.)
  - Risk relationships (mitigated_by, amplified_by, triggers)
- Output stored in session `analysis` field with risk_by_paragraph organization

**Gemini 3 Flash (Redline Generation):**
- System prompt built in `app/services/gemini_service.py` (lines 149-185)
- Prompt construction in `build_revision_prompt()` (lines 188-198+)
- Inputs: original clause, section reference, section hierarchy, risks, precedent language
- JSON output: `revised_text`, `rationale`, `thinking` (chain-of-thought transparency)
- Support for:
  - Multiple risk addressing (risk_ids array)
  - Related clause context (for cross-reference awareness)
  - Custom user instructions
  - Concept map and risk map context

## Integration Points

**Document Parsing:**
- `app/services/document_service.py` parses .docx files using python-docx
- Extracts: paragraphs, section numbering, defined terms, exhibits, metadata
- Output: JSON structure with IDs, section references, section hierarchy

**Revision Tracking:**
- Session stores revisions dict: `{para_id: {original, revised, rationale, diff_html, accepted, timestamp}}`
- Diff HTML generated by diff-match-patch for UI display
- Concept change detection in `app/services/map_updater.py` (230 lines)

**Final Output:**
- `generate_final_output()` in `app/services/document_service.py`
- Rebuilds .docx with revisions
- Generates track changes format
- Creates transmittal email text
- Creates manifest with rationale for each change

---

*Integration audit: 2026-02-01*
