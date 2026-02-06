# Collaborative Contract Review App

A Flask-based webapp for interactive contract review with AI-powered redlining.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set your Gemini API key (one of these methods):
# Option 1: Environment variable
export GEMINI_API_KEY=your_key_here

# Option 2: Create api.txt file with your key
echo "your_key_here" > api.txt

# Option 3: Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# Run the app
python run.py
```

Then open http://localhost:5000 in your browser.

## Features

### Intake Phase
- Upload target contract (.docx)
- Optionally upload precedent/preferred form
- Configure representation (seller, buyer, etc.)
- Set aggressiveness level (1-5)
- Choose review approach (quick-sale, competitive-bid, relationship, adversarial)

### Analysis Phase
- Automatic risk detection per clause
- Opportunity identification
- Conceptual document mapping
- Contract-type specific analysis (PSA, Lease, Easement, Development Agreement)

### Collaborative Review
- Click any clause to see analysis in sidebar
- View identified risks and opportunities
- Generate AI-powered revisions via Gemini
- Accept/reject revisions
- Flag items for client review
- See rationale and AI reasoning

### Finalization
- Generate Word document with accepted revisions
- Generate transmittal email draft
- Generate change manifest

## Project Structure

```
app/
├── server.py           # Flask app and main entry point
├── api/
│   └── routes.py       # All API endpoints
├── services/
│   ├── document_service.py   # Document parsing and rebuilding
│   ├── analysis_service.py   # Risk/opportunity detection
│   └── gemini_service.py     # Gemini API integration
├── static/
│   └── index.html      # Frontend webapp (vanilla JS)
└── data/               # Session data, uploads, feedback
```

## API Endpoints

- `POST /api/intake` - Initialize session with document
- `GET /api/document/<session_id>` - Get parsed document
- `GET /api/analysis/<session_id>` - Get risk analysis
- `POST /api/revise` - Generate revision for a clause
- `POST /api/accept` - Accept a revision
- `POST /api/reject` - Reject a revision
- `POST /api/flag` - Flag item for client review
- `POST /api/finalize` - Generate final outputs
- `GET /api/download/<session_id>/<type>` - Download generated files

## Contract Type Skills

The app has built-in knowledge for:
- **PSA** (Purchase and Sale Agreement) - closing escape risks, deposit traps, survival periods
- **Lease** - rent escalation, tenant indemnity, access rights
- **Easement** - perpetual grants, expansion rights, relocation
- **Development Agreement** - completion deadlines, approval standards

## Customization

### Adding New Contract Skills

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

### Modifying Prompts

Edit `app/services/gemini_service.py`:
- `build_system_prompt()` - Overall attorney persona
- `build_revision_prompt()` - Per-clause revision task
