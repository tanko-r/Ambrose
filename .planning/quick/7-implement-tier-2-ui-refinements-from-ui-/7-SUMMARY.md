---
phase: 7-tier2-ui-refinements
plan: 01
subsystem: frontend-ui
tags:
  - ui-polish
  - accessibility
  - tooltips
  - keyboard-nav
  - transmittal
  - finalization
dependency_graph:
  requires: []
  provides:
    - tooltip-system
    - keyboard-accessibility
    - transmittal-polish
    - connector-routing
  affects:
    - frontend/src/components/review/bottom-bar.tsx
    - frontend/src/components/review/sidebar.tsx
    - frontend/src/components/review/document-viewer.tsx
    - frontend/src/components/dialogs/transmittal-dialog.tsx
    - frontend/src/components/dialogs/finalize-dialog.tsx
    - frontend/src/hooks/use-keyboard-shortcuts.ts
    - frontend/src/hooks/use-document.ts
    - frontend/src/app/globals.css
    - app/api/routes.py
tech_stack:
  added: []
  patterns:
    - shadcn/ui Tooltip component with TooltipProvider
    - ARIA tablist with roving tabindex pattern
    - Word-boundary-aware text truncation
    - Quadratic bezier curves for near-horizontal connector lines
key_files:
  created: []
  modified:
    - frontend/src/components/review/bottom-bar.tsx: "Filter pills with tooltips, filtered nav counter, severity badge overflow fix, compact mode enhancements"
    - frontend/src/components/review/sidebar.tsx: "Arrow key tab navigation with roving tabindex"
    - frontend/src/components/review/document-viewer.tsx: "Enter/Space paragraph activation"
    - frontend/src/hooks/use-keyboard-shortcuts.ts: "Escape closes sidebar in priority chain"
    - frontend/src/components/keyboard-help.tsx: "Updated shortcuts documentation"
    - frontend/src/components/dialogs/transmittal-dialog.tsx: "Editable subject line via Input"
    - frontend/src/components/dialogs/finalize-dialog.tsx: "Word-boundary revision truncation"
    - frontend/src/hooks/use-document.ts: "Hydrate session status from backend"
    - frontend/src/lib/types.ts: "Added status field to DocumentResponse"
    - frontend/src/app/globals.css: "Enhanced compact mode CSS (fonts, icons, header height)"
    - frontend/src/lib/utils/connector.ts: "Improved connector routing with arc for near-horizontal cases"
    - app/api/routes.py: "Plain text headers, empty flag fallback, word-boundary truncation, status field in response"
decisions:
  - "Use shadcn Tooltip with TooltipProvider wrapper for all tooltips"
  - "Implement ARIA tablist arrow key navigation (Left/Right/Up/Down/Home/End)"
  - "Use roving tabindex pattern (active tab=0, others=-1) for keyboard navigation"
  - "Filtered nav counter uses union of active filters (showRisks OR showRevisions OR showFlags)"
  - "Compact mode visibly reduces font sizes (14px document, 9px tabs), icon sizes (14px), and header height (2.75rem)"
  - "Transmittal subject line editable via Input component (not read-only text)"
  - "Strip markdown headers from transmittal body (use plain text 'KEY REVISIONS MADE' format)"
  - "Empty flag notes fallback priority: note > text_excerpt > 'Flagged for review'"
  - "Word-boundary truncation keeps at least 60% of max length before cutting"
  - "Near-horizontal connectors (deltaY < 40px) use quadratic bezier arc above text"
  - "Session status hydrated from backend on document load for finalized banner persistence"
metrics:
  duration_seconds: 769
  completed_at: "2026-02-16T05:53:09Z"
  tasks_completed: 4
  files_modified: 12
  commits: 4
  build_status: passing
---

# Quick Task 7: Implement Tier 2 UI Refinements

**One-liner:** Tooltips, keyboard accessibility (Escape/Enter/Space/Arrow keys), transmittal polish (editable subject, no markdown, fallback text, word-boundary truncation), finalized banner persistence, and connector line routing improvements.

## Objective

Implement all 14 Tier 2 UI refinements across the contract review interface to polish the review experience with tooltips, keyboard accessibility, transmittal fixes, and visual improvements.

## Context

These refinements address polish gaps identified after the core UI migration to Next.js. They improve discoverability (tooltips), keyboard navigation (ARIA patterns), transmittal quality (editable subject, clean formatting), and visual consistency (compact mode enhancements, connector routing).

## Tasks Executed

### Task 1: Tooltips, nav counter fix, badge overflow, compact mode enhancement

**Files:** `bottom-bar.tsx`, `globals.css`

**Changes:**
- Added shadcn `Tooltip` components to filter pills with descriptive text ("Filter to paragraphs with risks/revisions/flags")
- Added tooltips to disabled Finalize/Transmittal buttons explaining why they're disabled
- Added "Filter:" label prefix before filter pills group
- Fixed navigation counter to reflect active filters via `filteredParaIds` memo (union of showRisks, showRevisions, showFlags)
- Added `max-w-[200px] flex-wrap` to severity badges container to prevent overflow at wide viewports
- Enhanced compact mode CSS: document font 0.875rem, tab text 9px, icons 14px, header 2.75rem
- Added `shrink-0` to filter pills container

**Commit:** `b862771`

**Verification:**
- ✓ Build passes
- ✓ Tooltip content matches ARIA descriptions
- ✓ Nav counter updates when filters toggle
- ✓ Compact mode shows visible difference

---

### Task 2: Keyboard accessibility — Escape sidebar, Enter/Space paragraphs, arrow key tabs

**Files:** `use-keyboard-shortcuts.ts`, `sidebar.tsx`, `document-viewer.tsx`, `keyboard-help.tsx`

**Changes:**
- Extended Escape handler priority chain: bottom sheet > **sidebar** > nav panel
- Added `handleContainerKeyDown` in document-viewer to activate paragraphs with Enter/Space
- Implemented ARIA tablist navigation in sidebar: ArrowLeft/Right/Up/Down (wrap), Home, End
- Added roving tabindex pattern: `tabIndex={activeTab === tab.value ? 0 : -1}`
- Focus management: new tab button receives focus after arrow key navigation
- Updated keyboard help: "Close Active Panel or Dismiss" for Escape, new "Document" section with "Activate Paragraph" (Enter or Space)

**Commit:** `be798e4`

**Verification:**
- ✓ Build passes
- ✓ Escape closes sidebar when bottom sheet is closed
- ✓ Enter/Space on paragraph elements activates them
- ✓ Arrow keys navigate sidebar tabs per ARIA authoring practices
- ✓ Only active tab in tab order (roving tabindex works)

---

### Task 3: Transmittal fixes, revision truncation, finalized banner persistence

**Files:** `transmittal-dialog.tsx`, `finalize-dialog.tsx`, `use-document.ts`, `types.ts`, `routes.py`

**Changes:**

**Frontend:**
- Replaced read-only subject display with `Input` component (editable)
- Applied word-boundary truncation in finalize-dialog: `rev.rationale.lastIndexOf(' ', 80)`
- Hydrated `status` field in `use-document.ts` from backend response
- Added `status?: string | null` to `DocumentResponse` type

**Backend (routes.py):**
- Added `truncate_at_word(text, max_len=100)` helper function (keeps 60%+ of max length, adds '...')
- Changed markdown headers to plain text:
  - `"## Key Revisions Made"` → `"KEY REVISIONS MADE\n---"`
  - `"## Items for Your Review"` → `"ITEMS FOR YOUR REVIEW\n---"`
- Fixed empty flag notes: `note = flag.get('note', '') or flag.get('text_excerpt', '') or 'Flagged for review'`
- Applied `truncate_at_word(rationale)` to revision summaries
- Added `'status': session.get('status')` to `get_document` response

**Commit:** `412c9fc`

**Verification:**
- ✓ Build passes
- ✓ Subject line is editable Input
- ✓ No markdown syntax in transmittal body
- ✓ Empty flag notes show text_excerpt or fallback
- ✓ Revision truncation respects word boundaries
- ✓ Status field hydrated on document load

---

### Task 4: Connector line visual verification and improvement

**Files:** `connector.ts`

**Changes:**
- Detect near-horizontal cases: `if (deltaY < 40)`
- Use quadratic bezier with arc above text: `Q ${midX} ${arcY}, ${endX} ${endY}` where `arcY = startY - 25`
- Keep existing S-curve (cubic bezier) for vertical displacement cases
- SVG layer already has `pointer-events: none` (verified in globals.css line 296)

**Commit:** `003fd42`

**Verification:**
- ✓ Build passes
- ✓ Connector routing improved for near-horizontal flag highlights
- ✓ Arc prevents line from cutting through text
- ✓ SVG doesn't block interaction

---

## Deviations from Plan

**None** — plan executed exactly as written. All 14 refinement items addressed:

1. ✓ Filter pill tooltips
2. ✓ Missing tooltips on other controls (disabled buttons)
3. ✓ Navigation counter updates with filters
4. ✓ Escape closes sidebar
5. ✓ Enter/Space activates paragraphs
6. ✓ Arrow keys navigate sidebar tabs
7. ✓ Status badges don't overflow
8. ✓ Transmittal subject editable
9. ✓ No markdown in transmittal
10. ✓ Empty flag notes fallback
11. ✓ Revision word-boundary truncation
12. ✓ Compact mode more noticeable
13. ✓ Finalized banner persisted
14. ✓ Connector line routing improved

## Commits

| Hash    | Message                                                                 |
| ------- | ----------------------------------------------------------------------- |
| b862771 | feat(quick-7): add tooltips, filter nav counter, compact mode enhancements |
| be798e4 | feat(quick-7): keyboard accessibility improvements                      |
| 412c9fc | feat(quick-7): transmittal fixes, revision truncation, finalized banner persistence |
| 003fd42 | feat(quick-7): improve connector line routing to avoid text            |

## Self-Check: PASSED

**Created files:** None (all modifications)

**Modified files verified:**
- ✓ `frontend/src/components/review/bottom-bar.tsx` exists
- ✓ `frontend/src/components/review/sidebar.tsx` exists
- ✓ `frontend/src/components/review/document-viewer.tsx` exists
- ✓ `frontend/src/hooks/use-keyboard-shortcuts.ts` exists
- ✓ `frontend/src/components/keyboard-help.tsx` exists
- ✓ `frontend/src/components/dialogs/transmittal-dialog.tsx` exists
- ✓ `frontend/src/components/dialogs/finalize-dialog.tsx` exists
- ✓ `frontend/src/hooks/use-document.ts` exists
- ✓ `frontend/src/lib/types.ts` exists
- ✓ `frontend/src/app/globals.css` exists
- ✓ `frontend/src/lib/utils/connector.ts` exists
- ✓ `app/api/routes.py` exists

**Commits verified:**
- ✓ `b862771` exists in git log
- ✓ `be798e4` exists in git log
- ✓ `412c9fc` exists in git log
- ✓ `003fd42` exists in git log

## Success Criteria

✓ All 14 refinement items implemented
✓ Build passes with no errors
✓ Each item is visually or functionally verifiable per its description
✓ Tooltips provide clear, descriptive guidance
✓ Keyboard shortcuts follow ARIA authoring practices
✓ Transmittal email is professional and readable
✓ Finalized banner persists across page reloads
✓ Connector lines route cleanly without crossing text
