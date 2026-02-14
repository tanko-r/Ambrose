# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Layered client-server web application with Flask API backend and Next.js React frontend, orchestrating a collaborative contract review workflow across four distinct phases.

**Key Characteristics:**
- Session-based architecture for maintaining state across multi-step workflows
- Service-oriented backend with clear separation between parsing, analysis, and revision generation
- Real-time progress tracking for long-running LLM operations
- Document concept and risk mapping to support intelligent cross-clause analysis
- Dual LLM integration (Claude for analysis, Gemini for revision generation)

## Layers

**Presentation Layer (Frontend):**
- Purpose: Provide interactive UI for intake, document browsing, risk review, and revision acceptance
- Location: `C:\Users\david\Documents\claude-redlining\frontend\`
- Contains: Next.js 16 App Router with React components, Zustand store, shadcn/ui
- Depends on: Flask backend API endpoints (proxied via Next.js rewrites)
- Used by: End users (legal professionals)

**API/Routing Layer:**
- Purpose: Expose HTTP endpoints for all application workflows
- Location: `C:\Users\david\Documents\claude-redlining\app\api\routes.py`
- Contains: Blueprint with endpoints for intake, analysis, revisions, flagging, finalization
- Depends on: Service layer (document, claude, gemini, analysis services)
- Used by: Frontend, session management

**Service Layer:**
- Purpose: Encapsulate business logic and external integrations
- Location: `C:\Users\david\Documents\claude-redlining\app\services\`
- Contains:
  - `claude_service.py`: Claude Opus integration for deep document analysis and risk identification
  - `gemini_service.py`: Gemini API integration for surgical redline generation
  - `document_service.py`: DOCX parsing, rebuilding with track changes
  - `analysis_service.py`: Regex-based fallback analysis when LLM fails
  - `map_updater.py`: Updates concept and risk maps when revisions are accepted
- Depends on: External APIs (Anthropic, Google), python-docx library
- Used by: API routing layer

**Model Layer:**
- Purpose: Define data structures for complex document relationships
- Location: `C:\Users\david\Documents\claude-redlining\app\models\`
- Contains:
  - `concept_map.py`: ConceptMap class organizing provisions by legal concept (liability_limitations, knowledge_standards, termination_triggers, default_remedies, defined_terms)
  - `risk_map.py`: RiskMap class with Risk objects tracking relationships (mitigated_by, amplified_by, triggers)
- Depends on: None (pure data structures)
- Used by: API routes for analysis, Claude service for building prompts

**Data Storage Layer:**
- Purpose: Persist documents, session state, and analysis results
- Location: `C:\Users\david\Documents\claude-redlining\app\data\`
- Contains: Filesystem-based storage (JSON files for sessions, uploaded DOCX files)
- Depends on: Flask app config
- Used by: API routes for session retrieval

**Entry Point:**
- Location: `C:\Users\david\Documents\claude-redlining\app\server.py`
- Creates Flask app, registers API blueprint, configures upload/session folders

## Data Flow

**Intake Phase:**

1. User submits form via frontend intake screen with:
   - Target contract (DOCX file)
   - Optional precedent/preferred form (DOCX file)
   - Representation (seller/buyer/landlord/tenant/lender/borrower/developer/grantor/grantee/other)
   - Deal context (free text)
   - Review approach (quick-sale/competitive-bid/relationship/adversarial)
   - Aggressiveness level (1-5 scale)
   - Exhibit handling preference

2. `POST /api/intake` endpoint in `routes.py` handles upload:
   - Creates session directory in `app/data/uploads/{session_id}/`
   - Saves uploaded files
   - Calls `document_service.parse_document()` to extract structure

3. Document parsing (`document_service.py`):
   - Extracts paragraphs with IDs, section hierarchy, numbering
   - Identifies section structure (Articles, Sections, subsections)
   - Detects defined terms
   - Returns JSON with content, sections, exhibits, metadata

4. Contract type detection (routes.py):
   - Regex-based detection of PSA, lease, easement, development, loan, general
   - Stored in session for later context

5. Session created and stored:
   - In-memory in `sessions` dict
   - Persisted to disk in `app/data/sessions/{session_id}.json`
   - Status: "initialized"

**Analysis Phase:**

1. Frontend requests `GET /api/analysis/{session_id}`
2. If analysis not cached, routes.py calls `claude_service.analyze_document_with_llm()`:
   - Sends parsed document to Claude Opus 4.5 (thinking model)
   - Provides contract type, representation, aggressiveness level
   - Requests: document structure overview, risk inventory, concept map, triggers
   - Batches clauses (5 per API call for efficiency)
   - Real-time progress tracking via `update_progress()` function

3. Analysis result includes:
   - risk_inventory: Array of risks with risk_id, para_id, title, description, severity
   - concept_map: Grouped provisions by category
   - document_map: Structure overview

4. Routes.py builds in-memory data structures:
   - `ConceptMap` object from analysis['concept_map']
   - `RiskMap` object from risk_inventory, with relationships calculated
   - Both stored in session for later use

5. Fallback: If Claude fails, `analysis_service.analyze_document()` runs regex-based patterns
   - Identifies common risks (uncapped liability, no term expiration, etc.)
   - Stores with flag `analysis_method: 'regex_fallback'`

**Revision Phase:**

1. User clicks on paragraph, sidebar loads risk/opportunity analysis
2. User selects specific risk to address, clicks "Revise"
3. Frontend sends `POST /api/revise`:
   - session_id, para_id, risk_ids, optional custom_instruction
   - Optional related paragraph IDs for context

4. Routes.py collects context:
   - Original paragraph text
   - Matching risks from cached analysis
   - Related clauses (if revised, shows revised text)
   - Representation, aggressiveness, deal context
   - Concept map and risk map for broader context

5. `gemini_service.generate_revision()` called:
   - Sends original text + risks to Gemini API
   - Provides chain-of-thought prompting for materiality analysis
   - Returns revised text with track-changes style diff (HTML)
   - Returns rationale explaining the change

6. Revision stored in session['revisions'][para_id]:
   - original, revised, rationale, thinking, diff_html
   - accepted: False initially

**Revision Acceptance:**

1. User accepts revision via `POST /api/accept`
2. Routes.py calls `map_updater.detect_concept_changes()`:
   - Compares original vs revised text
   - Identifies changes in: defined terms, conditions, liability scope, etc.

3. If changes detected and maps exist, `update_maps_on_revision()` recalculates:
   - Updates concept map with new/modified provisions
   - Recalculates risk map severities based on changed relationships
   - Returns list of affected paragraph IDs that may need re-analysis

4. Revision marked `accepted: True`

**Optional Re-analysis:**

1. User can click "Re-analyze clause" after accepting related revisions
2. `POST /api/reanalyze` sends para_id
3. Routes.py collects revised context from accepted revisions of related clauses
4. Calls `claude_service.analyze_single_paragraph()`:
   - Analyzes paragraph with updated relationship context
   - Updates `analysis['risk_by_paragraph'][para_id]`

**Finalization Phase:**

1. User clicks "Finalize" and submits `POST /api/finalize`
2. Routes.py calls `document_service.generate_final_output()`:
   - Reads original DOCX
   - Applies accepted revisions with track changes
   - Generates manifest listing all changes with rationale
   - Compiles transmittal email summary
   - Returns paths to: docx_path, transmittal_path, manifest_path

3. User can download files via `GET /api/download/{session_id}/{file_type}`

## State Management

**Session State (routes.py):**
```python
session = {
    'session_id': str,
    'created_at': ISO8601,
    'status': 'initialized|analyzed|finalized',
    'representation': 'seller|buyer|...',
    'contract_type': 'psa|lease|...',
    'aggressiveness': int (1-5),
    'deal_context': str,
    'parsed_doc': dict (full parsed content),
    'parsed_precedent': dict (optional),
    'analysis': dict (risk_inventory, concept_map, etc.),
    'concept_map': dict (ConceptMap.to_dict()),
    'risk_map': dict (RiskMap.to_dict()),
    'revisions': {
        'para_id': {
            'original': str,
            'revised': str,
            'rationale': str,
            'accepted': bool,
            'diff_html': str
        }
    },
    'flags': [
        {
            'para_id': str,
            'section_ref': str,
            'note': str,
            'flag_type': 'client|attorney',
            'timestamp': ISO8601
        }
    ]
}
```

**Progress Tracking (claude_service.py):**
```python
analysis_progress = {
    'session_id': {
        'status': 'analyzing|complete',
        'percent': int (0-100),
        'current_clause': str,
        'updated_at': timestamp
    }
}
```

## Error Handling

**Strategy:** Graceful degradation with fallbacks

**Patterns:**

1. **LLM Analysis Failures:**
   - Primary: Claude Opus analysis via `claude_service`
   - Secondary: Regex-based analysis via `analysis_service`
   - Result: Analysis completes with flag `analysis_method: 'regex_fallback'`

2. **API Key Issues:**
   - Claude: Checks ANTHROPIC_API_KEY env var, then anthropic_api.txt
   - Gemini: Checks GEMINI_API_KEY env var, then api.txt
   - Missing keys don't crash app, only block specific features

3. **File Operations:**
   - Try/except on document parsing with 400/500 status codes
   - Invalid DOCX files return 400 Bad Request
   - Server errors return 500 with error message

4. **Session Not Found:**
   - All endpoints check `get_session()` first
   - Return 404 if session_id invalid

## Cross-Cutting Concerns

**Logging:** Console output via Flask debug mode; no persistent logging layer

**Validation:**
- File uploads: Restricted to .docx files only
- Session existence: Checked before all operations
- Aggressiveness: Coerced to int(1-5) with default 3

**Authentication:** Not detected - no auth layer in current implementation

## Data Transformation Pipeline

```
DOCX File
    ↓
document_service.parse_document()
    ↓
Parsed JSON (content[], sections[], exhibits[], defined_terms[])
    ↓
Sent to Claude Opus
    ↓
Analysis JSON (risk_inventory[], concept_map, document_map)
    ↓
ConceptMap & RiskMap objects (in-memory models)
    ↓
Displayed in UI
    ↓
User selects risks → Sent to Gemini
    ↓
Revised text + rationale
    ↓
User accepts → map_updater recalculates relationships
    ↓
Finalization sends all accepted revisions + original DOCX
    ↓
document_service.generate_final_output()
    ↓
Final DOCX with track changes + manifest + transmittal email
```

---

*Architecture analysis: 2026-02-01*
