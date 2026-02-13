---
phase: 07-polish-validation
plan: 01
subsystem: ui
tags: [next-themes, dark-mode, preferences, localStorage, zustand, shadcn]

# Dependency graph
requires:
  - phase: 00-scaffolding
    provides: "Next.js app scaffold, globals.css, layout.tsx, Zustand store"
provides:
  - "ThemeProvider with dark/light/system switching"
  - "Dark mode CSS variables and document viewer overrides"
  - "Preferences system with localStorage persistence"
  - "Settings dialog with 4 preference controls"
  - "Theme toggle in header"
affects: [07-02, 07-03, 07-04, 07-05, accessibility, compact-mode]

# Tech tracking
tech-stack:
  added: [next-themes, shadcn-switch]
  patterns: [ThemeProvider wrapper, localStorage preferences hook, CSS rotation theme toggle]

key-files:
  created:
    - frontend/src/components/providers/theme-provider.tsx
    - frontend/src/hooks/use-preferences.ts
    - frontend/src/components/settings-dialog.tsx
    - frontend/src/components/ui/switch.tsx
  modified:
    - frontend/src/app/globals.css
    - frontend/src/app/layout.tsx
    - frontend/src/components/layout/header.tsx
    - frontend/src/lib/store.ts
    - frontend/package.json

key-decisions:
  - "next-themes with attribute=class and defaultTheme=system for system preference detection"
  - "Manual localStorage persistence via use-preferences hook (no Zustand persist middleware)"
  - "Sun/Moon CSS rotation toggle pattern in header"
  - "Added shadcn Switch component for toggle controls in settings"

patterns-established:
  - "ThemeProvider: wrap app children in layout.tsx, set suppressHydrationWarning on html"
  - "Preferences hook: load from localStorage on mount, auto-save on change, sync with store"
  - "Dark CSS variant: use @custom-variant dark (&:where(.dark, .dark *)) for Tailwind v4"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 7 Plan 1: Theme & Preferences Summary

**Dark/light/system theme switching via next-themes with localStorage-backed preferences dialog and document viewer dark mode overrides**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T05:26:48Z
- **Completed:** 2026-02-13T05:31:04Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Dark/light/system theme switching fully wired with next-themes ThemeProvider
- Fixed Tailwind v4 dark variant selector bug (was `&:is(.dark *)`, now `&:where(.dark, .dark *)`)
- Document viewer dark mode CSS overrides for all interactive states (hover, selected, revision, risk highlight, diff, user edits)
- Preferences system persisting theme, compact mode, default sidebar tab, and navigator panel visibility to localStorage
- Settings dialog with theme button group, compact mode toggle, sidebar tab select, and navigator panel switch
- Sun/Moon theme toggle button in header with CSS rotation animation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install next-themes, fix dark variant, wire ThemeProvider, add document dark mode CSS** - `6d213b0` (feat)
2. **Task 2: Preferences system, theme toggle, and settings dialog** - `0053a27` (feat)

## Files Created/Modified
- `frontend/src/components/providers/theme-provider.tsx` - NextThemesProvider wrapper with class attribute
- `frontend/src/hooks/use-preferences.ts` - localStorage-backed preferences hook with auto-save
- `frontend/src/components/settings-dialog.tsx` - Preferences dialog with 4 controls (theme, compact, sidebar tab, nav panel)
- `frontend/src/components/ui/switch.tsx` - shadcn Switch component for toggle controls
- `frontend/src/app/globals.css` - Fixed dark variant, added 12 dark mode document viewer overrides
- `frontend/src/app/layout.tsx` - Added ThemeProvider wrapper, suppressHydrationWarning, Toaster theme=system
- `frontend/src/components/layout/header.tsx` - Added theme toggle, settings dialog integration, replaced "Coming soon" toasts
- `frontend/src/lib/store.ts` - Added defaultSidebarTab and navPanelVisibleDefault to UIState
- `frontend/package.json` - Added next-themes dependency

## Decisions Made
- Used next-themes with `attribute="class"` and `defaultTheme="system"` -- standard pattern for Tailwind CSS dark mode
- Manual localStorage via use-preferences hook rather than Zustand persist middleware -- cleaner separation, simpler debugging
- Theme toggle cycles light/dark on click (resolvedTheme based) rather than 3-way dropdown -- faster UX for common case
- Settings dialog accessible from both hamburger menu and user menu -- multiple access points reduce discoverability friction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added shadcn Switch component**
- **Found during:** Task 2 (Settings dialog)
- **Issue:** Plan mentioned shadcn doesn't have Switch, but it does -- needed it for toggle controls
- **Fix:** Ran `npx shadcn@latest add switch` to add the component
- **Files modified:** frontend/src/components/ui/switch.tsx, frontend/package.json
- **Verification:** Build passes, Switch renders correctly in settings dialog
- **Committed in:** 0053a27 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Better UX than plan's suggested checkbox/button toggle. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theme infrastructure complete -- Phase 7 plans for compact mode visuals and accessibility can build on this
- Preferences system extensible -- new preferences can be added to the interface and settings dialog
- Dark mode document viewer overrides ready for visual testing with real documents

## Self-Check: PASSED

- All 4 created files exist on disk
- Both task commit hashes (6d213b0, 0053a27) verified in git log
- Build passes without errors

---
*Phase: 07-polish-validation*
*Completed: 2026-02-13*
