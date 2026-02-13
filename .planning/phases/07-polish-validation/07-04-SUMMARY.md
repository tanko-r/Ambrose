---
phase: 07-polish-validation
plan: 04
subsystem: ui
tags: [accessibility, wcag, aria, axe-core, focus-management, small-screen]

# Dependency graph
requires:
  - phase: 07-01
    provides: dark mode theming and CSS custom properties
provides:
  - SmallScreenWarning component for viewport < 1280px
  - ARIA accessibility labels across all review components
  - Keyboard navigation for document paragraphs
  - axe-core dev-time accessibility auditing
  - WCAG AA color contrast compliance
  - Focus-visible indicators for document paragraphs
  - Print styles (no-print class)
affects: [07-05-validation, 08-cleanup]

# Tech tracking
tech-stack:
  added: ["@axe-core/react"]
  patterns: ["ARIA labeling on interactive elements", "keyboard-navigable document paragraphs", "focus-visible outline pattern", "print media query"]

key-files:
  created:
    - frontend/src/components/small-screen-warning.tsx
    - frontend/src/components/axe-accessibility.tsx
  modified:
    - frontend/src/app/layout.tsx
    - frontend/src/app/globals.css
    - frontend/src/components/layout/header.tsx
    - frontend/src/components/review/sidebar.tsx
    - frontend/src/components/review/document-viewer.tsx
    - frontend/src/components/review/bottom-bar.tsx
    - frontend/src/components/review/navigation-panel.tsx
    - frontend/src/components/review/risk-card.tsx
    - frontend/src/components/review/revision-actions.tsx

key-decisions:
  - "Darkened muted-foreground from oklch 0.525 to 0.49 for WCAG AA 4.5:1 contrast"
  - "Darkened severity-high badge from oklch 0.705 to 0.62 for white text contrast"
  - "AxeAccessibility component as separate client component (tree-shaken in production)"

patterns-established:
  - "ARIA labels on all icon-only buttons across review interface"
  - "role=button + tabindex=0 + keydown handler for clickable non-button elements"
  - "no-print CSS class for elements hidden in print mode"

# Metrics
duration: 8min
completed: 2026-02-13
---

# Phase 7 Plan 4: Accessibility + Small Screen Warning Summary

**SmallScreenWarning overlay for <1280px viewports, WCAG AA ARIA pass across all review components, axe-core dev auditing, color contrast fixes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-13T05:34:47Z
- **Completed:** 2026-02-13T05:42:26Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- SmallScreenWarning component renders fixed overlay for viewports below 1280px, dismissable per session
- All interactive elements across review interface have ARIA labels (39 total aria-label attributes)
- Document paragraphs are keyboard-accessible with role="button", tabindex="0", Enter/Space handlers
- @axe-core/react installed for development-time accessibility violation reporting
- Color contrast fixed for WCAG AA: muted-foreground darkened, severity-high badge darkened
- Focus-visible outline styles added for document paragraph keyboard navigation
- Print styles added with no-print class on header and bottom toolbar

## Task Commits

Each task was committed atomically:

1. **Task 1: Small screen warning and ARIA accessibility pass** - `eea09b8` (feat)
2. **Task 2: Install axe-core, color contrast fixes, focus/print styles** - `5389773` (feat)

## Files Created/Modified
- `frontend/src/components/small-screen-warning.tsx` - Viewport width guard with dismiss button
- `frontend/src/components/axe-accessibility.tsx` - Dev-only axe-core initialization
- `frontend/src/app/layout.tsx` - Added SmallScreenWarning and AxeAccessibility
- `frontend/src/app/globals.css` - Color contrast fixes, focus-visible styles, print styles
- `frontend/src/components/layout/header.tsx` - ARIA labels on menu, theme, new, user buttons; no-print class
- `frontend/src/components/review/sidebar.tsx` - role=complementary, tablist, tab, tabpanel ARIA; close/flag button labels
- `frontend/src/components/review/document-viewer.tsx` - role=main, paragraph role=button/tabindex/aria-selected/keydown
- `frontend/src/components/review/bottom-bar.tsx` - role=toolbar, nav button labels, severity pill labels; no-print
- `frontend/src/components/review/navigation-panel.tsx` - role=navigation, aria-label on navigator
- `frontend/src/components/review/risk-card.tsx` - Severity badge aria-label
- `frontend/src/components/review/revision-actions.tsx` - Approve/reject/reset/reopen button labels
- `frontend/src/components/review/revision-sheet.tsx` - Already had proper ARIA (verified)

## Decisions Made
- Darkened muted-foreground from oklch(0.525) to oklch(0.49) for WCAG AA compliance on white background
- Darkened severity-high badge from oklch(0.705) to oklch(0.62) for 3:1 contrast with white text
- Created AxeAccessibility as separate client component instead of inline in layout (cleaner separation)
- Skipped role="article" on AccordionItem since Radix Accordion already provides proper ARIA semantics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Linter auto-added store.ts changes for filter state**
- **Found during:** Task 1
- **Issue:** Linter modified store.ts to add showRisks/showRevisions/showFlags state (needed by bottom-bar and navigation-panel linter changes)
- **Fix:** Included store.ts in Task 1 commit to maintain consistency
- **Files modified:** frontend/src/lib/store.ts
- **Committed in:** eea09b8

---

**Total deviations:** 1 auto-fixed (1 blocking - linter dependency)
**Impact on plan:** Minimal. Linter changes were consistent with ongoing Phase 7 work.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Accessibility foundation complete for Phase 7 validation
- axe-core will report any remaining violations in dev console
- Ready for Phase 7 Plan 5 (final validation) or Phase 8 (cleanup)

## Self-Check: PASSED

- [x] frontend/src/components/small-screen-warning.tsx exists (51 lines)
- [x] frontend/src/components/axe-accessibility.tsx exists
- [x] Commit eea09b8 found in git log
- [x] Commit 5389773 found in git log
- [x] Build passes without errors

---
*Phase: 07-polish-validation*
*Completed: 2026-02-13*
