# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- Module files use `snake_case`: `analysis_service.py`, `document_service.py`, `claude_service.py`
- Classes use `PascalCase`: `ConceptMap`, `RiskMap`, `SectionTracker`
- Private/internal modules may use leading underscore (not observed in current codebase)
- Test files follow pattern: `test_<module>.py` in `tests/` directory

**Functions:**
- All functions use `snake_case`: `detect_risks()`, `build_risk_analysis_prompt()`, `extract_section_number()`
- Helper functions typically kept internal to modules or classes
- Functions clearly named for their purpose: verb + noun pattern (`extract_*`, `detect_*`, `build_*`, `generate_*`, `analyze_*`)

**Variables:**
- Local variables use `snake_case`: `para_id`, `contract_type`, `representation`, `aggressiveness`
- Constants use `UPPER_SNAKE_CASE`: `VALID_CATEGORIES`, `CONTRACT_SKILLS`, `UNIVERSAL_RISKS`, `HAS_ANTHROPIC`, `HAS_REDLINES`
- Dictionary keys use `snake_case`: `para_id`, `section_ref`, `risk_inventory`, `concept_map`
- Boolean flags prefixed with `is_` or `has_`: `is_heading`, `has_anthropic`, `is_opportunity`, `include_exhibits`

**Types:**
- Type hints used throughout: `Dict[str, Any]`, `List[Dict]`, `Optional[str]`, `Callable`
- Union types sometimes used: `Optional[X]` for nullable values
- Generic types for collections: `Dict`, `List`, `Set`

## Code Style

**Formatting:**
- Line length: Not explicitly limited but generally under 120 characters
- Indentation: 4 spaces (Python standard)
- No visible linting/formatting tools configured (no `.eslintrc`, `.prettierrc`, `pyproject.toml` found)

**Linting:**
- No formal linting configuration present
- Code follows PEP 8 conventions implicitly

## Import Organization

**Order:**
1. Standard library imports: `os`, `sys`, `json`, `re`, `time`, `threading`, `from pathlib import Path`, `from typing import *`, `from datetime import datetime`, `from collections import defaultdict`
2. Third-party imports: `from flask import *`, `from docx import *`, `from anthropic import *`
3. Local imports: `from app.* import *`

**Path Aliases:**
- No path aliases observed; imports use relative and absolute paths from `app/` root
- Project uses `sys.path.insert(0, str(project_root))` pattern in entry points (`run.py`, `server.py`) to add project to path

## Error Handling

**Patterns:**
- Try/except blocks used for external service calls and file operations: `try/except anthropic.APIError`, `try/except ImportError`
- Fallback strategies implemented: Claude analysis falls back to regex-based analysis in `routes.py:365-388`
- Non-fatal errors logged but don't halt execution (e.g., precedent parsing failure in `routes.py:149-154`)
- Exceptions wrapped with context: `RuntimeError(f"Claude API error: {str(e)}")`
- Progress tracking uses thread-safe locking: `with progress_lock:` in `claude_service.py:24-43`

**Common error contexts:**
- Missing API keys: Checked in `get_anthropic_api_key()` with multiple fallback paths
- File I/O: Wrapped with proper exception handling
- LLM API calls: Catch `anthropic.APIError` specifically
- JSON parsing: `json.JSONDecodeError` caught silently with fallback return value in `parse_risk_response()`

## Logging

**Framework:** `print()` statements for user-facing output; no dedicated logging library imported.

**Patterns:**
- Progress updates use `update_progress(session_id, data)` for real-time tracking
- Server startup messages formatted with ASCII art boxes
- Error messages written to stdout with context
- Example: `print(f"Error analyzing batch {batch_num}: {e}")` in `claude_service.py:581`

## Comments

**When to Comment:**
- Module-level docstrings explain purpose of entire file (all service files have them)
- Function docstrings document parameters and return types using triple-quoted format
- Complex logic commented inline, especially regex patterns and section extraction
- Example docstring format in `analysis_service.py` and `claude_service.py`

**JSDoc/TSDoc:**
- Not applicable (Python project, not TypeScript/JavaScript)
- Uses Python docstring convention: triple-quoted strings immediately after function/class definition
- Docstrings follow implicit format: brief description, then detailed explanation with parameter types

**Docstring Example** (from `analysis_service.py:320-329`):
```python
def detect_risks(
    parsed_doc: Dict,
    contract_type: str,
    representation: str
) -> List[Dict]:
    """
    Detect all risks in the document.

    Returns list of risk objects with location and severity.
    """
```

## Function Design

**Size:** Functions are generally 20-100 lines; larger orchestration functions in routes may exceed 100 lines.

**Parameters:**
- Functions accept typed parameters with defaults where appropriate
- Large parameter lists use intermediate data structures (dicts) rather than many positional args
- Example: `analyze_document_with_llm()` accepts parsed_doc, contract_type, representation, aggressiveness, batch_size, session_id

**Return Values:**
- Functions return structured dicts for complex data (risk objects, analysis results)
- Return types annotated: `-> Dict`, `-> List[Dict]`, `-> Optional[str]`
- Empty/null cases return empty collections: `return []`, `return {}` rather than `None` in many cases
- Example in `detect_opportunities()`: Returns list of opportunity dicts

## Module Design

**Exports:**
- No explicit `__all__` declarations observed
- Modules export all public functions and classes; private helpers use descriptive names
- Entry points explicitly imported: `from app.services.analysis_service import analyze_document`

**Barrel Files:**
- `app/__init__.py` is minimal (imports shown in routes)
- `app/services/__init__.py` is empty (explicit imports used instead)
- `app/models/__init__.py` contains: `from .concept_map import ConceptMap` and `from .risk_map import RiskMap`

**Class Organization:**
- Classes store state in `__init__()`: `ConceptMap.__init__()` initializes `self.concepts`
- Methods provide getters/serializers: `to_dict()`, `from_dict()`, `to_prompt_format()`
- Example pattern in `ConceptMap` (concept_map.py): Single responsibility, focused on concept storage/retrieval

## Type Hints

**Usage:**
- Consistently applied in function signatures: `def detect_risks(parsed_doc: Dict, contract_type: str, representation: str) -> List[Dict]:`
- Dictionary and List types use generic parameters: `Dict[str, Any]`, `List[Dict]`
- Optional types for nullable values: `Optional[Dict]`, `Optional[str]`
- No strict type checking tools (mypy) configured; hints are advisory

## Dictionary Structure Patterns

**Paragraph data structure** (appears throughout):
```python
{
    'id': 'p_123',
    'text': 'clause text',
    'type': 'paragraph',
    'section_ref': '1.2.3',
    'section_number': '1.2.3',
    'section_hierarchy': [],
    'caption': 'Section Title',
    'style_info': {}
}
```

**Risk object structure** (risk_inventory):
```python
{
    'risk_id': 'R1',
    'para_id': 'p_123',
    'type': 'uncapped_liability',
    'severity': 'high|medium|info',
    'title': 'Brief risk title',
    'description': 'Detailed explanation',
    'problematic_text': 'exact quote',
    'category': 'liability|timing|etc',
    'mitigated_by': [],
    'amplified_by': [],
    'triggers': [],
    'location': 'section ref'
}
```

**Analysis result structure**:
```python
{
    'analysis_date': ISO string,
    'contract_type': str,
    'representation': str,
    'aggressiveness': int 1-5,
    'risk_inventory': [],
    'risk_by_paragraph': {},
    'concept_map': {},
    'opportunities': [],
    'summary': {}
}
```

## Shared Constants

**Party types**:
- `seller`, `buyer`, `landlord`, `tenant`, `lender`, `borrower`, `grantor`, `grantee`, `developer`
- Defined in `get_party_terms()` in `analysis_service.py:385-398`

**Contract types**:
- `psa`, `lease`, `easement`, `development`, `loan`, `general`
- Stored in `CONTRACT_SKILLS` dict in `analysis_service.py:24-221`

**Severity levels**:
- `high`, `medium`, `info`
- Used consistently across risk objects

**Aggressiveness scale**:
- `1` through `5` (conservative to aggressive)
- Used to control analysis depth in prompts (`claude_service.py:114-120`)

---

*Convention analysis: 2026-02-01*
