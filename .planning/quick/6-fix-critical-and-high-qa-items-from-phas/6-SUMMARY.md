---
phase: quick-6
plan: 01
subsystem: ui
tags: [accessibility, dark-mode, keyboard-shortcuts, next-themes, react-hotkeys-hook, aria, wcag]

# Dependency graph
requires:
  - phase: 07-polish
    provides: keyboard shortcuts, theme toggle, navigation panel, bottom bar
provides:
  - Theme persistence via ambrose-preferences localStorage
  - Working keyboard shortcuts (?, Ctrl+,, [, ])
  - Correct ARIA roles on navigation panel
  - WCAG AA compliant pagination counter
  - Dark mode document viewer with inline DOCX style overrides
  - Custom event pattern for cross-component settings dialog
affects: [phase-7-polish, qa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom DOM events (command:open-settings) for cross-component communication"
    - "Native keydown listener for bracket keys (react-hotkeys-hook workaround)"
    - "CSS !important for overriding inline DOCX styles in dark mode"

key-files:
  created: []
  modified:
    - frontend/src/components/layout/header.tsx
    - frontend/src/hooks/use-keyboard-shortcuts.ts
    - frontend/src/app/review/[sessionId]/page.tsx
    - frontend/src/components/command-palette.tsx
    - frontend/src/components/review/navigation-panel.tsx
    - frontend/src/components/review/bottom-bar.tsx
    - frontend/src/app/globals.css

key-decisions:
  - "Native keydown listener for bracket keys instead of react-hotkeys-hook (brackets parsed as special syntax)"
  - "Custom DOM events for cross-component settings dialog communication (decouples keyboard hook from Header state)"
  - "CSS !important for dark mode DOCX overrides (only way to override inline style attributes)"

patterns-established:
  - "command:open-settings event pattern for opening settings from any component"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Quick Task 6: Fix Critical/High QA Items Summary

**Fixed 7 Critical/High QA regression items: theme persistence, keyboard shortcuts (?, Ctrl+,, [, ]), ARIA roles, pagination contrast, and dark mode document viewer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T00:35:55Z
- **Completed:** 2026-02-14T00:39:53Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Theme toggle now persists across reload by writing to ambrose-preferences via usePreferences hook
- All keyboard shortcuts functional: ? opens help dialog, Ctrl+, opens settings, [ and ] toggle panels
- Navigation panel uses semantic `<nav>` element instead of `<aside role="navigation">` (fixes axe-core ARIA error)
- Pagination counter meets WCAG AA 4.5:1 contrast ratio with text-foreground class
- Dark mode document viewer overrides inline DOCX white backgrounds while preserving track-changes colors
- GitHub issue #52 created for 9 deferred Medium/Low/Observation items

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Critical bugs -- theme persistence, help dialog, settings shortcut** - `b2e31f5` (fix)
2. **Task 2: Fix High bugs -- ARIA roles, contrast, dark mode doc viewer, brackets** - `41696b1` (fix)
3. **Task 3: Create GitHub issue for deferred items** - No commit (GitHub API only, issue #52)

## Files Created/Modified
- `frontend/src/components/layout/header.tsx` - Theme toggle uses usePreferences, listens for command:open-settings event
- `frontend/src/hooks/use-keyboard-shortcuts.ts` - Fixed shift+/ with preventDefault, native keydown for brackets
- `frontend/src/app/review/[sessionId]/page.tsx` - Passes openSettings callback to useKeyboardShortcuts
- `frontend/src/components/command-palette.tsx` - Open Settings dispatches command:open-settings event
- `frontend/src/components/review/navigation-panel.tsx` - Changed aside to nav element (both ghost and docked modes)
- `frontend/src/components/review/bottom-bar.tsx` - Pagination counter uses text-foreground for contrast
- `frontend/src/app/globals.css` - Dark mode overrides for DOCX inline styles with !important

## Decisions Made
- Used native `keydown` event listener for `[` and `]` keys because `react-hotkeys-hook` interprets brackets as special syntax (modifier grouping). The listener checks for form fields and contenteditable to maintain the same safety as other single-char shortcuts.
- Used `window.dispatchEvent(new CustomEvent("command:open-settings"))` pattern for Ctrl+, because the settings dialog state lives in Header, not in the page component where keyboard shortcuts are registered. This decouples the shortcut from the component hierarchy.
- Used `!important` on dark mode DOCX style overrides because DOCX HTML contains inline `style="background-color: white"` attributes that cannot be overridden with normal specificity. Track-changes and risk-highlight elements explicitly preserve their colors.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Critical and High QA items resolved
- 9 Medium/Low/Observation items tracked in GitHub issue #52
- Build passes cleanly with zero type errors

## Self-Check: PASSED

- All 7 modified files verified present on disk
- Commits b2e31f5 and 41696b1 verified in git history
- GitHub issue #52 verified via `gh issue list`
- Final build passes with zero errors

---
*Quick Task: 6*
*Completed: 2026-02-13*
