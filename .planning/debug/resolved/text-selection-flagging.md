---
status: resolved
trigger: "text selection flagging unreliable - selection disappears on first try, Flag button only appears after selecting again, clicking Flag doesn't reliably open dialog"
created: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - Three interacting bugs in event handler chain
test: TypeScript compilation + Next.js production build
expecting: Clean build with all fixes applied
next_action: Complete

## Symptoms

expected: Select text -> floating Flag button appears immediately -> click it -> Flag Dialog opens
actual: Selection disappears on first attempt. Flag button only shows after selecting again. Clicking Flag button doesn't reliably open the dialog.
errors: No console errors reported
reproduction: Select text in document viewer, observe behavior
started: Unknown - feature may have always been buggy

## Eliminated

## Evidence

- timestamp: 2026-02-10T12:01:00Z
  checked: document-viewer.tsx lines 36-51 - paragraph click handlers
  found: Every [data-para-id] element has a click handler via addEventListener that calls selectParagraph(paraId). The click event fires on mouseup (after selection completes). When user finishes selecting text, the click event ALSO fires, calling selectParagraph(). This triggers state update -> DOM mutations -> selection collapses.
  implication: BUG 1 - Paragraph click handler fires on every mouseup, including text selection. Primary cause of "selection disappears on first try."

- timestamp: 2026-02-10T12:02:00Z
  checked: document-viewer.tsx lines 280-340 - mouseup and selectionchange handlers
  found: Event sequence: mouseup -> click(sync, selectParagraph) -> state update -> DOM mutation -> selection collapses -> selectionchange fires -> setSelectionContext(null). The requestAnimationFrame in mouseup handler runs AFTER all this, but by then selection is gone.
  implication: BUG 1 confirmed via event ordering analysis.

- timestamp: 2026-02-10T12:03:00Z
  checked: document-viewer.tsx lines 379-391 - floating Flag button
  found: mousedown on button -> browser collapses text selection -> selectionchange fires -> setSelectionContext(null) -> button disappears from DOM before click fires.
  implication: BUG 2 - mousedown on Flag button removes it before click event completes.

- timestamp: 2026-02-10T12:04:00Z
  checked: document-viewer.tsx line 347 - handleSelectionFlag and line 395 - FlagDialog conditional
  found: FlagDialog conditionally rendered on selectionContext truthy. handleSelectionFlag calls removeAllRanges() which triggers selectionchange -> setSelectionContext(null) -> FlagDialog unmounts.
  implication: BUG 3 - Dialog mount/unmount coupled to selection state that gets cleared during dialog open.

- timestamp: 2026-02-10T12:10:00Z
  checked: Build verification
  found: TypeScript compilation clean. Next.js production build succeeds (compiled in 5.3s, all routes generated).
  implication: All fixes are syntactically and type-safe.

## Resolution

root_cause: Three interacting bugs in the text selection flagging event chain:

**BUG 1 (Selection disappears on first try):** Paragraph click handlers (addEventListener("click")) fire on every mouseup, including text selection completion. selectParagraph() triggers Zustand state update -> updateParagraphStates effect -> DOM mutations (classList changes, potentially innerHTML replacement) -> browser collapses selection -> selectionchange fires -> setSelectionContext(null).

**BUG 2 (Clicking Flag button doesn't work):** mousedown on the floating Flag button causes browser to collapse text selection (default behavior). selectionchange listener fires -> setSelectionContext(null) -> button disappears from DOM -> click event never reaches the handler.

**BUG 3 (Dialog doesn't open even if click fires):** FlagDialog is conditionally rendered on `selectionContext` being truthy. handleSelectionFlag calls removeAllRanges() which triggers selectionchange -> setSelectionContext(null) -> FlagDialog unmounts. Dialog open state becomes irrelevant because its parent conditional evaluates to false.

fix: Four targeted changes in document-viewer.tsx:

1. **BUG 1 fix:** Added selection guard in paragraph click handler - if text is selected (non-collapsed, non-empty), skip selectParagraph(). This prevents DOM mutations from destroying the selection.

2. **BUG 2 fix (primary):** Added `onMouseDown={(e) => e.preventDefault()}` to the floating Flag button. This prevents the browser default of collapsing the text selection when clicking the button, ensuring the click event fires normally.

3. **BUG 2 fix (defense-in-depth):** Added `suppressSelectionClear` ref guard. When handleSelectionFlag runs, it sets suppressSelectionClear=true before clearing the selection, preventing the selectionchange listener from racing to null out context.

4. **BUG 3 fix:** Introduced separate `dialogContext` state that persists the paraId/textExcerpt independently of `selectionContext`. FlagDialog now renders based on `dialogContext` (not `selectionContext`), so it survives selection clearing. handleSelectionFlag saves to dialogContext before clearing selectionContext.

verification: TypeScript clean, Next.js production build passes (5.3s compile, all routes generated)
files_changed:
  - frontend/src/components/review/document-viewer.tsx
