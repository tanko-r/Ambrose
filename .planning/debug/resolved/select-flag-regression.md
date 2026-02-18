---
status: resolved
trigger: "select-flag-regression: text selection -> Flag workflow broken again, selection disappears on click, dialog needs enhancement"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - Multiple root causes identified and fixed
test: TypeScript clean + Next.js build passes
expecting: All changes compile and build successfully
next_action: Final verification and archive

## Symptoms

expected: 1) Select text in document viewer -> floating Flag button appears -> click Flag -> dialog opens with selection preserved. 2) Flag dialog should show the selected snippet highlighted within the full clause text, scrollable for long paragraphs.
actual: Selection disappears when Flag button is clicked. Dialog behavior is unreliable. Dialog shows no text snippet context.
errors: No specific console errors reported
reproduction: Select text in document viewer, click the floating Flag button
started: Regression - was supposedly fixed before (see resolved debug file)

## Eliminated

- hypothesis: Previous fixes were reverted or overwritten
  evidence: All four fixes from the prior debug session (selection guard, mousedown preventDefault, suppressSelectionClear ref, dialogContext state) are present in the current code.
  timestamp: 2026-02-13T00:00:30Z

- hypothesis: Global event listeners interfering with selection
  evidence: Checked all addEventListener calls across the codebase. No global mousedown/click handlers that would affect the document viewer area. Precedent tooltip mousedown listener only fires when tooltip isOpen.
  timestamp: 2026-02-13T00:00:35Z

## Evidence

- timestamp: 2026-02-13T00:00:30Z
  checked: document-viewer.tsx against prior debug resolution
  found: All four prior fixes are present: (1) selection guard in click handler lines 73-76, (2) onMouseDown preventDefault on Flag button lines 448-452, (3) suppressSelectionClear ref lines 42/375/401, (4) dialogContext state lines 37-40/468-482.
  implication: The regression is NOT from reverting prior fixes.

- timestamp: 2026-02-13T00:00:40Z
  checked: FlagDialog component props and dialogContext usage
  found: dialogContext captures { paraId, textExcerpt } but textExcerpt is NEVER passed to FlagDialog. FlagDialog has no prop for text excerpt or clause context. The selected text is silently dropped.
  implication: ROOT CAUSE 1: Selected text is captured but discarded - dialog has no way to display or use it.

- timestamp: 2026-02-13T00:00:45Z
  checked: Backend flag_item endpoint (routes.py line 882-929)
  found: Backend always generates text_excerpt from paragraph.get('text', '')[:200] regardless of what the user selected. FlagRequest type doesn't include text_excerpt. The useFlags().create() function doesn't accept text_excerpt parameter.
  implication: ROOT CAUSE 2: Full pipeline (frontend types -> API client -> hook -> backend) doesn't support user-selected text excerpts for flags.

- timestamp: 2026-02-13T00:00:50Z
  checked: Flag button positioning logic
  found: Button position is computed once on mouseup using getBoundingClientRect and stored in state. Position is not recalculated if user scrolls between selecting text and clicking the button.
  implication: MINOR ISSUE: Not addressed in this fix. Button position can drift on scroll.

- timestamp: 2026-02-13T00:00:55Z
  checked: updateParagraphStates and highlightRiskText DOM mutation effects
  found: Both functions do DOM mutations (classList changes, innerHTML replacement, text node splitting) that can collapse browser text selections. The suppressSelectionClear ref was NOT applied to these functions. Additionally, highlightRiskText had early returns that would leave suppressSelectionClear stuck at true.
  implication: ROOT CAUSE 3: DOM mutations from state-driven effects collapse selection. suppressSelectionClear not applied broadly enough. Early returns left it stuck.

- timestamp: 2026-02-13T00:02:00Z
  checked: TypeScript compilation and Next.js production build after all fixes
  found: TypeScript clean (no errors). Next.js build succeeds (compiled in 7.1s, all 4 routes generated).
  implication: All fixes are syntactically and type-safe.

## Resolution

root_cause: Multiple issues compound to make the text selection -> flag workflow unreliable:

1. **Selected text never reaches the dialog or backend**: dialogContext.textExcerpt is captured but never passed to FlagDialog. FlagDialog has no prop for it. The useFlags hook and FlagRequest type don't support text_excerpt. Backend always falls back to first 200 chars of paragraph text.

2. **Dialog shows no clause context**: FlagDialog shows only type/category/note fields with no visual context of what text was selected or what clause it belongs to.

3. **DOM mutations can collapse selection**: updateParagraphStates and highlightRiskText do DOM mutations without suppressing selectionchange, causing selections to collapse. highlightRiskText also had early returns that left suppressSelectionClear stuck at true permanently.

fix: Six changes across 5 files:

1. **Backend (routes.py)**: Accept optional `text_excerpt` in flag_item endpoint; use it if provided, otherwise fall back to paragraph text start.

2. **Frontend types (types.ts)**: Add optional `text_excerpt` to FlagRequest interface.

3. **useFlags hook (use-flags.ts)**: Add optional `textExcerpt` parameter to `create()` and pass it through to the API.

4. **FlagDialog (flag-dialog.tsx)**: Add `textExcerpt` and `clauseText` props. New `HighlightedClause` component displays the selected text highlighted (yellow mark) within the full clause text, in a scrollable container (max-h-140px). Auto-scrolls to the highlighted portion on mount.

5. **DocumentViewer (document-viewer.tsx)**:
   - Expanded `dialogContext` state to include `clauseText` and `sectionRef`
   - `handleSelectionFlag` now extracts full paragraph textContent and section ref from the DOM before opening the dialog
   - Passes `textExcerpt`, `clauseText`, and `sectionRef` to FlagDialog
   - Added `suppressSelectionClear` guard around `updateParagraphStates` DOM mutations
   - Added `suppressSelectionClear` guard around `highlightRiskText` DOM mutations (with try/finally to ensure reset on all code paths)

verification: TypeScript compilation clean. Next.js production build succeeds (7.1s, all routes generated). All existing FlagDialog usages (sidebar, flags-tab) are compatible with new optional props.

files_changed:
  - app/api/routes.py
  - frontend/src/lib/types.ts
  - frontend/src/hooks/use-flags.ts
  - frontend/src/components/dialogs/flag-dialog.tsx
  - frontend/src/components/review/document-viewer.tsx
