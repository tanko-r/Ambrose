---
created: 2026-02-10T17:15:55.560Z
title: Stop clause generation button for revisions
area: ui
files:
  - frontend/src/components/review/bottom-bar.tsx
  - frontend/src/components/review/revision-sheet.tsx
  - frontend/src/lib/store.ts
  - app/api/routes.py
---

## Problem

When user clicks "Generate Revisions" or "Regenerate" button to get revised language for a clause, the generation process runs to completion with no way to cancel mid-operation. If generation is slow or user changes their mind, they need a way to stop it without waiting for all revisions to finish.

## Solution

Add a "Stop" button that appears while generatingRevision is true:
1. Button appears in RevisionSheet or BottomBar during generation
2. User can click to cancel the running revision generation
3. Calls backend endpoint to cancel the revision task
4. Updates store state (generatingRevision = false, clears partial revisions)
5. Returns to normal state so user can modify document or request new generation

Implementation approach:
- Add cancel endpoint in routes.py for revision cancellation
- Add stopRevisionGeneration method in store
- Add stop button in RevisionSheet (near the "Generate Revisions" button area)
- Handle cleanup: cancel API request, reset generatingRevision flag, preserve any already-generated content
