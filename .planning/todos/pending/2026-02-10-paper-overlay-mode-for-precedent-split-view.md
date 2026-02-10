---
created: 2026-02-10T21:36:04.361Z
title: Paper overlay mode for precedent split view
area: ui
files:
  - frontend/src/components/review/split-layout.tsx
  - frontend/src/components/review/precedent-panel.tsx
  - frontend/src/components/review/precedent-content.tsx
---

## Problem

When viewing precedent alongside the target document in the split view, the resizable panes split available width, which can cause both panels to be too narrow — reflowing formatted content and making side-by-side comparison harder. Users want to see each document at full width without losing the ability to compare.

## Solution

Add a "paper overlay" mode to the precedent split view:

- Each pane can be "stacked" on top of the other (like papers on a desk) instead of side-by-side
- Both panes render at full container width, preserving original formatting without reflow
- User clicks/toggles to switch which pane is on top (target vs precedent)
- Clicking brings the back pane to front, or a toggle button switches the visible document
- Could use slight offset/shadow to hint at the stacked paper metaphor
- Should coexist with the existing resizable split mode as an alternative layout option

This addresses the common complaint that narrow split panes break document formatting, especially for complex legal documents with tables, indentation, and numbering.
