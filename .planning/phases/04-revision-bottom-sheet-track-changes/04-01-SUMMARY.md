---
phase: 04
plan: 01
subsystem: revision-infrastructure
tags: [drawer, track-changes, contenteditable, dom-utilities, zustand, hooks]
depends_on:
  requires: [phase-3]
  provides: [track-changes-utils, revision-lifecycle-hook, drawer-component, revision-css]
  affects: [04-02, 04-03]
tech-stack:
  added: [vaul]
  patterns: [imperative-dom-island, store-driven-lifecycle-hook]
key-files:
  created:
    - frontend/src/lib/track-changes.ts
    - frontend/src/hooks/use-revision.ts
    - frontend/src/components/ui/drawer.tsx
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/lib/store.ts
    - frontend/src/app/globals.css
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - id: vaul-drawer
    decision: Use shadcn Drawer (Vaul) for bottom sheet
    rationale: Official shadcn component with snap points, drag gestures, non-modal support
  - id: pure-dom-track-changes
    decision: Track-changes utils are pure DOM functions, no React dependencies
    rationale: ContentEditable must be managed imperatively to avoid cursor jump issues
  - id: store-generating-state
    decision: generatingRevision in store rather than hook-local state
    rationale: Multiple components may need to read loading state (sidebar button, bottom sheet)
  - id: editedHtml-in-revision-type
    decision: Added editedHtml field to Revision type
    rationale: Persists user inline edits across paragraph switches per research recommendation
metrics:
  duration: ~9 minutes
  completed: 2026-02-08
---

# Phase 4 Plan 01: Revision Infrastructure Summary

**One-liner:** shadcn Drawer installed, track-changes DOM utils ported from revision.js, useRevision lifecycle hook created, store/types/CSS extended for revision workflow.

## What Was Done

### Task 1: Install Drawer + Create track-changes.ts + Extend Store + Add CSS
- Installed shadcn Drawer component (vaul dependency) via `npx shadcn@latest add drawer`
- Created `frontend/src/lib/track-changes.ts` with 6 exported pure DOM manipulation functions ported from `app/static/js/revision.js`:
  - `extractFinalText` — walks child nodes, skips deletions, concatenates visible text
  - `wrapRangeAsDeleted` — wraps selection in user-deletion span (or truly deletes user-additions)
  - `insertUserText` — inserts text in user-addition span with cursor management
  - `selectCharacterBefore` / `selectCharacterAfter` — selection helpers that skip user-deletion spans
  - `getPreviousNode` — utility for adjacent span detection
- Extended `Revision` type with `editedHtml?: string` field
- Extended Zustand store with `generatingRevision: boolean` (UI state) and `revisionSheetParaId: string | null` (Review state) plus their setters
- Added track-changes CSS classes to globals.css: `.revision-diff`, `.diff-del`, `.diff-ins`, `.user-addition`, `.user-deletion` with Word-style visual treatment

### Task 2: Create useRevision Lifecycle Hook
- Created `frontend/src/hooks/use-revision.ts` with full revision lifecycle:
  - `generate(paraId, riskIds, includeRelatedIds?, customInstruction?)` — calls POST /api/revise, stores result, opens bottom sheet
  - `accept(paraId, editorElement?)` — persists inline edits from editor DOM, calls POST /api/accept, logs affected_para_ids
  - `reject(paraId)` — calls POST /api/reject, removes revision from store, closes bottom sheet
  - `reopen(paraId)` — synchronous, marks revision as not accepted while preserving editedHtml
  - `generating` — reactive boolean for loading state
- All callbacks use `useAppStore.getState()` inside to avoid stale closures
- Toast notifications via sonner for all operations

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install Drawer + track-changes utils + store/CSS | 3a0f8c4 | track-changes.ts, drawer.tsx, store.ts, types.ts, globals.css |
| 2 | useRevision lifecycle hook | 4b5d9f2 | use-revision.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- `npm run build` completes successfully (compiled in 11.0s)
- All 6 track-changes functions exported and importable
- Store extensions verified (generatingRevision, revisionSheetParaId)
- CSS classes verified in globals.css
- Drawer component installed with all expected exports

## Next Phase Readiness

Plan 02 (components) can now:
- Import `Drawer`, `DrawerContent`, etc. from `@/components/ui/drawer`
- Import track-changes utilities from `@/lib/track-changes`
- Import `useRevision` hook from `@/hooks/use-revision`
- Use track-changes CSS classes (`.revision-diff`, `.diff-del`, `.diff-ins`, `.user-addition`, `.user-deletion`)
- Read `generatingRevision` and `revisionSheetParaId` from store

## Self-Check: PASSED
