# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Runner:**
- `pytest` (inferred from test file organization and import pattern)
- Config: Not explicitly configured; uses pytest defaults

**Assertion Library:**
- `assert` statements (Python built-in); no third-party assertion library

**Run Commands:**
```bash
pytest                      # Run all tests
pytest -v                   # Verbose output
pytest tests/test_*.py      # Run specific test file
pytest -k test_prompt       # Run tests matching pattern
```

Note: No test runner configured in `pytest.ini`, `setup.cfg`, or `pyproject.toml`. Tests located in `tests/` directory.

## Test File Organization

**Location:**
- Co-located in separate `tests/` directory (not alongside source code)
- Path: `/c/Users/david/Documents/claude-redlining/tests/`

**Naming:**
- Test modules: `test_*.py` (e.g., `test_claude_service.py`)
- Test functions: `test_*` (e.g., `test_prompt_includes_concept_extraction`)
- Test classes: Not used (functions preferred)

**Structure:**
```
tests/
├── __init__.py
└── test_claude_service.py
```

## Test Structure

**Test Organization Pattern (`tests/test_claude_service.py`):**

```python
import pytest
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.claude_service import build_risk_analysis_prompt

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

- **Setup:** Path addition at module level to allow imports from project root
- **Assertion:** Simple `assert` statements with conditions checked
- **Docstrings:** Single-line descriptions of what the test validates
- **No teardown:** No cleanup needed for pure function tests
- **No fixtures:** Tests use direct function calls with hardcoded parameters

## Test Types

**Unit Tests:**
- Scope: Test individual functions in isolation
- Current coverage: Claude service prompt building functions
- Pattern: Call function → assert output properties
- Example: `test_prompt_includes_risk_relationships()` validates that LLM prompt contains relationship mapping instructions

**Example Unit Test Structure (`test_claude_service.py`):**
```python
def test_prompt_output_format_includes_relationships():
    """Test that the output format section includes relationship fields."""
    prompt = build_risk_analysis_prompt(
        contract_type='development',
        representation='developer',
        aggressiveness=5
    )

    # Check that output format mentions the relationship fields
    assert '"mitigated_by"' in prompt or 'mitigated_by' in prompt
    assert '"amplified_by"' in prompt or 'amplified_by' in prompt
    assert '"triggers"' in prompt or 'triggers' in prompt
```

**Integration Tests:**
- Not found in codebase; could test API endpoints with Flask test client
- Would test session management, document parsing, analysis workflows
- Likely candidates: `/tests/test_routes.py`, `/tests/test_end_to_end.py`

**E2E Tests:**
- Not currently implemented
- Would test full workflow: intake → analysis → revision → finalization
- Would require mock or test documents

## Test Coverage

**Current Coverage:**
- Only `test_claude_service.py` exists
- 5 test functions covering prompt generation
- Focus: Validates that risk analysis prompt includes required sections

**Coverage Areas:**
1. Concept map extraction instructions present
2. Risk relationship instructions (mitigated_by, amplified_by, triggers)
3. All concept map categories included
4. Risk relationship examples provided
5. Output format section complete

**Gaps:**
- No tests for API endpoints (`app/api/routes.py`)
- No tests for document parsing (`app/services/document_service.py`)
- No tests for Gemini redline generation (`app/services/gemini_service.py`)
- No tests for model classes (`ConceptMap`, `RiskMap`)
- No tests for analysis service fallback logic (`app/services/analysis_service.py`)
- No integration tests for full workflow
- No tests for error handling paths

**High-Priority Test Areas:**
1. Session management (`get_session`, `save_session`) in `app/api/routes.py` - critical for data persistence
2. Contract type detection (`detect_contract_type`) in `app/api/routes.py` - impacts prompt selection
3. Risk parsing from LLM response (`parse_risk_response`) in `claude_service.py` - handles JSON extraction
4. Document parsing (`parse_document`) in `document_service.py` - handles .docx format conversion
5. Concept map and risk map construction in models - core data structures

## Testing Approach

**Philosophy (inferred):**
- Lightweight testing of prompt construction (pure functions)
- Avoid mocking external APIs (Anthropic, Gemini) in tests
- Test deterministic behavior (prompt presence, output format)

**Assertions Used:**
- Membership checks: `assert 'CONCEPT MAP' in prompt`
- Multiple conditions: `assert 'CONCEPT MAP' in prompt or 'concept map' in prompt.lower()`
- Case-insensitive checking: `.lower()` for flexible string matching

## Recommended Test Patterns

**For New Tests (align with existing patterns):**

**Unit Test Template:**
```python
def test_function_behavior():
    """One-line description of what is tested."""
    # Arrange
    input_data = {'key': 'value'}

    # Act
    result = function_to_test(input_data)

    # Assert
    assert result.get('expected_field') is not None
    assert 'expected_string' in str(result)
```

**For Async/API Tests (if needed):**
```python
def test_api_endpoint(self):
    """Test API response structure."""
    with app.test_client() as client:
        response = client.post('/api/intake', data={...})
        assert response.status_code == 200
        assert 'session_id' in response.get_json()
```

**For Mocking External Calls (pattern):**
```python
from unittest.mock import patch

def test_with_mock_api():
    """Test function that calls external API."""
    with patch('anthropic.Anthropic') as mock_client:
        mock_client.return_value.messages.create.return_value = mock_response
        result = analyze_clauses_with_claude(...)
        assert result['risks'] == expected_risks
```

## Known Test Gaps

| Component | Gap | Priority | Why Test |
|-----------|-----|----------|----------|
| `parse_document()` | No tests | High | Fundamental to doc processing; format-specific edge cases |
| `analyze_clauses_with_claude()` | No tests (calls external API) | Medium | Would need mocking; test JSON parsing logic separately |
| `generate_revision()` | No tests | High | Redline generation is core feature; edge cases in diff generation |
| Session management | No tests | High | In-memory + disk persistence; data loss risk |
| `ConceptMap`, `RiskMap` | No tests | Medium | Object construction, serialization (to_dict, from_dict) |
| Error handling paths | No tests | High | API fallback logic untested; graceful degradation unclear |
| Contract type detection | No tests | Medium | Impacts prompt selection and analysis approach |

---

*Testing analysis: 2026-02-01*
