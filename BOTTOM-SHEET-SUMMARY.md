# Bottom Sheet Bug Fix - Work Summary & Next Steps

**Session:** giggly-zooming-lightning  
**Date:** February 7, 2026  
**Project:** Claude Redlining Frontend

## Overview

This document summarizes the completion of **Phase 04: Revision Bottom Sheet + Track Changes**, which implements a bottom sheet (drawer) UI for displaying and editing legal document revisions with Word-style track changes (red strikethrough deletions, blue underlined additions).

---

## Critical Bug: Modal Overlay Blocking Bottom Sheet

### Problem Description

During implementation, a **critical bug** was discovered where the app became unresponsive when attempting to open the bottom sheet:

**Symptoms:**

*   App appeared frozen/unresponsive when trying to open the revision bottom sheet
*   A modal overlay appeared on screen but the bottom sheet drawer itself didn't become visible or interactive
*   Users couldn't interact with the bottom sheet content
*   Initially suspected to be an infinite loop, but was actually a modal configuration issue

**Root Cause:**  
The shadcn Drawer component (built on Vaul) defaults to modal behavior, which creates a blocking overlay. When the drawer's modal mode was enabled (either explicitly or by default), it prevented the bottom sheet from properly appearing and accepting user interactions.

**The Fix:**  
Set `modal={false}` on the Drawer component in `RevisionSheet`:

```
<Drawer
  open={bottomSheetOpen}
  onOpenChange={toggleBottomSheet}
  direction="bottom"
  modal={false}  // ← Critical: prevents blocking modal overlay
  snapPoints={[0.25, 0.5, 1]}
  activeSnapPoint={activeSnapPoint}
  setActiveSnapPoint={setActiveSnapPoint}
>
```

**Why This Works:**

*   `modal={false}` creates a **non-modal drawer** that doesn't block the rest of the UI
*   Users can interact with the sidebar and document while the bottom sheet is open
*   The drawer properly renders and accepts interactions
*   No blocking overlay prevents the drawer from appearing

### Debug Evidence

Extensive console logging was added to `use-revision.ts` to diagnose the state synchronization:

```javascript
console.log("[generate] API done. bottomSheetOpen:", store.bottomSheetOpen);
console.log("[generate] setRevision done");
console.log("[generate] setRevisionSheetParaId done");
const freshOpen = useAppStore.getState().bottomSheetOpen;
console.log("[generate] re-read bottomSheetOpen:", freshOpen);
if (!freshOpen) {
  store.toggleBottomSheet();
  console.log("[generate] toggled. now:", useAppStore.getState().bottomSheetOpen);
}
```

This defensive logging helped identify that the state was changing correctly but the UI wasn't responding due to the modal overlay issue.

---

## Work Completed

### Phase 04-01: Infrastructure & Store Setup ✅

**Status:** COMPLETE (2026-02-07)

Created the foundational Zustand store and React hooks for managing the revision workflow:

**Files Created:**

*   `frontend/src/store/use-store.ts` - Zustand store with revision state management
*   `frontend/src/hooks/use-revision.ts` - Hook for generate/accept/reject/reopen lifecycle

**Key Store Actions:**

*   `toggleBottomSheet()` - Open/close revision sheet
*   `setRevisionSheetParaId(paraId)` - Set which paragraph's revision to display
*   `setRevisions(revisions)` - Update revision data from API
*   Generation, acceptance, rejection, and reopening of revisions

**Architecture Decision:**

*   Multiple components may need to read loading state → Use shared Zustand store (vs local state)
*   Revision data structure: `revisions[paraId] = { generated_text, rationale, accepted, editedHtml }`

---

### Phase 04-02: Revision UI Components ✅

**Status:** COMPLETE (2026-02-07)  
**Duration:** ~6 minutes

Built three interconnected components for the bottom sheet UI:

#### 1\. **TrackChangesEditor** (`track-changes-editor.tsx`, 172 lines)

Imperative contentEditable wrapper that React does NOT reconcile:

**Features:**

*   `useEffect` on `[diffHtml]` sets innerHTML and resets undo/redo stacks
*   `useEffect` on `[readOnly]` toggles contentEditable attribute
*   `beforeinput` handler intercepts text insertions to create `user-addition` spans (blue underline)
*   `keydown` handler intercepts Backspace/Delete to create `user-deletion` spans (red strikethrough)
*   Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y undo/redo via innerHTML snapshot stacks (50-entry cap)
*   Imports track-changes utilities: `wrapRangeAsDeleted`, `insertUserText`, `selectCharacterBefore`, `selectCharacterAfter`
*   **Zero use of** `**dangerouslySetInnerHTML**` — all HTML management is imperative via refs

**Why Imperative?**  
React must not reconcile the contentEditable subtree. User additions/deletions are tracked via custom spans, and React reconciliation would destroy those markers and reset the cursor position.

#### 2\. **RevisionActions** (`revision-actions.tsx`, 65 lines)

Button bar for accepting/rejecting revisions:

**States:**

*   **Accepted:** Green checkmark + "Accepted" label + "Reopen" button
*   **Not Accepted:** "Accept" (primary) + "Reset" (outline, only if modified) + "Reject" (destructive)

**Icons Used:** Check, X, RotateCcw, RotateCw (lucide-react)

#### 3\. **RevisionSheet** (`revision-sheet.tsx`, 175 lines)

Main bottom sheet component using shadcn Drawer:

**Features:**

*   Drawer with `direction="bottom"` and `modal={false}` (sidebar/document remain interactive)
*   Snap points: `[0.25, 0.5, 1]` with default active at 50% viewport height
*   Responsive snap fractions (Vaul converts to pixels)
*   Reads from store: `bottomSheetOpen`, `revisions`, `revisionSheetParaId`, `paragraphs`
*   Uses `useRevision()` hook for accept/reject/reopen
*   Tracks `isModified` state locally, resets when `diffHtml` changes
*   **Edit Persistence:** When switching paragraphs or closing, persists edited HTML to store
*   Header displays section reference + paragraph excerpt (first 60 chars)
*   Integrates TrackChangesEditor with ref passed from parent
*   Displays rationale in violet gradient blockquote
*   Empty state: "No revision to display"
*   Wired revision actions to hook methods with editor ref for accept operation

**Commits:**

| Task | Commit | Files |
| --- | --- | --- |
| TrackChangesEditor | 52c5b5a | track-changes-editor.tsx |
| RevisionActions + RevisionSheet | 39fe5da | revision-actions.tsx, revision-sheet.tsx |

**Verification Passed:**

*   ✅ `npx tsc --noEmit` - zero TypeScript errors
*   ✅ `npm run build` - 10.0s compile, no errors
*   ✅ contentEditable div present with handlers
*   ✅ No dangerouslySetInnerHTML usage
*   ✅ Drawer import and TrackChangesEditor integration confirmed
*   ✅ RevisionActions exports and state-based rendering working

---

### Phase 04-03: Wiring & End-to-End Workflow (PENDING)

**Status:** PLANNED (not yet executed)

This phase wires all components together for the complete user workflow:

#### Task 1: Wire Sidebar Generate Button + Risk Inclusion

**Files to Modify:**

*   `frontend/src/components/review/risk-accordion.tsx`
*   `frontend/src/components/review/sidebar.tsx`

**Changes:**

*   Expose included risk IDs from RiskAccordion via ref-based callback
*   Wire "Generate Revision" button to `useRevision().generate(riskIds)`
*   Show "View Revision" button if paragraph already has a revision
*   Display "Generating..." loading state during API call
*   Only included (toggled-on) risks sent to API

#### Task 2: Add RevisionSheet to Page + Auto-Open + BottomBar Visibility

**Files to Modify:**

*   `frontend/src/app/review/[sessionId]/page.tsx`
*   `frontend/src/components/review/bottom-bar.tsx`
*   `frontend/src/components/review/document-viewer.tsx`

**Changes:**

*   Import and render `<RevisionSheet />` in review page layout
*   Hide BottomBar when `bottomSheetOpen === true`
*   Auto-open bottom sheet when clicking paragraph with existing revision
*   When clicking paragraph without revision, update sheet's paraId but don't auto-close
*   Maintain paragraph styling: `has-revision` and `revision-accepted` classes

#### Manual Verification (Required)

The plan includes a blocking human-verify checkpoint:

1.  Start both servers (Flask :5000, Next.js :3000)
2.  Navigate to review session with populated risks
3.  Click "Generate Revision" in sidebar footer
4.  Verify:
    *   Bottom sheet slides up from bottom
    *   Deleted text appears red with strikethrough
    *   Inserted text appears blue with underline
    *   Rationale displays in violet-bordered block
5.  Test inline editing: type text (blue), delete text (red strikethrough)
6.  Test Ctrl+Z undo functionality
7.  Click "Accept" → verify accepted state with Reopen button
8.  Verify paragraph shows green-tinted background (`revision-accepted` class)
9.  Test "Reject" → verify sheet closes and styling removed
10.  Navigate to accepted paragraph → verify bottom sheet auto-opens

---

## Architecture & Design Decisions

| Decision | Rationale |
| --- | --- |
| **Imperative contentEditable** | React reconciliation would destroy track-changes markers and reset cursor |
| **Snap point fractions** | Responsive across viewport sizes; Vaul handles fraction-to-pixel conversion |
| **Non-modal Drawer (**`**modal={false}**`**)** | **CRITICAL:** Prevents blocking overlay that made app unresponsive. Allows sidebar & document interaction while sheet is open |
| **Edit persistence on blur** | Stores edited HTML when switching paragraphs or closing sheet |
| **useRef for editor** | Parent (RevisionSheet) needs ref to read innerHTML for persist/accept |
| **Shared Zustand store** | Multiple components (sidebar, document viewer) need to read/write revision state |

---

## Current State & Metrics

| Metric | Value |
| --- | --- |
| Phase 04-02 Duration | ~6 minutes |
| Phase 04-02 Status | ✅ Complete |
| TypeScript Errors | 0 |
| Build Status | ✅ Success (10.0s) |
| Lines of Code Added | ~412 (3 components) |
| Commits | 2 |

---

## Next Steps

### Immediate (Phase 04-03)

**Execute Task 1:** Wire sidebar button + risk inclusion flow

*   Modify `risk-accordion.tsx` to expose included risk IDs
*   Modify `sidebar.tsx` to call `useRevision().generate(riskIds)`
*   Add "View Revision" button for paragraphs with existing revisions

**Execute Task 2:** Add RevisionSheet to page layout

*   Add `<RevisionSheet />` to review page
*   Hide BottomBar when sheet is open
*   Add auto-open logic to document-viewer

**Human Verification:** Test complete workflow end-to-end

*   Generate revision from sidebar
*   Edit inline with track changes
*   Accept/reject/reopen
*   Verify auto-open on paragraph selection

### Medium Term

*   Handle edge cases: multiple revisions per paragraph (version history)
*   Add revision comparison view (side-by-side with original)
*   Implement revision undo history (undo last accept/reject)
*   Add revision comments/notes feature
*   Implement AI-suggested alternative revisions (multiple options)

### Notes

*   **Word Integration:** MS Word automatic numbering still needs to be preserved in rendering
*   **Loading UX:** Consider adding legal-themed loading spinner and thought previews
*   **Diff Quality:** Future enhancement: integrate diff-match-patch for higher-quality diffs

---

## Testing Checklist

*   Phase 04-02 TypeScript compilation
*   Phase 04-02 build succeeds
*   Track-changes editor renders correctly
*   RevisionSheet component imports work
*   **CRITICAL BUG FIX:** Drawer has `modal={false}` to prevent unresponsive overlay
*   Phase 04-03 sidebar button wiring
*   Phase 04-03 auto-open functionality
*   End-to-end workflow (generate → edit → accept)
*   Bottom sheet drawer snap points work
*   Bottom sheet appears and is interactive (no blocking overlay)
*   Sidebar and document remain interactive while sheet is open
*   Edit persistence across paragraph switches
*   Undo/redo functionality in editor
*   Visual styling (deletions red, additions blue)

---

## Resources

**Planning Documents:**

*   `.planning/phases/04-revision-bottom-sheet-track-changes/04-RESEARCH.md` - Detailed research on Drawer/Vaul
*   `.planning/phases/04-revision-bottom-sheet-track-changes/04-01-SUMMARY.md` - Store setup summary
*   `.planning/phases/04-revision-bottom-sheet-track-changes/04-02-SUMMARY.md` - Component implementation summary
*   `.planning/phases/04-revision-bottom-sheet-track-changes/04-03-PLAN.md` - Wiring plan (detailed task descriptions)

**Key Source Files:**

*   `frontend/src/components/review/track-changes-editor.tsx` - Imperative contentEditable wrapper
*   `frontend/src/components/review/revision-actions.tsx` - Accept/reject button bar
*   `frontend/src/components/review/revision-sheet.tsx` - Main bottom sheet component
*   `frontend/src/hooks/use-revision.ts` - Revision lifecycle hook
*   `frontend/src/store/use-store.ts` - Zustand revision state

---

**Last Updated:** 2026-02-08  
**Prepared by:** Claude Code (AI Assistant)