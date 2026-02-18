---
phase: quick-8
plan: "01"
subsystem: frontend-navigation
tags: [breadcrumb, navigation, risk-report, print, overlay]
dependency_graph:
  requires: [store.ts focusHistory/focusHistoryIndex/goBackInHistory/goForwardInHistory, risk-card.tsx SeverityBadge]
  provides: [BreadcrumbBar component, RiskReport overlay, header Export Risk Report menu item]
  affects: [review/[sessionId]/page.tsx, header.tsx, globals.css]
tech_stack:
  added: []
  patterns: [conditional rendering based on selectedParaId, section natural sort, print CSS visibility trick]
key_files:
  created:
    - frontend/src/components/review/breadcrumb-bar.tsx
    - frontend/src/components/review/risk-report.tsx
  modified:
    - frontend/src/app/review/[sessionId]/page.tsx
    - frontend/src/components/layout/header.tsx
    - frontend/src/app/globals.css
decisions:
  - Used store field `summary` (not `analysisSummary`) matching actual Zustand state shape
  - Natural sort for section numbers by splitting on "." and comparing numerically
  - Print CSS uses body visibility:hidden + risk-report-overlay visibility:visible trick to isolate report output
metrics:
  duration: ~25 minutes
  completed: 2026-02-18
  tasks_completed: 2
  files_changed: 5
---

# Phase quick-8 Plan 01: Breadcrumb Bar + Risk Report Summary

**One-liner:** Breadcrumb bar with back/forward clause history navigation and full-screen printable risk analysis report overlay accessible from the header hamburger menu.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create BreadcrumbBar component and wire into review page | 86ed7bd | breadcrumb-bar.tsx, page.tsx |
| 2 | Create RiskReport overlay and wire into header menu | c98751c | risk-report.tsx, header.tsx, page.tsx, globals.css |

## What Was Built

### BreadcrumbBar (`frontend/src/components/review/breadcrumb-bar.tsx`)
- Renders below the header only when a paragraph is selected (returns null otherwise)
- Back/forward buttons navigate the focusHistory array via store actions
- Back is disabled when at earliest history entry, forward is disabled when at head (-1 index)
- Breadcrumb crumbs built from `section_hierarchy` array on the paragraph
- Clicking a crumb finds the first paragraph whose `section_ref` matches that hierarchy item number and calls `selectParagraph`
- Final non-clickable crumb shown when paragraph's own `section_ref` differs from last hierarchy item
- Has `no-print` CSS class to suppress from print output

### RiskReport (`frontend/src/components/review/risk-report.tsx`)
- Full-screen fixed overlay (z-50) with `risk-report-overlay` class for print targeting
- Sticky header bar with Print and Close buttons (hidden in print via `no-print`)
- Summary table showing counts for critical/high/medium/low/total severity from `summary` store state
- Risks grouped by top-level section hierarchy, sections sorted by natural numeric order
- Within each section, risks sorted by severity (critical first)
- Each risk shows: SeverityBadge, title, type badge (Risk/Opportunity), description, optional blockquote for highlight_text
- Reuses `SeverityBadge` (already exported from risk-card.tsx)

### Header updates (`frontend/src/components/layout/header.tsx`)
- Added `onExportRiskReport?: () => void` prop
- Added "Export Risk Report" dropdown item in hamburger menu, only rendered when `view === "review"`
- Added `FileText` icon import from lucide-react

### Page.tsx updates
- Added `riskReportOpen` state + setter
- Passes `onExportRiskReport` callback to Header
- Renders `<RiskReport>` overlay after `<AnalysisOverlay>`
- Imports `BreadcrumbBar` and renders it between Header and finalized banner

### Print CSS (`frontend/src/app/globals.css`)
- Expanded `@media print` block: `body * { visibility: hidden }` + `risk-report-overlay` visibility override ensures only the report prints when the overlay is open

## Deviations from Plan

None - plan executed exactly as written, with one minor adaptation:

The plan referenced `analysisSummary` as the store field name, but the actual Zustand store uses `summary` (typed as `AnalysisSummary | null`). Used the correct field name without deviating from intent.

## Self-Check: PASSED

- FOUND: `frontend/src/components/review/breadcrumb-bar.tsx`
- FOUND: `frontend/src/components/review/risk-report.tsx`
- FOUND commit 86ed7bd (Task 1)
- FOUND commit c98751c (Task 2)
- TypeScript: `npx tsc --noEmit` passed with 0 errors
