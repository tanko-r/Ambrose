# Contract Redlining Assistant

A collaborative legal contract review tool that helps attorneys analyze documents for risks and opportunities, then generate surgical redlines. Built for real estate attorneys to reduce the 8+ hours typically spent manually redlining PSAs and other complex agreements.

## What It Does

Instead of brute-force paragraph-by-paragraph redlining, this tool acts as a **thought partner** for contract analysis:

1.  **Intake Phase** - Upload contract, configure representation, set aggressiveness level
2.  **Risk/Opportunity Analysis** - AI builds a conceptual map and identifies risks with cross-clause awareness
3.  **Collaborative Review** - Interactive sidebar shows analysis per clause, generate surgical revisions on demand
4.  **Finalization** - Export Word document with track changes and transmittal email

## Architecture

**Full-stack web application with Next.js frontend and Flask backend:**

```
┌─────────────────────────────────────────┐
│  Next.js Frontend (TypeScript)          │
│  http://localhost:3000                  │
│  • shadcn/ui + Tailwind CSS v4          │
│  • Zustand state management             │
│  • React Server Components              │
└────────────┬────────────────────────────┘
             │ /api/* proxied via Next.js
             ▼
┌─────────────────────────────────────────┐
│  Flask Backend (Python)                 │
│  http://localhost:5000                  │
│  • 30+ REST API endpoints               │
│  • Session persistence to disk          │
│  • Gemini API integration (revisions)   │
│  • Claude API integration (analysis)    │
└─────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

*   **Python 3.8+** with pip
*   **Node.js 18+** with npm
*   **Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))
*   **Claude API Key** (optional, for analysis features)

### Backend Setup

```
# Install Python dependencies
pip install -r requirements.txt

# Configure Gemini API key (choose one method):
# Option 1: Environment variable
export GEMINI_API_KEY=your_key_here

# Option 2: Create api.txt file
echo "your_key_here" > api.txt

# Option 3: Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# Start Flask server
python run.py
```

Flask will run on **http://localhost:5000**

### Frontend Setup

```
cd frontend

# Install dependencies
npm install

# Start Next.js dev server
npm run dev
```

Next.js will run on **http://localhost:3000**

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
claude-redlining/
├── app/                          # Flask Backend
│   ├── server.py                 # Flask app factory with CORS
│   ├── api/routes.py             # 30+ REST API endpoints (1441 lines)
│   ├── services/
│   │   ├── document_service.py   # DOCX parsing and rebuilding
│   │   ├── analysis_service.py   # Risk/opportunity detection
│   │   ├── gemini_service.py     # Gemini API integration
│   │   └── parallel_analyzer.py  # Parallel risk analysis
│   ├── models/                   # Data models
│   ├── data/                     # Session data, uploads, feedback
│   └── static/                   # Legacy vanilla JS frontend (archived)
│
├── frontend/                     # Next.js Frontend
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   │   ├── page.tsx          # Dashboard (intake + recent projects)
│   │   │   └── review/[sessionId]/page.tsx  # Review interface
│   │   ├── components/
│   │   │   ├── layout/           # Header, navigation
│   │   │   ├── dashboard/        # Intake form, recent projects
│   │   │   ├── review/           # Document viewer, sidebar, bottom bar
│   │   │   └── dialogs/          # Modal dialogs
│   │   ├── lib/
│   │   │   ├── types.ts          # All API types (derived from routes.py)
│   │   │   ├── api.ts            # Typed fetch wrapper for every endpoint
│   │   │   └── store.ts          # Zustand store (replaces vanilla AppState)
│   │   ├── hooks/                # Custom React hooks
│   │   └── styles/               # Global CSS, Tailwind config
│   ├── components.json           # shadcn/ui configuration
│   ├── next.config.ts            # Next.js config (API proxy)
│   └── package.json
│
├── .planning/                    # Project planning documents
│   ├── PROJECT.md                # Project overview and requirements
│   ├── ROADMAP.md                # Feature roadmap
│   └── STATE.md                  # Current project state
│
├── tasks/
│   ├── todo.md                   # Migration progress tracker
│   └── lessons.md                # Lessons learned
│
├── tests/                        # Backend tests
├── fixtures/                     # Test data and seed scripts
└── run.py                        # Flask entry point
```

## Key Features

### 1\. Intake Phase

*   Upload target contract (.docx)
*   Optionally upload precedent/preferred form
*   Configure:
    *   **Representation**: Seller, Buyer, Landlord, Tenant, Lender, Borrower, Developer, Grantor, Grantee
    *   **Aggressiveness**: 1-5 scale
    *   **Review Approach**: Quick-sale, competitive-bid, relationship, adversarial
    *   **Exhibit Handling**: Include or ignore exhibits

### 2\. Risk/Opportunity Analysis

*   Automatic risk detection per clause with **cross-clause awareness**
*   Contract-type specific analysis:
    *   **PSA**: Closing escape risks, deposit traps, survival periods
    *   **Lease**: Rent escalation, tenant indemnity, access rights
    *   **Easement**: Perpetual grants, expansion rights, relocation
    *   **Development Agreement**: Completion deadlines, approval standards
*   Conceptual document mapping
*   Severity classification (critical, high, medium, low, info)

### 3\. Collaborative Review Interface

*   **Document Viewer**: Rendered HTML preserving original formatting
*   **Navigation Panel**: Outline by Linear/Risk/Category, search filter, progress tracking
*   **Sidebar**: Click any clause to see:
    *   Identified risks and opportunities
    *   Related clauses from other sections
    *   Defined terms used in clause
    *   Client flags
*   **Generate Revisions**: On-demand AI-powered surgical edits via Gemini
*   **Track Changes**: Visual diff display with accept/reject workflow
*   **Flagging**: Mark items for client or attorney review

### 4\. Finalization

*   Generate Word document with track changes preserving original formatting
*   Generate transmittal email draft
*   Generate change manifest with rationale

## Technology Stack

### Frontend

*   **Framework**: Next.js 15+ (App Router, TypeScript, React Server Components)
*   **UI**: shadcn/ui (New York style) + Tailwind CSS v4
*   **State**: Zustand for global state management
*   **Styling**: Geist Sans/Mono fonts, pure white background, blue primary (#2563eb)
*   **Components**: 16 shadcn components (Button, Input, Sheet, Accordion, Dialog, Tabs, etc.)

### Backend

*   **Framework**: Flask with CORS enabled
*   **Document Processing**: python-docx for parsing and rebuilding
*   **AI Integration**:
    *   **Gemini API**: `gemini-3-flash-preview` for revision generation (cost-effective, fast)
    *   **Claude API**: For risk analysis (optional, can use Gemini fallback)
*   **Session Management**: Disk-based persistence in `app/data/sessions/`

## API Endpoints

### Session Management

*   `POST /api/intake` - Initialize session with document upload
*   `GET /api/sessions` - List all saved sessions
*   `GET /api/session/<session_id>` - Get session metadata
*   `DELETE /api/session/<session_id>` - Delete session

### Document & Analysis

*   `GET /api/document/<session_id>` - Get parsed document structure
*   `GET /api/document/<session_id>/html` - Get rendered HTML
*   `GET /api/analysis/<session_id>` - Get risk/opportunity analysis
*   `GET /api/analysis/<session_id>/progress` - Poll analysis progress

### Review Operations

*   `POST /api/revise` - Generate AI revision for a clause
*   `POST /api/accept` - Accept a revision
*   `POST /api/reject` - Reject a revision
*   `POST /api/flag` - Flag item for client review
*   `GET /api/flags/<session_id>` - Get all flags
*   `DELETE /api/flag/<session_id>/<flag_id>` - Remove flag

### Finalization

*   `POST /api/finalize` - Generate final outputs
*   `GET /api/download/<session_id>/<type>` - Download generated files (docx, manifest, transmittal)

See `app/api/routes.py` for complete API documentation.

## Design Tokens

The UI follows a clean, professional Vercel-inspired aesthetic:

*   **Background**: Pure white `oklch(1 0 0)`
*   **Primary**: Blue `#2563eb` / `oklch(0.546 0.215 264)`
*   **Borders**: Cool neutral `#e5e7eb` / `oklch(0.915 0.002 240)`
*   **Font**: Geist Sans (UI) + Geist Mono (code)
*   **Severity Colors**:
    *   Critical: Red
    *   High: Orange
    *   Medium: Yellow
    *   Low: Blue
    *   Info: Gray

## Development Status

**Current Phase**: Phase 3 (Sidebar + Risk Analysis) - In Progress

### Completed ✅

*   ✅ Phase 0: Scaffolding + Foundation (Next.js, shadcn/ui, Zustand, design tokens, build pipeline)
*   ✅ Phase 1: Core Layout + Intake (header, intake form, recent projects, new project dialog)
*   ✅ Phase 2: Document Viewer + Navigation (document viewer, navigation panel, sidebar tabs, bottom bar, 3-panel layout)

### In Progress 🚧

*   🚧 Phase 3: Sidebar + Risk Analysis (risk accordion, related clauses, definitions tab, flags tab, analysis overlay, risk highlighting)

### Upcoming 📋

*   Phase 4: Revision Bottom Sheet + Track Changes Editor
*   Phase 5: Precedent Split View
*   Phase 6: Dialogs + Finalization
*   Phase 7: Polish + Validation (keyboard shortcuts, dark mode, accessibility)
*   Phase 8: Cleanup + Cutover

See `tasks/todo.md` for detailed progress tracking.

## Migration from Vanilla JS

This project is **currently migrating from a vanilla JS frontend to Next.js + React**. The old frontend is in `app/static/` and will be archived once migration is complete. Both frontends work with the same Flask backend API.

**Why migrate?**

*   Type safety with TypeScript
*   Better developer experience with React + modern tooling
*   Component reusability with shadcn/ui
*   Improved performance with React Server Components
*   Better state management with Zustand

## Common Tasks

### Start Both Servers (Development)

```
# Terminal 1: Flask backend
python run.py

# Terminal 2: Next.js frontend
cd frontend && npm run dev
```

### Run Backend Tests

```
pytest tests/
```

### Build Frontend for Production

```
cd frontend
npm run build
npm run start
```

### Add New shadcn Component

```
cd frontend
npx shadcn@latest add <component-name>
```

## Configuration

### API Keys

The backend requires a Gemini API key. Set it via:

1.  **Environment variable**: `export GEMINI_API_KEY=your_key`
2.  **api.txt file**: `echo "your_key" > api.txt`
3.  **.env file**: `echo "GEMINI_API_KEY=your_key" > .env`

### Gemini Model Configuration

**CRITICAL**: Use only these models:

*   `gemini-3-flash-preview` (primary - fast, cost-effective)
*   `gemini-3-pro-preview` (fallback - more capable)

Do **NOT** use deprecated models like `gemini-2.0-flash`, `gemini-1.5-flash`, etc.

See `app/services/gemini_service.py` for model configuration.

## Customization

### Adding New Contract Type Skills

Edit `app/services/analysis_service.py` and add to `CONTRACT_SKILLS`:

```python
'new_type': {
    'name': 'New Contract Type',
    'risks': [
        {
            'pattern': r'regex_pattern',
            'type': 'risk_identifier',
            'severity': 'high|medium|info',
            'description': 'What this risk means'
        }
    ],
    'opportunities': [...]
}
```

### Modifying AI Prompts

*   **Revision prompts**: `app/services/gemini_service.py`
    *   `build_system_prompt()` - Overall attorney persona
    *   `build_revision_prompt()` - Per-clause revision task
*   **Analysis prompts**: `app/services/analysis_service.py`

## Troubleshooting

### Frontend can't reach Flask API

**Symptom**: API calls fail with CORS errors or 404s

**Solution**:

1.  Verify Flask is running on :5000 (`python run.py`)
2.  Check `frontend/next.config.ts` has correct rewrite rules
3.  Verify CORS is enabled in `app/server.py`

### Document parsing fails

**Symptom**: Upload succeeds but document doesn't render

**Solution**:

1.  Check `.docx` file is valid (open in Word)
2.  Check Flask logs for python-docx errors
3.  Verify file uploaded to `app/data/uploads/`

### Build errors after adding new component

**Symptom**: TypeScript errors after `shadcn add`

**Solution**:

1.  Check `frontend/components.json` paths are correct
2.  Run `npm install` to install new dependencies
3.  Restart dev server (`npm run dev`)

## Contributing

This is a personal tool for David (real estate attorney). If you're building something similar:

1.  Fork the repo
2.  Focus on the Flask API in `app/api/routes.py` - it's well-structured and documented
3.  The Next.js frontend is mid-migration - check `tasks/todo.md` for status
4.  Review `.planning/PROJECT.md` for architectural decisions

## License

Private project - not open source at this time.

## Credits

Built with:

*   [Next.js](https://nextjs.org/) - React framework
*   [shadcn/ui](https://ui.shadcn.com/) - UI component library
*   [Tailwind CSS](https://tailwindcss.com/) - Styling
*   [Flask](https://flask.palletsprojects.com/) - Python web framework
*   [Gemini API](https://ai.google.dev/) - AI-powered revision generation
*   [python-docx](https://python-docx.readthedocs.io/) - Document processing

---

**Last Updated**: February 7, 2026  
**Status**: Phase 3 (Sidebar + Risk Analysis) in progress  
**Next Milestone**: Complete sidebar functionality and risk highlighting