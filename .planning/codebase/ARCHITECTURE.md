# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Layered client-server architecture with collaborative web interface, following a 4-phase contract analysis pipeline.

**Key Characteristics:**
- Phase-based workflow: Intake → Analysis → Collaborative Review → Finalization
- Dual LLM capability: Claude Opus 4.5 (analysis) and Gemini 3 Flash (revision generation)
- Concept-driven risk mapping with inter-clause relationship awareness
- Real-time progress tracking for long-running analysis operations
- Session-based stateful operations with disk persistence

## Layers

**Presentation Layer (Frontend):**
- Purpose: Interactive document rendering and collaborative review UI
- Location: `app/static/js/`, `app/static/css/`, `app/static/index.html`
- Contains: Vue-style module system (app.js, sidebar.js, document.js, revision.js, analysis.js, etc.)
- Depends on: REST API endpoints, Session state
- Used by: End users (attorneys)

**API Layer (Flask):**
- Purpose: RESTful endpoints orchestrating the contract review workflow
- Location: `app/api/routes.py`
- Contains: 15+ endpoints handling intake, analysis, revision, finalization, flags
- Depends on: Service layer, Models, Persistence
- Used by: Frontend via HTTP, Session management

**Service Layer:**
- Purpose: Business logic encapsulation for document processing, LLM interaction, revision generation
- Location: `app/services/`
- Contains:
  - `document_service.py`: Parse/rebuild Word documents, generate final outputs with track changes
  - `claude_service.py`: Deep risk analysis using Claude Opus 4.5 with batch processing
  - `gemini_service.py`: Revision generation using Gemini 3 Flash with context awareness
  - `analysis_service.py`: Regex-based fallback analysis for contract structure
  - `map_updater.py`: Concept map and risk map updates on revision acceptance
- Depends on: Models, External APIs (Anthropic, Google), Document parsing
- Used by: API routes, Orchestration logic

**Model Layer:**
- Purpose: Domain-specific data structures for legal analysis
- Location: `app/models/`
- Contains:
  - `concept_map.py`: Document-wide provisions grouped by legal concept (liability, knowledge, termination, defaults, defined terms)
  - `risk_map.py`: Risk hierarchy with severity calculation considering mitigators/amplifiers
- Depends on: Nothing (pure data structures)
- Used by: Services, API responses

**Data Layer:**
- Purpose: Persistence and document parsing
- Location: `app/data/`, file system
- Contains: Session JSON files, uploaded documents (target + precedent), parsed document JSONs
- Depends on: python-docx library for parsing
- Used by: Document service, API layer for session loading

## Data Flow

**Intake Phase:**
1. User uploads target contract + optional precedent via `/api/intake`
2. `document_service.parse_document()` extracts structure: paragraphs, sections, exhibits, defined terms
3. Session created with parsed_doc, contract_type (detected), user context (representation, aggressiveness, deal_context)
4. Session stored in-memory and persisted to disk at `app/data/sessions/{session_id}.json`
5. Frontend receives session_id and document metadata

**Analysis Phase:**
1. User requests analysis via `/api/analysis/<session_id>`
2. `claude_service.analyze_document_with_llm()` batches paragraphs (5 per call) for efficiency
3. Claude Opus 4.5 analyzes with context: contract type, representation, aggressiveness
4. Analysis produces: risk_inventory (array of per-paragraph risks), concept_map, document_map
5. ConceptMap and RiskMap objects built from analysis, stored in session
6. Progress updates sent via `/api/analysis/<session_id>/progress` during execution
7. Analysis persisted to session; used for sidebar rendering

**Revision Phase:**
1. User clicks risk/opportunity in sidebar → requests revision via `/api/revise`
2. Revision request includes: para_id, risk_id(s), include_related_ids, custom_instruction
3. `gemini_service.generate_revision()` called with:
   - Original paragraph text
   - Risk context from analysis
   - Related clause texts (for context)
   - Concept map (to reference defined terms)
   - Precedent document (if available)
4. Gemini 3 Flash returns: revised_text, rationale, diff_html (HTML track changes)
5. Revision stored in session['revisions'][para_id] with accepted=False
6. User accepts/rejects via `/api/accept` or `/api/reject`
7. On accept: `map_updater.detect_concept_changes()` identifies concept shifts, updates concept_map and risk_map
8. Affected paragraph IDs returned for potential re-analysis

**Finalization Phase:**
1. User completes review, requests finalization via `/api/finalize`
2. `document_service.generate_final_output()` reconstructs Word document:
   - Loads original document structure
   - Applies accepted revisions with track changes (using python-docx)
   - Preserves original formatting, numbering, styles
3. Generates transmittal email (summary of key changes, flags)
4. Generates manifest (hierarchical list of all changes with rationale)
5. Returns paths to: revised.docx, transmittal.txt, manifest.md
6. User downloads outputs

**State Management:**
- Session object as single source of truth: { session_id, parsed_doc, analysis, concept_map, risk_map, revisions, flags, status }
- In-memory storage via global dict `sessions` in `routes.py`
- Disk persistence: JSON files at `app/data/sessions/` and `app/data/uploads/{session_id}/`
- Loaded on-demand if not in memory (e.g., after server restart)

## Key Abstractions

**Session:**
- Purpose: Encapsulate a single contract review workflow
- Examples: `routes.py` line 25 (sessions dict), `document_service.parse_document()` output
- Pattern: Mutable state object following state machine: initialized → analyzed → reviewed → finalized

**Paragraph:**
- Purpose: Atomic unit of contract content with metadata
- Examples: `app/static/js/document.js` rendering, `routes.py` /revise endpoint lookup
- Pattern: Dictionary with keys: id, type, text, section_ref, section_hierarchy, style info

**Risk:**
- Purpose: Document single identified risk or opportunity
- Examples: `app/models/risk_map.py`, `routes.py` line 330-347 (building RiskMap)
- Pattern: risk_id, clause/para_id, title, description, severity, mitigators, amplifiers, triggers

**Revision:**
- Purpose: Track proposed change to a paragraph
- Examples: `routes.py` line 506-515, `/revise` endpoint response
- Pattern: original text, revised text, rationale, diff_html, related_revisions, accepted flag, timestamp

**ConceptMap:**
- Purpose: Document-wide view of key legal provisions by category
- Examples: `app/models/concept_map.py`, `routes.py` line 305-326
- Pattern: Nested dict grouped by category (liability_limitations, knowledge_standards, termination_triggers, default_remedies, defined_terms)

**RiskMap:**
- Purpose: Risk hierarchy with relationship-aware severity calculation
- Examples: `app/models/risk_map.py`, `routes.py` line 329-350
- Pattern: Risks stored with mitigators/amplifiers; recalculate_all_severities() adjusts based on relationships

## Entry Points

**Application Start:**
- Location: `run.py`
- Triggers: `python run.py`
- Responsibilities: Dependency check, API key validation, Flask app startup

**Flask Application:**
- Location: `app/server.py` create_app()
- Triggers: Import in `run.py`
- Responsibilities: Configure Flask (50MB upload limit, static folder, session folders), register blueprint, serve index.html

**API Blueprint:**
- Location: `app/api/routes.py`
- Triggers: Flask initialization
- Responsibilities: Define all endpoints, session management, orchestrate services

**Frontend Initialization:**
- Location: `app/static/js/app.js`
- Triggers: DOMContentLoaded event
- Responsibilities: Setup drag-drop, risk events, bottom sheet, navigation, sidebar tabs, show intake screen

**Intake Endpoint:**
- Location: `app/api/routes.py` /intake (line 97)
- Triggers: User form submission in frontend
- Responsibilities: Parse document, detect contract type, initialize session, return session_id

**Analysis Endpoint:**
- Location: `app/api/routes.py` /analysis/<session_id> (line 261)
- Triggers: User clicks "Analyze" in frontend
- Responsibilities: Invoke claude_service analysis, build concept/risk maps, store in session, return full analysis

**Revision Endpoint:**
- Location: `app/api/routes.py` /revise (line 417)
- Triggers: User selects risk and clicks "Suggest Revision"
- Responsibilities: Call gemini_service, return revised text with diff, store in session

## Error Handling

**Strategy:** Graceful degradation with fallback paths

**Patterns:**
- LLM API failures: `/api/analysis` catches Claude errors, falls back to regex-based analysis_service (line 369-388)
- Missing files: Check file existence before loading, return 404 if not found (line 239-245)
- Invalid session: Return 404 with error message for non-existent sessions (line 233-235)
- Parse errors: Wrap document_service.parse_document() in try-catch, return 500 with error (line 142-145)
- Incomplete revisions: Check for None/empty, validate before persisting (line 506-515)

## Cross-Cutting Concerns

**Logging:** Console logging via Python print() and JavaScript console.log(); no centralized logging framework

**Validation:**
- Frontend: Form validation in intake.js (file presence, representation selection)
- Backend: Session existence check before operations, file path validation with Path.exists()

**Authentication:** None (application assumes single-user local deployment)

**Rate Limiting:** None (relies on LLM API rate limits for Gemini/Claude)

**CORS:** Not implemented (assumes same-origin; static files and API on same domain)

**Session Timeout:** No explicit timeout; sessions persist on disk indefinitely until manually cleared

---

*Architecture analysis: 2026-02-01*
