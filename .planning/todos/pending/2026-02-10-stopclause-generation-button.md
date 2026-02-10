---
created: 2026-02-10T17:15:55.560Z
title: Add stopclause generation button
area: ui
files:
  - frontend/src/components/analysis/analysis-overlay.tsx
  - frontend/src/lib/store.ts
  - app/api/routes.py
---

## Problem

During the analysis phase, users need a way to stop or cancel clause generation if it's taking too long or if they want to switch documents/cancel the operation. Currently there's no UI affordance to abort the analysis in progress.

## Solution

Add a "Stop" or "Cancel" button in the AnalysisOverlay that:
1. Calls a backend endpoint to cancel the analysis task
2. Updates store state (generatingAnalysis = false, current clause/progress reset)
3. Provides clear user feedback that analysis was cancelled
4. Allows user to restart or switch to different document

Implementation approach:
- Add cancel endpoint in routes.py (or wire existing cancel mechanism)
- Add stopAnalysis method in store
- Add cancel/stop button in AnalysisOverlay next to progress indicators
- Handle cleanup: cancel API request, reset state, clear partial results
