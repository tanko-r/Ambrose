---
created: 2026-02-10T14:47:36.977Z
title: Improve navigator panel discoverability
area: ui
files:
  - frontend/src/components/review/navigation-panel.tsx:254-270
  - frontend/src/components/review/navigation-panel.tsx:131-251
---

## Problem

The left-side Navigator panel (clause outline with Linear/By Risk/By Category modes) has a "Hide" button in its header, but users report they can't find it. The button blends into the header — it's a small ghost-variant button with muted text. When hidden, the panel enters "ghost mode" (slides in on hover from a tiny left-edge trigger tab), but users don't know this mode exists because they never discover the hide toggle.

Key issues:
- The "Hide" button is styled as `text-muted-foreground` ghost variant — low contrast
- No keyboard shortcut to toggle the panel
- The ghost mode trigger tab (left edge) is only visible on hover and very narrow
- No onboarding hint or tooltip explaining ghost mode

## Solution

Consider one or more of:
1. **Keyboard shortcut** (e.g., `Ctrl+\` or `Ctrl+B`) to toggle `navPanelOpen` — most discoverable for power users
2. **More prominent hide button** — use outline variant or add a visible border/background
3. **Toggle in the top Header bar** — a persistent panel toggle icon visible regardless of panel state
4. **First-time tooltip** — show a brief "Hover left edge to peek" message after first hide
