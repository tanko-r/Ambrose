---
status: testing
phase: v1-all-features
source: ROADMAP.md success criteria
started: 2026-02-02T10:30:00Z
updated: 2026-02-02T10:30:00Z
---

## Current Test

status: COMPLETE
completed: 2026-02-02

## Tests

### 1. Finalize Redline - Modal Opens
expected: Click "Finalize Redline" button → Modal appears listing accepted revisions
result: pass

### 2. Finalize Redline - Track Changes Download
expected: Click download track changes → .docx file downloads, opens in Word with insertions/deletions visible
result: issue
reported: "revised text does not respect formatting - entire paragraph underlined when only first word was, indentation shifted right, formatting applied uniformly instead of per-run"
severity: major

### 3. Finalize Redline - Clean Download
expected: Click download clean version → .docx file downloads showing final text without markup
result: pass
note: same formatting issue as test 2 (see #27)

### 4. Generate Transmittal - Email Opens
expected: Click "Generate Transmittal" → Modal shows email preview with Copy and Create Email buttons
result: pass
note: "Enhanced with modal preview per user request (commit 990243e)"

### 5. Generate Transmittal - Content
expected: Email body contains summary of revisions made and any client-flagged paragraphs
result: pass

### 6. Compare Precedent - Panel Opens
expected: Click "Compare Precedent" in sidebar → Panel slides in showing precedent document
result: issue
reported: |
  Multiple UX issues:
  1. Panel overlays instead of pushing main doc left
  2. Need precedent navigator on right side (like target doc navigator)
  3. Should auto-jump to first match when opening
  4. Should highlight matching clauses in precedent navigator
  5. Clause matching quality is "iffy" - needs better concept-based matching
  6. User should be able to modify clause correlations
severity: major

### 7. Compare Precedent - Navigation
expected: Panel has table of contents, clicking sections scrolls to that content
result: skipped
reason: blocked by test 6 issues (see #30)

### 8. Compare Precedent - Related Clauses
expected: When viewing a paragraph, related precedent clauses are highlighted (yellow)
result: skipped
reason: blocked by test 6 issues (see #30)

### 9. Compare Precedent - Copy Text
expected: Can select and copy text from precedent panel
result: skipped
reason: blocked by test 6 issues (see #30)

### 10. New Project - Dialog Appears
expected: Click "New Project" in menu → Confirmation dialog with Save/Discard/Cancel
result: pass
note: Dashboard redesign added per user request

### 11. New Project - Save Works
expected: Click Save → Session persists, appears in Recent Projects on intake form
result: pass
note: Fixed duplicate New Document/New Project buttons to use same flow

### 12. New Project - Fresh Intake
expected: After Save or Discard → UI returns to fresh intake form
result: pass
note: Dashboard redesigned with better layout and visual hierarchy

### 13. Recent Projects - List Shows
expected: Intake form shows Recent Projects section with saved sessions
result: pass
note: Dashboard expanded to full width with detailed project info

### 14. Recent Projects - Load Works
expected: Click a recent project → Session loads with all data restored
result: pass

## Summary

total: 14
passed: 9
issues: 2
pending: 0
skipped: 3

## Gaps

- truth: "Track changes download preserves original formatting per-run"
  status: failed
  reason: "User reported: revised text does not respect formatting - entire paragraph underlined when only first word was, indentation shifted right"
  severity: major
  test: 2
  github: "#27"

- truth: "Compare Precedent panel provides effective side-by-side comparison"
  status: failed
  reason: "Multiple UX issues: overlay instead of push layout, no precedent navigator, no auto-jump to first match, no highlighted matches, poor clause matching, no user modification of correlations"
  severity: major
  test: 6
  github: "#30"
