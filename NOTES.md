# Contract Redlining Project - Notes & Ideas

## Issues to Fix

- [x] 1. Risk analysis is too blunt/deterministic (regex-based) - switch to LLM (Claude Opus 4.5) ✓ DONE
- [x] 2. Risk information lacks detail - no highlighting of specific problematic words/phrases in focused clause; needs LLM-based analysis output in UI ✓ DONE (hover/click highlighting)
- [ ] 3. MS Word automatic numbering does not appear in document rendering - MUST be preserved
- [x] 4. Revision in sidebar should show track changes style (red strikethrough deletions, blue underline insertions) ✓ DONE
- [ ] 5. Should show brief descriptive offer to revise problematic language; if multiple approaches, present 2+ options for user to select before calling redline agent. Agent needs full clause + related definitions/interconnecting clauses but instructed to revise only focused clause
- [x] 6. Rationale producing API key error - verify api.txt is being read correctly for Gemini calls ✓ FIXED (restored api.txt to root)
- [ ] 7. Loading overlay elapsed time is not actually counting seconds (remaining time estimate is OK not to count down)

## Features to Add

- [x] Add UI features to indicate model thinking, including legal-themed spinner verbs and thought previews
- [ ] Implement diff-match-patch for high-quality inline redline diffs

## Ideas / Future Enhancements

-

## Session Notes

### 2026-01-28
- Switched risk analysis from regex-based to Claude Opus 4.5 LLM
- Added document map for cross-referencing related clauses
- Working on UI improvements for risk display and track changes
- Refactored index.html into modular CSS/JS files (12 JS modules)
- Added hover/click highlighting for problematic text in document body
- Cleaned up project folder structure (moved old files to "Other Files/")

---
*Use `/note` to quickly add entries to this file*
