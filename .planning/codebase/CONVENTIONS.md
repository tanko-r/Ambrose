# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- Module files use lowercase with underscores: `claude_service.py`, `document_service.py`, `concept_map.py`
- Packages are lowercase: `api/`, `services/`, `models/`
- Test files follow pattern: `test_*.py` (e.g., `test_claude_service.py`)

**Functions:**
- Use snake_case: `build_risk_analysis_prompt()`, `analyze_clauses_with_claude()`, `get_session()`
- Verb-first pattern for action functions: `parse_document()`, `generate_revision()`, `detect_contract_type()`
- Getter/setter pattern: `get_provision()`, `add_provision()`, `to_dict()`, `from_dict()`
- Private functions use underscore prefix: `_tokenize()` in `SimpleRetriever` class

**Variables:**
- Use snake_case: `session_id`, `risk_inventory`, `parsed_doc`, `all_risks`
- Dictionary keys use snake_case: `risk_id`, `para_id`, `section_ref`, `para_id`
- Boolean flags follow `is_*` or `has_*` pattern: `is_heading`, `has_precedent`, `HAS_ANTHROPIC`
- Global state tracking uses descriptive names: `analysis_progress`, `progress_lock`, `sessions`

**Types & Classes:**
- Class names use PascalCase: `ConceptMap`, `RiskMap`, `Risk`, `SimpleRetriever`
- Dataclass fields match function parameters: `risk_id`, `base_severity`, `para_id`
- Type hints use standard typing module: `Dict[str, Any]`, `List[Dict]`, `Optional[str]`

## Code Style

**Formatting:**
- No explicit formatter configured (no .pylintrc or black config detected)
- Indentation: 4 spaces (Python standard)
- Line length: No strict limit enforced; pragmatic approach observed (~150-200 chars acceptable)
- Imports: `from pathlib import Path`, type hints used throughout

**Module-level Structure:**
```python
#!/usr/bin/env python3
"""Module docstring with purpose and key exports."""

import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional

# Global state (if needed)
analysis_progress = {}
progress_lock = threading.Lock()

# Helper functions (module-level utilities)
def helper_function():
    """Description."""
    pass

# Main classes
class MainClass:
    """Class docstring."""
    pass

# Main entry point
def main():
    """Script entry point."""
    pass

if __name__ == '__main__':
    main()
```

**Linting:**
- No explicit linting config found (no .pylintrc, .flake8, eslint)
- Imports are organized: standard library → third-party → local modules
- Follows PEP 8 conventions implicitly

## Import Organization

**Order (observed pattern):**
1. Standard library: `import os`, `import sys`, `import json`, `import re`, `import time`, `import threading`, `from pathlib import Path`, `from datetime import datetime`, `from typing import Dict, List, Any`
2. Third-party: `from flask import Flask`, `from docx import Document`, `from dotenv import load_dotenv`
3. Local modules: `from app.services.claude_service import analyze_document_with_llm`

**Path Aliases:**
- No explicit aliases configured; uses absolute imports from package root
- All imports: `from app.services.*`, `from app.models.*`, `from app.api.*`
- Project root added to path in entry points: `sys.path.insert(0, str(project_root))`

**Example from `app/api/routes.py`:**
```python
import json
import uuid
from datetime import datetime
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app, send_file

from app.services.document_service import parse_document
from app.models import ConceptMap, RiskMap
```

## Error Handling

**Patterns:**
- Graceful degradation with fallback systems
- Try-except blocks wrap external API calls (`claude_service.py`, `gemini_service.py`)
- Optional imports with feature flags: `HAS_ANTHROPIC`, `HAS_GEMINI`, `HAS_REDLINES`
- Error propagation to caller with context

**API Error Pattern (`app/api/routes.py`):**
```python
try:
    analysis = analyze_document_with_llm(
        parsed_doc=session.get('parsed_doc'),
        contract_type=session.get('contract_type', 'general'),
        ...
    )
    return jsonify(response)
except Exception as e:
    # Fallback to regex-based analysis if Claude fails
    try:
        from app.services.analysis_service import analyze_document
        analysis = analyze_document(...)
        analysis['analysis_method'] = 'regex_fallback'
        return jsonify(analysis)
    except Exception as fallback_error:
        return jsonify({'error': f'Analysis failed...'}), 500
```

**Service Layer Error Pattern (`claude_service.py`):**
```python
try:
    api_key = get_anthropic_api_key()
    if not api_key:
        raise RuntimeError("Anthropic API key not found...")
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(...)
    return parse_risk_response(response_text)
except anthropic.APIError as e:
    raise RuntimeError(f"Claude API error: {str(e)}")
except json.JSONDecodeError:
    pass  # Return empty result on parse failure
```

## Logging

**Framework:** No explicit logging configured; uses `print()` statements

**Patterns:**
- Status messages to stdout: `print(f"Error analyzing batch {batch_num}: {e}")`
- Progress updates via global state dict: `update_progress(session_id, {...})`
- Error context included: error messages include function/batch context

**Progress Tracking Pattern (`claude_service.py`):**
```python
analysis_progress = {}  # Global dict keyed by session_id
progress_lock = threading.Lock()  # Thread-safe access

def update_progress(session_id: str, data: Dict):
    """Update progress for a session."""
    with progress_lock:
        if session_id not in analysis_progress:
            analysis_progress[session_id] = {}
        analysis_progress[session_id].update(data)
        analysis_progress[session_id]['updated_at'] = time.time()
```

## Comments

**When to Comment:**
- Docstrings on all public functions and classes (comprehensive)
- Inline comments for non-obvious logic (minimal - code is generally self-documenting)
- Block comments before complex sections (e.g., "CONCEPT MAP EXTRACTION" in prompts)

**Docstring Style:**
```python
def analyze_clauses_with_claude(
    clauses: List[Dict],
    contract_type: str,
    representation: str,
    aggressiveness: int,
    defined_terms: List[str] = None,
    document_map: str = ""
) -> Dict:
    """
    Use Claude Opus 4.5 to analyze clauses for risks.

    Args:
        clauses: List of clause dicts with 'id', 'text', 'section_ref'
        contract_type: Type of contract (psa, lease, etc.)
        representation: Who we represent (seller, buyer, etc.)
        aggressiveness: 1-5 scale
        defined_terms: List of defined terms in the document
        document_map: Condensed map of all document paragraphs for cross-referencing

    Returns:
        Dict with 'risks' list and 'concept_map' dict
    """
```

**Module-level Docstrings:**
Comprehensive at file level with purpose, key features, and exports:
```python
"""
Claude Service for Intelligent Risk Analysis

Uses Claude Opus 4.5 (thinking model) to perform deep contract analysis,
identifying risks, opportunities, and providing nuanced legal insights.
"""
```

## Function Design

**Size:** Functions are focused and reasonably sized (100-300 lines typical; larger functions are orchestrators with clear responsibilities)

**Parameters:**
- Use explicit named parameters, not positional (good readability)
- Optional parameters have sensible defaults: `aggressiveness: int = 3`, `batch_size: int = 5`
- Type hints on all parameters and returns
- Use dataclasses for parameter grouping: `@dataclass class Risk:`

**Return Values:**
- Functions return typed dicts for flexibility: `Dict[str, Any]`
- Dataclass instances for complex data: `Risk`, `ConceptMap`, `RiskMap`
- Tuple returns for related values: `extract_section_number()` returns `(section_num, remaining, num_type)`
- Empty results return `{}` or `[]` consistently (not `None`)

**Example from `claude_service.py`:**
```python
def analyze_document_with_llm(
    parsed_doc: Dict,
    contract_type: str,
    representation: str,
    aggressiveness: int,
    batch_size: int = 5,
    session_id: str = None
) -> Dict:
    """Process document in batches to manage context and cost."""
    # Function body
    return {
        'analysis_date': datetime.now().isoformat(),
        'analysis_method': 'llm',
        'model': 'claude-opus-4-5-20251101',
        'risk_inventory': all_risks,
        'summary': {
            'total_risks': len(all_risks),
            'high_severity': severity_counts['high'],
        }
    }
```

## Module Design

**Exports:**
- Explicit `__all__` in `__init__.py` files: `from .concept_map import ConceptMap` in `app/models/__init__.py`
- Services expose main public functions; helpers are private or module-level
- API blueprint explicitly defined: `api_bp = Blueprint('api', __name__)`

**Barrel Files:**
Used in `app/models/__init__.py` to re-export classes:
```python
from .concept_map import ConceptMap
from .risk_map import Risk, RiskMap, normalize_severity

__all__ = ['ConceptMap', 'Risk', 'RiskMap', 'normalize_severity']
```

**Service Layer Pattern:**
Each service module exports main orchestrator function(s):
- `claude_service.py` → `analyze_document_with_llm()`, `analyze_clauses_with_claude()`
- `gemini_service.py` → `generate_revision()`
- `document_service.py` → `parse_document()`, `generate_final_output()`
- `analysis_service.py` → `analyze_document()`, `generate_suggestions()`

**API Pattern:**
Blueprint routes in `app/api/routes.py` follow Flask conventions:
```python
@api_bp.route('/analysis/<session_id>', methods=['GET'])
def get_analysis(session_id):
    """Comprehensive docstring."""
    # Implementation
    return jsonify(response)
```

## Configuration

**Environment Variables:**
- Used for API keys: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`
- Loaded via `python-dotenv`: `from dotenv import load_dotenv; load_dotenv()`
- Fallback file-based loading: checks `anthropic_api.txt`, `api.txt`, home directory keys

**Flask Configuration:**
Set in `create_app()` in `app/server.py`:
```python
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload
app.config['UPLOAD_FOLDER'] = Path(__file__).parent / 'data' / 'uploads'
app.config['SESSION_FOLDER'] = Path(__file__).parent / 'data' / 'sessions'
```

## Data Models

**JSON Structure:**
- Documents parsed to nested dict: `{'content': [{'type': 'paragraph', 'text': '...', 'id': 'p_1', ...}]}`
- Risks as dicts with consistent schema: `{'para_id': 'p_5', 'risk_type': 'unqualified_rep', 'severity': 'high', ...}`
- Session data persisted as JSON with serialization helpers: `json.dump(..., default=str)`

**Type Consistency:**
- Para IDs: string format `'p_1'`, `'p_2'`
- Severity: lowercase enum: `'high'`, `'medium'`, `'low'`, `'info'` (maps to low)
- Timestamps: ISO 8601: `datetime.now().isoformat()`
- Offsets: 0-based character positions for text locations

---

*Convention analysis: 2026-02-01*
