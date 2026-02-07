# Codebase Concerns

**Analysis Date:** 2026-02-01

## Tech Debt

**Session Storage - In-Memory Only:**
- Issue: Sessions are stored in-memory Python dictionary with disk persistence as fallback. No distributed persistence or error handling if server crashes.
- Files: `app/api/routes.py` (lines 24-45), `app/services/claude_service.py` (lines 18-43)
- Impact: User session data lost on server restart. Concurrent requests to same session may have consistency issues. Not suitable for production workloads.
- Fix approach: Implement Redis or database session backend with atomic operations. Currently using dual in-memory + disk sync pattern that can diverge.

**Dual LLM Implementation - Incomplete Convergence:**
- Issue: Codebase supports both Claude and Gemini APIs but implementations differ significantly. Gemini service appears more mature with TF-IDF retrieval, but Claude service is primary for analysis.
- Files: `app/services/claude_service.py`, `app/services/gemini_service.py`, `WSL_Files/` directory (contains parallel implementations)
- Impact: Code duplication, maintenance burden, different behavior between services. WSL_Files suggests legacy Windows-specific versions that should be removed.
- Fix approach: Consolidate to single LLM abstraction layer. Remove WSL_Files legacy code. Unify prompt strategies and output formats.

**Loose Session Validation:**
- Issue: File paths are saved directly from request without validation. No checks for path traversal or other injection attacks.
- Files: `app/api/routes.py` (lines 131-139 for file.save(), line 132 directly uses user-provided filename)
- Impact: Arbitrary file writes possible via crafted uploads. User-provided `target_file.filename` stored directly without sanitization.
- Fix approach: Sanitize all uploaded filenames. Use UUID-based naming only. Validate file types on upload.

**Serialization Bypass in Session Persistence:**
- Issue: Session persistence explicitly skips `parsed_doc` object during JSON serialization (line 42), using only path instead. But `parsed_doc` is accessed directly from in-memory dict, creating consistency risk.
- Files: `app/api/routes.py` (lines 40-45)
- Impact: If disk is updated but process crashes before in-memory update, next request reads inconsistent state. Cross-service requests may see stale data.
- Fix approach: Either fully serialize all data or implement proper transaction semantics with timestamps/checksums.

**Unqualified Exception Handling:**
- Issue: Broad `except Exception` catches in critical paths with only string logging. No differentiation between recoverable and fatal errors.
- Files: `app/api/routes.py` (lines 144, 365, 527, 696, 805), `app/services/claude_service.py` (lines 360, 441, 579, 739)
- Impact: Silent failures on unexpected errors. Incomplete error recovery leaves sessions in ambiguous states. Rate limits and API errors treated identically.
- Fix approach: Use specific exception types. Implement retry logic with exponential backoff for transient errors. Log full stack traces for investigation.

**Hardcoded Model References:**
- Issue: Claude model version hardcoded as 'claude-opus-4-5-20251101' in analysis_service.py line 622. Will break when model is deprecated.
- Files: `app/services/claude_service.py` (line 622)
- Impact: No version negotiation. Forced migration required when Anthropic deprecates model.
- Fix approach: Read model version from environment/config with fallback to latest available.

**Missing Conversation Memory Between Requests:**
- Issue: Each revision request to Gemini is independent with no conversation context. Risk analysis learned in analysis phase not carried forward to redline generation phase.
- Files: `app/services/gemini_service.py` (lines 347-400 for redline generation)
- Impact: Gemini may miss context-dependent risks when generating revisions. Inconsistent recommendations across phases.
- Fix approach: Build shared context object passed between analysis and revision phases. Store conversation history.

## Known Bugs

**Risk ID Numbering Reset on Reruns:**
- Symptoms: Running analysis multiple times on same session renumbers all risks (line 600 in claude_service.py: `risk['risk_id'] = f'R{i+1}'`). User-selected inclusions/exclusions for R5 become invalid when R5 changes identity.
- Files: `app/services/claude_service.py` (lines 598-600), `app/static/js/sidebar.js` (lines 9-10 riskSelectionState uses risk_id as key)
- Trigger: Call /analysis twice on same session. First run creates R1-R20, user selects some. Second run creates different R1-R20, old selections orphaned.
- Workaround: Delete session and restart if reanalysis needed. Never update analysis once risks are selected.

**Sidebar Risk State Lost on Navigation:**
- Symptoms: Risk inclusion/exclusion selections (stored in riskSelectionState object) are in-memory JavaScript only. Navigating to different paragraph and back forgets selections.
- Files: `app/static/js/sidebar.js` (line 10: `const riskSelectionState = {}`)
- Trigger: Select risks to exclude, click different paragraph, click back to original. Previous selections are reset.
- Workaround: Complete all risk selections for a paragraph before moving to next. Save to server immediately.

**Missing API Key Fallback Chaining:**
- Symptoms: Gemini service checks for API key in specific order but may fail silently if key exists but is invalid (empty string, wrong format).
- Files: `app/services/gemini_service.py` (lines 35-59), `app/services/claude_service.py` (lines 60-84)
- Trigger: api.txt contains whitespace-only key or malformed .env entry.
- Workaround: Verify api.txt is not empty and .env ANTHROPIC_API_KEY= has actual value, not quotes.

**Batch Processing Error Recovery Incomplete:**
- Symptoms: When batch analysis fails (line 579-587), error is logged and loop continues, but failed batch risks are silently dropped. No marker indicating which paragraphs were not analyzed.
- Files: `app/services/claude_service.py` (lines 579-587)
- Trigger: Temporary API error during batch 3 of 5. Batches 1-2 and 4-5 analyzed, batch 3 skipped. Report shows 80% analyzed but doesn't flag gap.
- Workaround: Check analysis for unexpected gaps in risk counts. Manually request reanalysis of suspicious sections.

## Security Considerations

**Exposed Session IDs in URLs:**
- Risk: Session ID used in URL path for download and analysis endpoints (line 809: `/download/<session_id>/<file_type>`). Session ID is UUID but could be guessed or harvested from logs.
- Files: `app/api/routes.py` (lines 809, 262, and throughout)
- Current mitigation: UUIDs are 128-bit, cryptographically unlikely to guess. No access control check beyond session existence.
- Recommendations: (1) Add Bearer token authentication. (2) Use secure session cookies instead of URL parameters. (3) Log all session accesses. (4) Implement session timeout (15-30 min idle). (5) Add CORS restrictions.

**API Keys in File Paths:**
- Risk: API keys read from multiple locations including project root directory (line 69 in claude_service.py: `Path(__file__).parent.parent.parent / 'anthropic_api.txt'`). Keys may be committed to git or world-readable.
- Files: `app/services/claude_service.py` (lines 68-72), `app/services/gemini_service.py` (lines 43-47)
- Current mitigation: .gitignore should exclude api.txt, but many users won't know to create it.
- Recommendations: (1) Only read from environment variables in production. (2) Document .gitignore in setup. (3) Add .gitignore pre-commit hook. (4) Never allow fallback to plaintext files. (5) Use AWS Secrets Manager / Azure Key Vault.

**Unvalidated File Type Assumptions:**
- Risk: Files uploaded as .docx are parsed directly with `python-docx` without magic number validation. Zip bomb or malicious DOCX could crash parser.
- Files: `app/api/routes.py` (line 143 calls `parse_document(target_path)` without validation), `app/services/document_service.py` (line 461+ opens with python-docx)
- Current mitigation: Python-docx has some safety, but no explicit validation.
- Recommendations: (1) Check file magic bytes (DOCX is ZIP, starts with PK). (2) Set file size limits per file type. (3) Scan with antivirus/sandboxing. (4) Set timeout on parse operations.

**Verbose Error Messages Exposing Structure:**
- Risk: API errors return full exception messages revealing internal file paths, function names, and structure (line 145: `f'Failed to parse document: {str(e)}'`).
- Files: `app/api/routes.py` (lines 145, 500, 806), throughout
- Current mitigation: Only visible to authenticated user, but error logs may be collected.
- Recommendations: (1) Log full error internally. (2) Return generic user message. (3) Include request ID for support. (4) Implement structured logging with sensitive data masking.

**Precedent File Parser May Load Arbitrary JSON:**
- Risk: If precedent DOCX parsing fails, `parsed_precedent = None` (line 154) but downstream code may assume it's hydrated. Mixing null with object access.
- Files: `app/api/routes.py` (lines 150-154)
- Current mitigation: Code checks `precedent_path` before use, but defensive coding is inconsistent.
- Recommendations: (1) Use TypedDict or dataclass for parsed_precedent. (2) Implement strict schema validation on all parsed content. (3) Add assertion guards.

## Performance Bottlenecks

**Batch Analysis with Fixed Batch Size:**
- Problem: Batch size hardcoded to 5 (line 298 in routes.py). For 100-paragraph contracts, requires 20 API calls. Each call has 30-60 second latency. Total 10-20 minutes for single document.
- Files: `app/api/routes.py` (line 298), `app/services/claude_service.py` (lines 527-561)
- Cause: Paragraph-level analysis chosen for granularity, but no parallelization or adaptive sizing.
- Improvement path: (1) Increase batch size dynamically based on token budget. (2) Implement parallel requests with connection pooling. (3) Cache common risk patterns to skip repeated analysis. (4) Implement streaming response to show progress.

**Full TF-IDF Recalculation on Every Search:**
- Problem: SimpleRetriever in gemini_service.py recalculates TF-IDF vectors for every search query.
- Files: `app/services/gemini_service.py` (lines 102-147)
- Cause: Retriever instantiated fresh per request with no caching.
- Improvement path: (1) Cache SimpleRetriever as session attribute. (2) Implement LSH approximate nearest neighbor search. (3) Pre-compute embeddings using sentence-transformers instead of TF-IDF.

**Synchronous File I/O in Request Path:**
- Problem: Session save writes to disk synchronously (line 40 in routes.py: `json.dump(serializable, f, indent=2)`). For large sessions with full analysis, 1-3MB JSON write blocks request.
- Files: `app/api/routes.py` (lines 35-45)
- Cause: Simple implementation, no async queue.
- Improvement path: (1) Use `asyncio` for file I/O. (2) Implement write queue with background worker. (3) Use compression (gzip) for session persistence.

**Frontend Render of Large Document (1267-line sidebar.js):**
- Problem: sidebar.js is 1267 lines with complex risk relationship rendering. Full rerender on each paragraph click triggers cascading DOM updates.
- Files: `app/static/js/sidebar.js` (entire file, especially buildRiskRelationshipsHtml)
- Cause: jQuery-style full replacement instead of virtual DOM or delta updates.
- Improvement path: (1) Migrate to React/Vue for efficient diffing. (2) Implement virtualization for risk lists. (3) Lazy-load risk details on expand.

**Session Data Loaded Entirely into Memory:**
- Problem: Full parsed document with all paragraphs and analysis kept in RAM (sessions dict, line 25 in routes.py). For 10 concurrent users with large contracts, hundreds of MB RAM.
- Files: `app/api/routes.py` (line 25: `sessions = {}` stores full parsed docs)
- Cause: Python dict holds everything in memory; no database.
- Improvement path: (1) Move to database with lazy loading. (2) Implement LRU cache with eviction. (3) Stream large responses instead of buffering.

## Fragile Areas

**Concept Map Aggregation Across Batches:**
- Files: `app/services/claude_service.py` (lines 564-570)
- Why fragile: Later batches override earlier concept_map entries with same key. If batch 1 identifies "Definition of Closing" as important and batch 3 redefines it differently, batch 3 wins silently. No merge strategy or conflict detection.
- Safe modification: (1) Add batch number to keys to preserve all definitions. (2) Implement explicit conflict resolution (e.g., pick most severe). (3) Validate concept_map schema after each batch.
- Test coverage: No test for multi-batch concept_map merging. Risk relationships could be lost.

**Risk Relationship Cross-Referencing Between Batches:**
- Files: `app/services/claude_service.py` (lines 330-347), `app/models/risk_map.py` (if exists)
- Why fragile: Risk R5 may reference risk R20 as a mitigator. If they're in different batches analyzed at different times, relationship may not be resolved correctly.
- Safe modification: (1) Store relationships as references (risk_id pairs) not resolved objects. (2) Post-process all risks to resolve references after all batches complete. (3) Add validation that all referenced risks exist.
- Test coverage: No test for cross-batch relationships. Dangling references possible.

**Parsed Document Consistency Between Disk and Memory:**
- Files: `app/api/routes.py` (lines 40-45, 172-183), multiple route handlers
- Why fragile: Session saved to disk only during save_session(), but parsed_doc accessed directly from in-memory sessions dict. If memory corrupted but disk still valid, no recovery path.
- Safe modification: (1) Always reconstruct parsed_doc from JSON on read. (2) Implement write-ahead logging. (3) Add checksum validation. (4) Use SQLite for transactional safety.
- Test coverage: No test for concurrent reads/writes or crash recovery.

**Large JavaScript Files Without Module Boundaries:**
- Files: `app/static/js/sidebar.js` (1267 lines), `app/static/js/revision.js` (1015 lines), `app/static/js/navigation.js` (515 lines)
- Why fragile: Global variables (expandedRiskId, riskSelectionState, AppState). No encapsulation. Changes to sidebar affect revision and navigation unpredictably.
- Safe modification: (1) Refactor into modules using ES6 import/export. (2) Use Webpack/Rollup for bundling. (3) Implement proper state management (Redux, Vuex). (4) Add TypeScript for type safety.
- Test coverage: No JavaScript unit tests. E2E testing only via UI.

**Contract Type Detection with Regex Patterns:**
- Files: `app/api/routes.py` (likely calls `detect_contract_type()` on line 157)
- Why fragile: Contract type inferred from document content using pattern matching. Contracts with uncommon naming conventions will misclassify, leading to wrong analysis prompts.
- Safe modification: (1) Let user explicitly specify contract type. (2) Implement multi-class classifier with confidence scores. (3) Add manual override UI. (4) Log misclassifications for retraining.
- Test coverage: No test data with various contract formats.

## Scaling Limits

**In-Memory Session Dictionary Growth:**
- Current capacity: ~100 concurrent sessions with 5MB analysis each = 500MB. Single server instance RAM typically 4-8GB.
- Limit: 1000 sessions before OOM crash. At 50 users/day running 2 analyses each, hits limit in 10 days if sessions never purged.
- Scaling path: (1) Implement Redis with TTL (24 hour expiry). (2) Archive completed sessions to S3/GCS. (3) Implement session cleanup endpoint. (4) Add monitoring/alerting for memory usage.

**Single-Threaded Flask Development Server:**
- Current capacity: 1 request at a time. Batch analysis blocks for 10-20 minutes, queuing all other users.
- Limit: More than 2-3 concurrent users experience 5+ minute waits.
- Scaling path: (1) Deploy with Gunicorn/uWSGI with worker pool. (2) Implement background job queue (Celery + Redis). (3) Move analysis to async endpoints that return immediately with job ID. (4) Implement WebSocket for live progress updates instead of polling.

**API Rate Limits (Claude and Gemini):**
- Current capacity: Claude API has quota limits (typically 100K tokens/min for standard tier). Analysis job uses 50-100K tokens per document.
- Limit: 1 concurrent analysis, maybe 3-4 queued before hitting quota.
- Scaling path: (1) Implement request throttling and backoff. (2) Add multiple API key rotation (if different projects). (3) Cache common risks to reduce reanalysis. (4) Batch multiple documents into single API call if possible.

**Document Size Limits:**
- Current capacity: python-docx loads entire document into memory. 50MB+ documents cause memory spike during parse.
- Limit: Documents over 100 pages (10+ MB) slow down significantly. Over 500 pages may OOM.
- Scaling path: (1) Implement streaming parser. (2) Implement document chunking (analyze sections separately). (3) Add file size limits to intake form. (4) Implement preprocessing to extract exhibits separately.

## Dependencies at Risk

**python-docx Library Maintenance:**
- Risk: Last major version 0.8.11 released 2022. No recent updates. Standard library for DOCX parsing but may have bugs/security issues.
- Impact: DOCX format changes or legacy format handling may break. No built-in track changes support (using redlines library as workaround).
- Migration plan: (1) Evaluate LibreOffice UNO API as alternative. (2) Use DocumentFormat.OpenXml (.NET) via subprocess. (3) Contribute fixes upstream or maintain fork. (4) Document known limitations and edge cases.

**Anthropic SDK 0.40.0 - Pre-Stable:**
- Risk: SDK version 0.40.0 is pre-1.0. API may change significantly.
- Impact: Code using anthropic.APIError (line 360 in claude_service.py) may break if exception hierarchy changes.
- Migration plan: (1) Pin to specific version. (2) Implement adapter layer for SDK calls. (3) Monitor changelog. (4) Create tests for API changes.

**google-genai Pre-Release Status:**
- Risk: Google Gemini API SDK version 0.1.0 is pre-release. Function calling API (line 521 in gemini_service.py) has TODO comment indicating incomplete implementation.
- Impact: Gemini revision generation may break or produce invalid output.
- Migration plan: (1) Wait for stable v1.0 release. (2) Implement fallback to simple text generation if function calling unavailable. (3) Test with production Gemini API regularly.

**diff-match-patch Library (No Maintenance):**
- Risk: Library used for HTML diff visualization (line 43 in run.py). Last update 2021.
- Impact: May not handle all Unicode or complex HTML structures.
- Migration plan: (1) Replace with unified-diff for text-based approach. (2) Use Quill Delta format for collaborative editing. (3) Implement custom diff renderer matching legal document conventions.

## Missing Critical Features

**No User Authentication:**
- Problem: Any user with session ID can access and modify anyone's session data. No concept of "user owns this session."
- Blocks: Multi-user deployment, client-facing app, compliance (SOC 2, etc.).

**No Session Persistence Across Server Restarts:**
- Problem: Server restart loses all active sessions. Users must restart review.
- Blocks: Production deployment, long-running analysis jobs.

**Incomplete Track Changes Integration:**
- Problem: Finalization endpoint mentions track changes (line 777 in routes.py) but document_service.py shows redlines library as optional (line 23: HAS_REDLINES flag). If library missing, output will be plain text without change markup.
- Blocks: Final Word document may not show changes properly in Microsoft Word.

**No Audit Logging:**
- Problem: No record of which revisions user accepted/rejected. No way to audit decision trail for later disputes.
- Blocks: Professional services, legal compliance, client billing.

**No Conflict Resolution for Concurrent Edits:**
- Problem: If two instances of same session run in parallel, last write wins. No merge strategy.
- Blocks: Team-based reviews, cloud deployment.

## Test Coverage Gaps

**No API Integration Tests:**
- Untested area: Full intake → analysis → revision → finalize workflow. Each endpoint tested in isolation.
- Files: `tests/test_claude_service.py` has only 5 tests of prompt building, no end-to-end tests.
- Risk: Integration points may fail silently. Session state consistency not verified. File I/O errors not caught.
- Priority: High - workflow is core value proposition.

**No Parsing Edge Cases:**
- Untested area: Complex numbering (Roman numerals, nested parentheses), merged cells, headers/footers, revision tracking in source DOCX.
- Files: `app/services/document_service.py` lines 52-87 handle pattern matching but no test data.
- Risk: Real-world contracts with unusual formatting cause parsing failures or data loss.
- Priority: High - parser is critical path.

**No Risk Map Relationship Validation:**
- Untested area: Risk A mitigates risk B, but B is in different batch. Relationships may not resolve or may reference non-existent risks.
- Files: `app/models/risk_map.py` (untested), `app/services/claude_service.py` lines 330-347.
- Risk: Silent relationship failures lead to incomplete analysis shown to user.
- Priority: Medium - affects analysis quality but not functionality.

**No Concurrent Session Access:**
- Untested area: Two requests for same session ID running simultaneously.
- Files: `app/api/routes.py` sessions dict, no locking.
- Risk: Race conditions, lost updates to revisions/flags.
- Priority: High - deployment will encounter this.

**No Large Document Performance Tests:**
- Untested area: Contracts with 200+ paragraphs, 100+ risks. Analysis latency, memory usage, UI responsiveness.
- Files: `app/services/claude_service.py` batch processing, all JavaScript frontend code.
- Risk: Scaling issues discovered in production by user testing.
- Priority: Medium - impacts user experience but not functionality.

**No API Error Simulation:**
- Untested area: Claude/Gemini API timeout, rate limit, 500 error responses. Batch analysis error recovery.
- Files: `app/services/claude_service.py` lines 553-587, `app/services/gemini_service.py` all redline generation.
- Risk: Error handling code path rarely executed, may contain bugs.
- Priority: Medium - production will hit these errors.

---

*Concerns audit: 2026-02-01*
