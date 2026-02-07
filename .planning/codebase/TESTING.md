# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Runner:**
- pytest (implicitly used; test file imports `pytest`)
- Config file: Not found (no `pytest.ini`, `setup.cfg`, or `pyproject.toml`)
- Tests located in: `tests/` directory at project root

**Assertion Library:**
- Python `assert` statements (standard library)
- Custom assertions may use simple comparisons: `assert 'CONCEPT MAP' in prompt`

**Run Commands:**
```bash
pytest tests/                      # Run all tests
pytest tests/test_claude_service.py  # Run specific test file
pytest tests/ -v                   # Verbose mode
pytest tests/ --tb=short           # Short traceback format
```

## Test File Organization

**Location:**
- Co-located in separate `tests/` directory
- Parallel structure to `app/` (not src-based layout)
- One test file per major service module

**Naming:**
- `test_<service>.py` pattern: `test_claude_service.py`
- Individual test functions: `test_<functionality>()`
- Example: `test_prompt_includes_concept_extraction()`

**Structure:**
```
claude-redlining/
├── tests/
│   ├── __init__.py
│   └── test_claude_service.py
└── app/
    ├── services/
    │   └── claude_service.py
    └── ...
```

## Test Structure

**Suite Organization:**
From `tests/test_claude_service.py`:
```python
import pytest
import sys
from pathlib import Path

# Setup: Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.claude_service import build_risk_analysis_prompt

# Test functions follow
def test_prompt_includes_concept_extraction():
    """Test that the prompt includes concept map extraction instructions."""
    prompt = build_risk_analysis_prompt(
        contract_type='psa',
        representation='seller',
        aggressiveness=3
    )

    assert 'CONCEPT MAP' in prompt or 'concept map' in prompt.lower()
    assert 'liability_limitations' in prompt or 'LIABILITY LIMITATIONS' in prompt
    assert 'mitigated_by' in prompt
```

**Patterns:**
- **Setup**: Import system path modification to access app modules
- **Test naming**: `test_<what_is_tested>()` format with docstrings
- **Arrange-Act-Assert**: Call function, verify output, assert expectations
- **No explicit teardown**: Tests are stateless (analyze prompts, not state)

## Mocking

**Framework:** No mocking framework observed (no `unittest.mock` or `pytest-mock` imports)

**Patterns:**
- Tests call actual functions (`build_risk_analysis_prompt()`) without mocking dependencies
- No database calls or external API mocking
- Tests are unit-level but rely on real implementations (testing prompt output, not API calls)

**What to Mock (should be):**
- Anthropic API calls in `analyze_clauses_with_claude()` - currently not tested
- File I/O in `generate_final_output()` - currently not tested
- Flask request/response in routes - currently not tested

**What NOT to Mock:**
- Pure functions like `build_risk_analysis_prompt()` - test actual output
- Data transformation functions - test actual behavior
- Configuration loading - can test with real config files

## Fixtures and Factories

**Test Data:**
No fixtures observed in current tests. Manual test data construction:
```python
prompt = build_risk_analysis_prompt(
    contract_type='psa',
    representation='seller',
    aggressiveness=3
)
```

**Factories/Builders (not implemented but could be):**
- Could create `create_test_parsed_doc()` factory for document test data
- Could create risk/concept map builders for analysis testing
- Could create session fixtures for route testing

**Location (current):**
- Test data constructed inline in each test function
- No shared fixtures file
- No factory module

## Coverage

**Requirements:** Not enforced (no coverage threshold found)

**View Coverage:**
```bash
# If coverage.py were installed:
coverage run -m pytest tests/
coverage report
coverage html
```

**Current state:** No coverage configuration; coverage not measured

## Test Types

**Unit Tests:**
Observed in `test_claude_service.py`:
- **Scope**: Test individual function output (prompt building)
- **Approach**: Call function with known inputs, verify output contains expected sections
- **Examples**:
  - `test_prompt_includes_concept_extraction()` - Verifies prompt structure
  - `test_prompt_includes_risk_relationships()` - Verifies prompt fields
  - `test_prompt_includes_concept_map_categories()` - Verifies all categories present
  - `test_prompt_output_format_includes_relationships()` - Verifies JSON format fields

**Integration Tests:**
Not observed in current codebase. Would be needed for:
- Full document parsing and analysis pipeline
- Session creation through finalization
- Revision generation and acceptance flow

**E2E Tests:**
Not present. Manual testing appears to be primary approach (reference to "test output" in README/CLAUDE.md suggests manual verification).

## Common Patterns

**Async Testing:**
Not applicable (no async/await in codebase).

**Error Testing:**
Not observed in current tests. Should test:
- Missing API keys (fallback behavior)
- Invalid JSON responses (parsing fallback)
- File not found (error handling)

## Current Test Examples

**Test from `test_claude_service.py:12-22`:**
```python
def test_prompt_includes_concept_extraction():
    """Test that the prompt includes concept map extraction instructions."""
    prompt = build_risk_analysis_prompt(
        contract_type='psa',
        representation='seller',
        aggressiveness=3
    )

    assert 'CONCEPT MAP' in prompt or 'concept map' in prompt.lower()
    assert 'liability_limitations' in prompt or 'LIABILITY LIMITATIONS' in prompt
    assert 'mitigated_by' in prompt
```

**Pattern**: Direct string verification in prompt output. Simple but effective for prompt engineering validation.

**Test from `test_claude_service.py:37-50`:**
```python
def test_prompt_includes_concept_map_categories():
    """Test that all concept map categories are present."""
    prompt = build_risk_analysis_prompt(
        contract_type='lease',
        representation='landlord',
        aggressiveness=4
    )

    # Check for all required concept map categories
    assert 'KNOWLEDGE STANDARDS' in prompt or 'knowledge_standards' in prompt
    assert 'TERMINATION TRIGGERS' in prompt or 'termination_triggers' in prompt
    assert 'DEFAULT REMEDIES' in prompt or 'default_remedies' in prompt
    assert 'KEY DEFINED TERMS' in prompt or 'key_defined_terms' in prompt
```

**Pattern**: Parametrized checks (case-insensitive) for flexibility in prompt changes.

## Test Gaps

**Areas not tested:**
- `analyze_clauses_with_claude()` - Would require mocking Anthropic API
- Document parsing (`parse_document()`) - Would need test .docx files
- Route handlers - Would need Flask test client
- Error conditions - Missing API keys, malformed JSON responses
- Document services - File operations, track changes generation

## Running Tests

Currently only basic prompt tests exist. To expand testing:

```bash
# Run existing tests
python -m pytest tests/ -v

# Run with more verbose output
python -m pytest tests/ -vv

# Run specific test
python -m pytest tests/test_claude_service.py::test_prompt_includes_concept_extraction
```

---

*Testing analysis: 2026-02-01*
