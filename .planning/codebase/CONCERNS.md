# Codebase Concerns

**Analysis Date:** 2026-02-01

## Tech Debt

**In-Memory Session Storage Without Persistence:**
- Issue: Sessions stored only in Python memory (global `sessions` dict at `app/api/routes.py:25`)
- Files: `app/api/routes.py:24-25`, `app/api/routes.py:35-46`
- Impact: Sessions lost on server restart, no recovery mechanism, multiple workers/processes cannot share state
- Fix approach: Migrate to persistent session storage (Redis, SQLite, or database). Implement session serialization/deserialization with proper TTL management.

**Bare Exception Handling Masks Errors:**
- Issue: Multiple catch-all `except Exception` blocks without type-specific handling or proper logging
- Files: `app/api/routes.py:144, 152, 365, 387, 527, 696, 805, 854, 881`, `app/services/claude_service.py:579-587`, `app/services/gemini_service.py:507-512, 531-534`
- Impact: Difficulty debugging issues, hides API failures and partial successes, users see generic error messages
- Fix approach: Replace generic exception catches with specific exception types; add structured logging with error context; distinguish between recoverable and fatal errors.

**API Key Management Via Plain Text Files:**
- Issue: API keys read from `api.txt`, `.env`, and home directory without encryption
- Files: `app/services/claude_service.py:68-83`, `app/services/gemini_service.py:43-57`, `run.py:69-72`
- Impact: Risk of credential exposure in logs, backups, and repository history; no key rotation strategy
- Fix approach: Use only environment variables with clear documentation; remove `.env` from logic; implement secure credential manager; add pre-commit hooks to prevent key commits.

**Debug Mode Enabled in Production Configuration:**
- Issue: `app.run(host='0.0.0.0', port=port, debug=True)` at `app/server.py:68`
- Files: `app/server.py:50-68`
- Impact: Exposes full stack traces and interactive debugger to clients; allows code execution on remote machine
- Fix approach: Make debug mode conditional on environment variable; use separate production and development configurations.

**Incomplete Fallback Analysis Path:**
- Issue: When Claude analysis fails, falls back to regex-based analysis but fallback may also fail
- Files: `app/api/routes.py:365-388`
- Impact: No analysis available at all if both LLM and fallback fail; cascade failure with poor user feedback
- Fix approach: Implement graceful degradation with partial results; provide analysis status indicating which components succeeded/failed; implement circuit breaker pattern.

**Large File Upload Without Size/Type Validation:**
- Issue: File type validation missing; relies on Flask's MAX_CONTENT_LENGTH (50MB)
- Files: `app/api/routes.py:97-200`, `app/server.py:27`
- Impact: Could accept non-DOCX files causing downstream parsing failures; 50MB limit enforced only at Flask level
- Fix approach: Add explicit MIME type validation and file extension checking; validate DOCX structure before processing; add per-file timeout for parsing.

---

## Known Bugs

**Word Automatic Numbering Not Rendered:**
- Symptoms: Auto-generated paragraph numbering (e.g., "1.3", "iv") from Word documents not displayed in UI
- Files: `NOTES.md:7`
- Trigger: Upload any DOCX with auto-numbering, render in web UI
- Workaround: None currently - display shows extracted text but missing numbering context
- Fix approach: Update document parser to preserve Word numbering format metadata; render numbering in document display panel.

**Loading Overlay Elapsed Time Not Updating:**
- Symptoms: Elapsed time counter on analysis progress modal stays at initial value or jumps inconsistently
- Files: `NOTES.md:11`
- Trigger: Start document analysis, observe elapsed time display
- Workaround: Remaining time estimate still updates correctly
- Fix approach: Fix JavaScript timer update logic; synchronize with server-side elapsed time; clarify what "elapsed" means vs "remaining".

**Concept Change Detection Limited to Simple Patterns:**
- Symptoms: Complex concept changes not detected if text is rephrased; only detects if exact keywords appear
- Files: `app/services/map_updater.py:58-117`, especially `CONCEPT_PATTERNS:18-55`
- Trigger: User revises clause but uses different terminology for same concept (e.g., "liability ceiling" vs "cap")
- Workaround: None - concept map not updated, risk map severities may be incorrect
- Fix approach: Use semantic similarity matching; add concept synonym dictionary; implement LLM-based concept extraction.

**Session Data Loading from Disk Incomplete:**
- Symptoms: Re-loading a session from disk may lose concept_map or risk_map if they weren't serialized
- Files: `app/api/routes.py:237-245`, `app/api/routes.py:39-45`
- Trigger: Restart server with existing session, try to access analysis
- Workaround: Re-run analysis
- Fix approach: Ensure all complex objects (ConceptMap, RiskMap) are properly serialized in save_session; implement schema versioning.

---

## Security Considerations

**API Key Exposure in Error Messages:**
- Risk: Error messages from Claude/Gemini API calls might contain sanitized request data including API key if not properly handled
- Files: `app/services/claude_service.py:360-361`, `app/services/gemini_service.py:494-501, 507-512`
- Current mitigation: Basic exception message truncation
- Recommendations:
  - Never include request bodies in error logs
  - Sanitize all exception messages to remove key material
  - Log API errors with hashed keys for debugging
  - Add request/response interceptor to scrub sensitive data

**No Authentication for API Endpoints:**
- Risk: All endpoints are publicly accessible; anyone with server URL can access sessions and generate revisions
- Files: `app/api/routes.py` - all route handlers lack auth checks
- Current mitigation: None
- Recommendations:
  - Add authentication layer (JWT, OAuth2, or simple API key)
  - Implement per-session access control
  - Add rate limiting to prevent API abuse
  - Log all access for audit trails

**Unvalidated File Reconstruction:**
- Risk: Documents are reconstructed from user-supplied JSON revision data without validation
- Files: `app/services/document_service.py` (rebuild_docx.py wrapper)
- Current mitigation: None explicit
- Recommendations:
  - Validate all revision data before applying to document
  - Implement checksums for document integrity
  - Implement rollback mechanism for malformed revisions
  - Add document scan for embedded content risks

**Precedent Document Trust:**
- Risk: Precedent documents uploaded by users are parsed and used as reference without validation
- Files: `app/api/routes.py:149-154`, `app/services/gemini_service.py` (precedent retrieval)
- Current mitigation: None
- Recommendations:
  - Validate precedent documents before processing
  - Implement document provenance tracking
  - Add warnings when using user-supplied precedent
  - Quarantine suspicious documents

---

## Performance Bottlenecks

**LLM Analysis Batch Processing Without Timeout:**
- Problem: Processing large documents with many clauses may take very long, no timeout per batch
- Files: `app/services/claude_service.py:527-587`, `analyze_clauses_with_claude()` not shown but called at line 554
- Cause: Batches sent sequentially to Claude with no per-batch timeout; large documents (100+ clauses) could take hours
- Improvement path:
  - Implement per-batch timeout with fallback
  - Add ability to pause/resume analysis
  - Cache analysis results for re-runs
  - Implement client-side cancellation

**Full Document Parsing Into Memory:**
- Problem: Entire DOCX parsed into memory before analysis; large documents (500+ pages) consume significant memory
- Files: `app/services/document_service.py` (parse_docx implementation), `app/api/routes.py:141-143`
- Cause: No streaming parser; complete JSON representation kept in session memory
- Improvement path:
  - Implement streaming/chunked parsing
  - Use disk-based caching for parsed documents
  - Implement garbage collection of old sessions
  - Add memory usage monitoring

**No Rate Limiting on Gemini/Claude API Calls:**
- Problem: Revision generation calls Gemini without rate limiting; concurrent requests could hit API limits
- Files: `app/services/gemini_service.py:425-530`
- Cause: Simple sequential API calls without queue management
- Improvement path:
  - Implement request queue with rate limiting
  - Add exponential backoff for API failures
  - Batch revision requests where possible
  - Monitor API usage and costs

**Paragraph Search Linear Over All Content:**
- Problem: Finding paragraphs by ID iterates through all content items multiple times
- Files: `app/api/routes.py:449-454, 474-485, 636-639`, `app/api/routes.py:723-729`
- Cause: No indexing of paragraphs; O(n) lookup on every revision
- Improvement path:
  - Build paragraph ID index during parsing
  - Cache frequently accessed paragraphs
  - Use dict instead of list for content when possible

**Concept Map and Risk Map JSON Serialization On Every Save:**
- Problem: Full concept/risk maps serialized to JSON on each save_session call
- Files: `app/api/routes.py:35-45`, `app/services/map_updater.py:195-198`
- Cause: No delta updates; entire state serialized even if only one field changed
- Improvement path:
  - Implement delta serialization (only changed fields)
  - Use binary serialization (pickle, protobuf) for complex objects
  - Lazy-load maps only when needed

---

## Fragile Areas

**Concept Map Category Assumptions Hard-coded:**
- Files: `app/services/map_updater.py:146-153`
- Why fragile: If new concept types added without updating type_to_category mapping, they silently map to 'other'
- Safe modification: Add validation that all detected concept types have corresponding categories; raise error if unmapped
- Test coverage: Very limited - only checks prompt includes categories, doesn't test actual detection

**RiskMap Severity Calculation Simplistic:**
- Files: `app/models/risk_map.py:61-74`
- Why fragile: Severity adjusted by count of mitigators/amplifiers, not their strength; a weak mitigator counts same as strong one
- Safe modification: Add 'weight' field to mitigations; normalize by total weight not count
- Test coverage: No unit tests for severity recalculation

**Batch Analysis Continues on Error:**
- Files: `app/services/claude_service.py:579-587`
- Why fragile: If one batch fails, analysis continues with remaining batches but downstream may assume complete coverage
- Safe modification: Track which batches failed; mark analysis as partial; clearly communicate coverage gaps to user
- Test coverage: No tests for failure scenarios

**Regex Pattern Matching for Section Extraction:**
- Files: `app/services/document_service.py:52-87`
- Why fragile: 18 different regex patterns for section numbering; order matters and false positives possible
- Safe modification: Add validation of matched section numbers against document hierarchy; fallback to string matching if patterns too ambiguous
- Test coverage: No tests with malformed or unusual section numbering

**Floating Point Calculation in Similarity Search:**
- Files: `app/services/gemini_service.py:98-146` (SimpleRetriever.search)
- Why fragile: Cosine similarity calculated with floating point; threshold hardcoded at 0.15
- Safe modification: Use integer arithmetic or Decimal; make threshold configurable; add sanity checks for NaN
- Test coverage: No unit tests for retriever

---

## Scaling Limits

**Single-Threaded Flask Development Server:**
- Current capacity: 1 concurrent request, ~100 paragraphs per analysis
- Limit: Blocks entire application while analyzing large document (15+ minutes for 500-clause contract)
- Scaling path: Deploy with production WSGI server (Gunicorn) with multiple workers; implement async analysis with job queue

**Session Storage Unbounded Growth:**
- Current capacity: Depends on available Python heap memory, typically 1-5GB with modest upload folder
- Limit: Server memory exhausted after ~10-20 concurrent sessions with large documents
- Scaling path: Move sessions to external store (Redis/PostgreSQL); implement session TTL (30 min idle); add memory limits per session

**Document Parsing Memory Explosion:**
- Current capacity: Safe up to ~100MB DOCX files
- Limit: Parsing 200MB+ DOCX causes memory spike; no cleanup between parses
- Scaling path: Implement streaming parser; add memory pooling; parse in separate process with memory limit

**Single Claude/Gemini API Key:**
- Current capacity: API key rate limits (requests per minute)
- Limit: Multiple simultaneous users will hit rate limits; no queuing or backoff
- Scaling path: Support multiple API keys; implement queue with smart batching; add telemetry for usage monitoring

---

## Dependencies at Risk

**python-docx 0.8.11 (potentially outdated):**
- Risk: Library may lack modern Word format support; no active maintenance confirmation
- Impact: Complex DOCX documents may parse incorrectly; Track Changes features may break
- Migration plan: Upgrade to latest python-docx if available; test with real contract docs; consider python-pptx or alternative if needed

**google-genai SDK (Early/Preview Status):**
- Risk: API surface may change; library may be unstable; unclear support timeline
- Impact: Breaking changes between library versions; potential unavailability
- Migration plan: Pin specific version; monitor Google announcements; have fallback to REST API calls

**anthropic SDK Dependency on Newer Versions:**
- Risk: `anthropic>=0.40.0` allows very wide range; major API changes possible
- Impact: Unexpected behavior changes with dependency updates
- Migration plan: Pin to specific known-good version (e.g., `anthropic==0.40.5`); test before updating

---

## Missing Critical Features

**No Model Selection Interface:**
- Problem: Code assumes Claude Opus 4.5 and Gemini Flash hardcoded; no way for users to choose models
- Blocks: Cannot optimize cost/speed tradeoff; cannot use smaller models for faster analysis
- Fix path: Add model selection in intake form; parameterize all API calls; implement model provider abstraction

**No Document Versioning/History:**
- Problem: Only current revision stored; cannot see previous revisions or revert
- Blocks: Users cannot compare iterations or undo accepted revisions
- Fix path: Implement revision history; add diff view between versions; add undo/redo

**No Cross-Clause Relationship Visualization:**
- Problem: Risk map tracks relationships but UI doesn't show them
- Blocks: Users cannot understand how changes in one clause affect others
- Fix path: Implement relationship graph visualization; add "related clauses" panel; show risk cascades

**No Batch Processing for Multiple Documents:**
- Problem: One session = one document; analyzing related docs (side letter, exhibit) requires separate sessions
- Blocks: Cannot compare or cross-reference across documents
- Fix path: Extend session to support document collections; implement cross-document risk analysis

**No User Preferences Persistence:**
- Problem: Aggressiveness, representation, approach reset on each session
- Blocks: Users must reconfigure for each document
- Fix path: Implement user accounts or at least browser storage for preferences

---

## Test Coverage Gaps

**No Unit Tests for Claude/Gemini Services:**
- What's not tested: API error handling, prompt building, response parsing
- Files: `app/services/claude_service.py` (740 lines), `app/services/gemini_service.py` (592 lines)
- Risk: Prompt injection, malformed API responses, API errors silently fail
- Priority: HIGH - core analysis functionality untested

**No Integration Tests for Session Workflow:**
- What's not tested: Full intake → analysis → revise → finalize flow
- Files: `app/api/routes.py` (928 lines)
- Risk: Regressions in workflow hard to catch; session persistence bugs hidden
- Priority: HIGH - main user flow untested

**No Document Parsing Tests:**
- What's not tested: Section extraction, numbering detection, exhibit detection with real malformed documents
- Files: `app/services/document_service.py` (614 lines)
- Risk: Parsing silently corrupts or loses document structure
- Priority: MEDIUM - parsing fragile but some tests exist for prompt building

**No Tests for Concept Detection:**
- What's not tested: detect_concept_changes, pattern matching edge cases
- Files: `app/services/map_updater.py` (230 lines)
- Risk: Concept map updated incorrectly; risk severity calculations wrong
- Priority: MEDIUM - affects analysis correctness

**No Tests for Model Serialization:**
- What's not tested: RiskMap/ConceptMap to_dict/from_dict round-tripping
- Files: `app/models/risk_map.py` (209 lines), `app/models/concept_map.py` (92 lines)
- Risk: Data loss when saving/loading sessions
- Priority: MEDIUM - affects data persistence

---

## Architecture Issues

**Circular Dependency Risk in Services:**
- Issue: map_updater imports ConceptMap and RiskMap; routes imports map_updater; could create import cycles if not careful
- Files: `app/services/map_updater.py:15`, `app/api/routes.py:540`
- Fix approach: Review import structure; ensure clear dependency direction; extract shared models to separate module

**Missing Context Propagation:**
- Issue: When re-analyzing with `reanalyze_clause`, context retrieved from `session.get('context')` but context stored as top-level keys like 'representation'
- Files: `app/api/routes.py:676-678` (accessing `session.get('context')` which doesn't exist; should be `session.get('representation')`)
- Fix approach: Normalize context structure; use consistent path for all context keys

**Incomplete Error Recovery from API Failures:**
- Issue: If Claude API returns empty/malformed response, batch analysis continues with empty result, polluting risk inventory
- Files: `app/services/claude_service.py:554-577`
- Fix approach: Validate API responses before using; skip batch if response invalid; track skipped batches

---

## Deployment Issues

**No Environment Configuration System:**
- Issue: Configuration scattered across code (hardcoded paths, env var names) with no .env.example
- Files: `app/server.py:27, 54-55`, `run.py:65`, multiple service files
- Impact: Difficult to set up for new developers; unclear what env vars are required
- Fix approach: Create .env.example with all required variables; use pydantic Settings or python-dotenv for centralized config

**Upload Folder Path Not Configurable:**
- Issue: Hardcoded to `app/data/uploads` regardless of where app runs
- Files: `app/server.py:28`
- Impact: Permissions issues if run from different user; no separation of dev/prod uploads
- Fix approach: Make configurable via env var with fallback

**Logging Not Configured:**
- Issue: Only print() statements used; no structured logging, no log levels
- Files: Throughout services
- Impact: Hard to debug production issues; cannot filter error logs; no audit trail
- Fix approach: Add Python logging module with JSON output for production

**No Health Check/Readiness Endpoints Beyond Basic:**
- Issue: `/health` returns static 'ok' without checking database/API connectivity
- Files: `app/server.py:43-45`
- Impact: Load balancers cannot detect if app is truly healthy (e.g., Claude API unreachable)
- Fix approach: Implement true health check with dependency verification

---

*Concerns audit: 2026-02-01*
