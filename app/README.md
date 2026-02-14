# Contract Review API Backend

Flask REST API providing document parsing, AI-powered analysis, revision generation, and finalization endpoints for the Ambrose contract redlining tool.

## Key Modules

- **`api/routes.py`** -- All HTTP endpoints (intake, analysis, revision, flagging, finalization)
- **`services/claude_service.py`** -- Claude Opus integration for document analysis and risk identification
- **`services/gemini_service.py`** -- Gemini API integration for surgical redline generation
- **`services/document_service.py`** -- DOCX parsing, structure extraction, and track-changes output
- **`services/analysis_service.py`** -- Regex-based fallback analysis when LLM unavailable
- **`services/map_updater.py`** -- Updates concept/risk maps when revisions are accepted
- **`models/concept_map.py`** -- Provisions grouped by legal concept
- **`models/risk_map.py`** -- Risk dependency tracking with relationship recalculation

## API Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/intake` | POST | Initialize session with document upload |
| `/api/sessions` | GET | List saved sessions |
| `/api/session/<id>` | GET/DELETE | Session metadata or deletion |
| `/api/document/<id>` | GET | Parsed document structure |
| `/api/document/<id>/html` | GET | Rendered HTML |
| `/api/analysis/<id>` | GET | Risk/opportunity analysis |
| `/api/revise` | POST | Generate AI revision for a clause |
| `/api/accept` | POST | Accept a revision |
| `/api/reject` | POST | Reject a revision |
| `/api/flag` | POST | Flag item for client review |
| `/api/finalize` | POST | Generate final outputs |
| `/api/download/<id>/<type>` | GET | Download generated files |

See `api/routes.py` for the complete endpoint documentation.

## Running

```bash
# From project root
pip install -r requirements.txt
python run.py
```

The API starts on `http://localhost:5000`. The frontend is a separate Next.js application in `../frontend/`.

## Data Storage

Session state and uploads are stored on disk:

- **Sessions:** `data/sessions/{session_id}.json`
- **Uploads:** `data/uploads/{session_id}/`

Both directories are gitignored and created at runtime.
