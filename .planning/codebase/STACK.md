# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- Python 3.8+ - Backend server, document processing, LLM integrations, and API layer

## Runtime

**Environment:**
- Python 3.8+ (interpreted language)

**Package Manager:**
- pip
- Lockfile: `requirements.txt` present (pinned versions)

## Frameworks

**Core:**
- Flask 2.0.0+ - Web server and REST API framework (`app/server.py`, `app/api/routes.py`)
- python-docx 0.8.11+ - Word document (.docx) parsing, rendering, and manipulation (`app/services/document_service.py`)

**LLM Integrations:**
- anthropic 0.40.0+ - Claude Opus 4.5 API integration for deep legal analysis (`app/services/claude_service.py`)
- google-genai 0.1.0+ - Google Gemini Flash API for redline generation (`app/services/gemini_service.py`)

**Document Processing:**
- diff-match-patch 20200713+ - Diff visualization and track changes rendering (`app/services/gemini_service.py`)
- python-dotenv 0.19.0+ - Environment variable management for API keys

## Key Dependencies

**Critical:**
- anthropic - Claude Opus 4.5 model for contract risk analysis and concept mapping. Provides deep legal reasoning with extended thinking capability.
- google-genai - Gemini 3 Flash for surgical redline generation. Cost-effective vs. Opus for revision task.
- python-docx - Word document I/O. Preserves formatting, numbering, styles critical for legal documents.
- diff-match-patch - Client-side diff visualization for track changes rendering in UI.

**Infrastructure:**
- Flask - Lightweight Python web framework for local development server and API.
- python-dotenv - Loads environment variables from `.env` file for API keys.

## Configuration

**Environment:**
- API keys loaded from multiple sources with fallback chain:
  - Environment variables: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`
  - Files: `anthropic_api.txt`, `api.txt`, `.env` in project root
  - User home: `~/.anthropic_api_key`, `~/.gemini_api_key`
  - Checked in `app/services/claude_service.py` (lines 60-84)
  - Checked in `app/services/gemini_service.py` (lines 35-59)

- Key configs required:
  - `ANTHROPIC_API_KEY` - Required for Claude Opus 4.5 analysis
  - `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Required for Gemini redline generation
  - `PORT` - Optional, defaults to 5000 if not set

**Build:**
- No build step required. Flask development server runs directly.
- Document upload temp folder: `app/data/uploads/`
- Session persistence folder: `app/data/sessions/`
- Output files: `app/data/output/`

## Platform Requirements

**Development:**
- Python 3.8+ (tested with implicit 3.10+ from requirements)
- pip package manager
- ~50MB max upload size (Flask config, see `app/server.py` line 27)
- Filesystem access for document parsing and session storage

**Production:**
- Python runtime with same requirements
- Environment variables for API keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)
- 50MB+ disk space for session storage and uploads
- Network access to:
  - Anthropic API (api.anthropic.com) for Claude
  - Google Gemini API (generativelanguage.googleapis.com) for Gemini
- Optional: Docker containerization (not currently configured)

## Python Package Versions

From `requirements.txt`:
```
flask>=2.0.0
python-docx>=0.8.11
python-dotenv>=0.19.0
google-genai>=0.1.0
anthropic>=0.40.0
diff-match-patch>=20200713
```

Note: `redlines` package (commented out) provides native Word track changes. Currently using diff-match-patch for diff visualization in UI.

---

*Stack analysis: 2026-02-01*
