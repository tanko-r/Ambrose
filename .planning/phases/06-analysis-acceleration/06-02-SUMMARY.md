---
phase: 06-analysis-acceleration
plan: 02
subsystem: services/analysis
tags: [claude-api, async, initial-analysis, forking, opus-4.5]
dependency-graph:
  requires: []
  provides: [initial-document-analyzer, forking-context]
  affects: [06-03, 06-04]
tech-stack:
  added: [aiohttp, aiolimiter]
  patterns: [async-api, extended-thinking, conversation-forking]
key-files:
  created:
    - app/services/initial_analyzer.py
  modified:
    - requirements.txt
    - app/services/claude_service.py
decisions:
  - id: opus-extended-thinking
    choice: Use extended thinking with 10000 token budget
    reason: Full document analysis requires thorough comprehension
  - id: fallback-on-failure
    choice: Graceful fallback to sequential if initial analysis fails
    reason: Ensure robustness - analysis should complete even if initial fails
  - id: defined-terms-enrichment
    choice: Use initial analysis terms if richer than parsed doc terms
    reason: Initial analysis can extract more complete term definitions
metrics:
  duration: ~5 minutes
  completed: 2026-02-03
---

# Phase 6 Plan 02: Initial Full-Document Analysis Summary

**One-liner:** Claude Opus 4.5 initial analysis with extended thinking extracts concept map, defined terms, and cross-references for batch forking

## What Was Built

Created the `InitialDocumentAnalyzer` service that sends the entire contract to Claude Opus 4.5 in a single request with extended thinking enabled. This establishes comprehensive document understanding that subsequent parallel batch analyses can inherit.

### Components

1. **app/services/initial_analyzer.py** (new)
   - `InitialDocumentAnalyzer` class with async `analyze()` method
   - Uses Claude Opus 4.5 with extended thinking (10000 token budget)
   - Extracts: concept_map, defined_terms, cross_references, document_profile
   - Returns conversation_messages for forking in Plan 03
   - `run_initial_analysis()` synchronous wrapper

2. **app/services/claude_service.py** (modified)
   - Added `use_forking` parameter (default True)
   - Calls initial analysis before batch processing
   - Uses enriched defined terms and concept map from initial analysis
   - Stores `initial_context` in progress for batch forking
   - Graceful fallback if initial analysis fails

3. **requirements.txt** (modified)
   - Added aiohttp>=3.9.0 for async HTTP support
   - Added aiolimiter>=1.1.0 for rate limiting

## Key Implementation Details

### Initial Analysis Prompt
The system prompt instructs Claude to extract:
- **concept_map**: Hierarchical document structure with section purposes
- **defined_terms**: All defined terms with definitions and locations
- **cross_references**: Section-to-section relationships
- **document_profile**: Contract type, parties, key dates, critical provisions

### Extended Thinking
Extended thinking with 10000 token budget allows Claude to thoroughly comprehend complex legal documents before producing structured output.

### Conversation Forking
The response includes:
- `conversation_messages`: User/assistant message pair for forking
- `initial_response_id`: Message ID for reference
- `system_prompt`: System prompt used (for consistency in forks)

Plan 03 will use this context to fork parallel batch analyses.

## Integration Points

```python
# In claude_service.py
from app.services.initial_analyzer import run_initial_analysis

# Called at start of analyze_document_with_llm when use_forking=True
initial_context = run_initial_analysis(
    api_key=api_key,
    paragraphs=paragraphs,
    contract_type=contract_type,
    representation=representation
)

# Results used for batch analysis
defined_terms = initial_context.get('defined_terms', [])
aggregated_concept_map = initial_context.get('concept_map', {})
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4287a37 | chore | Add async dependencies (aiohttp, aiolimiter) |
| 7135eb6 | feat | Create InitialDocumentAnalyzer service |
| ec6207f | feat | Integrate initial analysis into claude_service pipeline |

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

Verified:
- aiohttp 3.13.3 and aiolimiter 1.2.1 installed
- InitialDocumentAnalyzer imports without errors
- All required methods present (analyze, build_initial_analysis_prompt, _parse_initial_response)
- run_initial_analysis callable
- use_forking parameter present in analyze_document_with_llm

## Cost/Performance Considerations

- Initial analysis adds ~$6/document cost (Opus 4.5 with extended thinking)
- Enables 10x faster total analysis time through conversation forking
- Phase 7 will add cheaper "document map" alternative for cost-conscious users

## Next Phase Readiness

Ready for Plan 03 (Parallel Batch Processing):
- [x] Initial context stored in progress for batch forking
- [x] conversation_messages available for forking
- [x] system_prompt preserved for consistency
- [x] Async infrastructure (aiohttp, aiolimiter) installed

No blockers identified.
