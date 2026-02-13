# Ambrose -- Contract Redlining Tool

An AI-powered collaborative contract review tool for attorneys. Ambrose analyzes legal documents for risks and opportunities, then generates surgical redlines through an interactive review workflow. Built for real estate attorneys but designed to handle any contract type.

## Tech Stack

- **Backend:** Flask (Python) -- REST API for document parsing, AI analysis, and revision generation
- **Frontend:** Next.js 16 + Tailwind CSS v4 + shadcn/ui -- React-based interactive review interface
- **AI:** Claude Opus (document analysis and risk identification), Gemini Flash (revision generation)
- **State:** Zustand (frontend), file-based sessions (backend)

## Quick Start

```bash
# Prerequisites: Python 3.10+, Node.js 20+

# Install Python dependencies
pip install -r requirements.txt

# Install Node dependencies
cd frontend && npm install && cd ..
npm install  # root dev tooling (concurrently)

# Set API keys
export ANTHROPIC_API_KEY=your-key
export GEMINI_API_KEY=your-key
# Or create anthropic_api.txt / api.txt files

# Start development (both servers)
npm run dev

# Or start individually
npm run dev:flask   # API at http://localhost:5000
npm run dev:next    # Frontend at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
claude-redlining/
├── app/                    # Flask API backend
│   ├── server.py           # App factory (API-only)
│   ├── api/routes.py       # REST endpoints
│   ├── services/           # Business logic (Claude, Gemini, document parsing)
│   ├── models/             # Concept map, risk map
│   └── data/               # Runtime sessions + uploads (gitignored)
├── frontend/               # Next.js frontend
│   ├── src/app/            # Pages (App Router)
│   ├── src/components/     # React components
│   ├── src/hooks/          # Custom hooks
│   └── src/lib/            # Types, API client, store
├── _archived/              # Retired vanilla JS frontend (reference only)
├── package.json            # Dev orchestrator (concurrently)
├── run.py                  # Backend quick start
└── requirements.txt        # Python dependencies
```

## Development

Run `npm run dev` from the project root to start both servers via concurrently:

- **Flask API** runs on `http://localhost:5000` -- serves REST endpoints only (no frontend)
- **Next.js** runs on `http://localhost:3000` -- proxies `/api/*` requests to Flask

The proxy is configured in `frontend/next.config.ts`, so the frontend makes all API calls to its own origin and Next.js forwards them to Flask.

## Key Features

### 1. Intake Phase
- Upload target contract (.docx) and optional precedent/preferred form
- Configure representation, aggressiveness (1-5), review approach, exhibit handling

### 2. Risk/Opportunity Analysis
- AI-powered risk detection per clause with cross-clause awareness
- Contract-type specific analysis (PSA, Lease, Easement, Development Agreement)
- Conceptual document mapping with severity classification

### 3. Collaborative Review Interface
- Document viewer preserving original formatting
- Navigation panel with outline, risk, and category views
- Sidebar showing risks, related clauses, defined terms, and client flags
- On-demand AI revision generation via Gemini with track-changes display

### 4. Finalization
- Word document output with track changes preserving original formatting
- Transmittal email draft and change manifest with rationale

## API Keys

The backend requires API keys for AI features:

| Key | Purpose | Config Options |
|-----|---------|----------------|
| `ANTHROPIC_API_KEY` | Document analysis (Claude) | Env var or `anthropic_api.txt` |
| `GEMINI_API_KEY` | Revision generation (Gemini) | Env var, `api.txt`, or `.env` |

**Gemini models:** Use only `gemini-3-flash-preview` (primary) or `gemini-3-pro-preview` (fallback). See `app/services/gemini_service.py` for configuration.

## License

Private project -- not open source at this time.
