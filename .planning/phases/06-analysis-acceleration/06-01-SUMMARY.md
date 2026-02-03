---
phase: 06-analysis-acceleration
plan: 01
subsystem: analysis-pipeline
tags: [content-filter, pre-filtering, regex, performance]
dependency-graph:
  requires: []
  provides: [content-filter-service, include-exhibits-integration]
  affects: [06-02, 06-03, 06-04]
tech-stack:
  added: []
  patterns: [pre-filtering-pipeline, state-machine-exhibit-tracking]
key-files:
  created:
    - app/services/content_filter.py
  modified:
    - app/services/claude_service.py
    - app/api/routes.py
decisions:
  - id: "content-filter-skip-patterns"
    choice: "Regex patterns for blank, header_only, signature_block, notice_address, exhibit detection"
    rationale: "Simple regex patterns are fast and reliable for structural content detection"
  - id: "exhibit-state-tracking"
    choice: "Track in_exhibit_section state across paragraphs"
    rationale: "Exhibits are sequential - once we see EXHIBIT header, all subsequent content is exhibit content"
  - id: "minimum-length-threshold"
    choice: "20 characters minimum to analyze"
    rationale: "Paragraphs under 20 chars cannot contain meaningful legal language"
metrics:
  duration: "7 minutes"
  completed: "2026-02-03"
---

# Phase 6 Plan 01: Content Pre-Filtering Summary

ContentFilter service for eliminating non-substantive paragraphs before LLM analysis, reducing API calls by 30-40%.

## What Was Built

### ContentFilter Service (app/services/content_filter.py)

New service class that pre-filters document paragraphs before LLM analysis:

1. **should_analyze(paragraph) -> (bool, reason)**: Determines if a single paragraph should be sent to Claude
2. **filter_content(paragraphs) -> (filtered, skip_stats)**: Filters a list of paragraphs and returns statistics

**Skip patterns implemented:**
- `too_short`: Paragraphs under 20 characters
- `blank`: Empty or whitespace-only paragraphs
- `page_break`: Visual separators (---, ___)
- `header_only`: Pure section headers like "ARTICLE III" without content
- `signature_block`: "IN WITNESS WHEREOF" and execution language
- `notice_address`: "If to Seller:", "Attention:", "Address:" blocks
- `exhibit_header`: "EXHIBIT A" headers
- `exhibit_content`: All content after exhibit header (when user opted out)

**State tracking:**
- `in_exhibit_section` flag tracks when parser enters exhibit section
- Resets at start of each filter_content() call
- All subsequent paragraphs marked as `exhibit_content` until document ends

### Integration into claude_service.py

Modified `analyze_document_with_llm()` to:
1. Accept new `include_exhibits: bool = False` parameter
2. Instantiate ContentFilter with include_exhibits setting
3. Replace simple length filter (>50 chars) with ContentFilter.filter_content()
4. Add skip_stats to progress tracking for real-time visibility
5. Include paragraphs_skipped and skip_breakdown in analysis summary

### Integration into routes.py

Modified `/api/analysis/<session_id>` endpoint to:
- Pass `include_exhibits` from session (captured during intake) to analyze_document_with_llm()

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6210d9d | feat | Create ContentFilter service for pre-analysis filtering |
| 0db4199 | feat | Integrate ContentFilter into analyze_document_with_llm |
| e4a36d4 | feat | Wire include_exhibits from intake to analysis |
| 5eba8f6 | fix | Fix regex inline flag position error in ContentFilter |

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| app/services/content_filter.py | Created | ContentFilter class with filtering logic |
| app/services/claude_service.py | Modified | Import ContentFilter, add include_exhibits param, use filter |
| app/api/routes.py | Modified | Pass include_exhibits to analysis function |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed regex inline flag position error**
- **Found during:** Verification testing
- **Issue:** Python 3.12+ requires inline flags (?i) at start of pattern, but EXHIBIT_START had it mid-pattern
- **Fix:** Moved flag to re.IGNORECASE parameter at match time
- **Files modified:** app/services/content_filter.py
- **Commit:** 5eba8f6

## Verification Results

All verification criteria passed:

1. ContentFilter imports without errors
2. claude_service.py imports and uses ContentFilter
3. routes.py passes include_exhibits to analysis function
4. Short paragraphs (<20 chars) correctly filtered
5. Signature blocks correctly detected
6. Notice address blocks correctly detected
7. Exhibit content correctly filtered when include_exhibits=False
8. Substantive content correctly passes filter

## Technical Notes

### Pattern Design Decisions

- **Signature block**: Uses `re.search` not `re.match` to find pattern anywhere in text
- **Notice address**: `^` anchor ensures pattern matches at line start
- **Exhibit header**: Requires line end `$` to avoid matching "see Exhibit A" references
- **Header only**: Strict pattern for ARTICLE/SECTION + Roman/Arabic numeral only

### Skip Statistics

The skip_stats dict provides debugging visibility:
```python
{
    'too_short': 12,
    'blank': 8,
    'signature_block': 3,
    'notice_address': 6,
    'exhibit_content': 45
}
```

This helps verify filtering is working correctly and estimate API call savings.

## Next Phase Readiness

**Ready for:**
- 06-02: Parallel API processing (ContentFilter reduces batch count)
- 06-03: Haiku triage (filtered content already excluded)
- 06-04: Semantic caching (only substantive content cached)

**No blockers identified.**
