---
phase: 03-compare-precedent-fix
plan: 01
subsystem: ui
tags: [split.js, javascript, css, layout, split-pane]

# Dependency graph
requires:
  - phase: none
    provides: Existing precedent panel implementation (overlay-based)
provides:
  - Split.js integration for resizable split-pane layout
  - Precedent navigator component on right side
  - Draggable gutter with size persistence
  - True side-by-side document comparison
affects: [03-compare-precedent-fix plans 02 and 03]

# Tech tracking
tech-stack:
  added: [Split.js 1.6.5 via CDN]
  patterns: [Split-pane layout, IntersectionObserver for scroll tracking, localStorage for preference persistence]

key-files:
  created: []
  modified:
    - app/static/index.html
    - app/static/css/main.css
    - app/static/js/precedent.js
    - app/static/js/views.js

key-decisions:
  - "Used Split.js CDN (unpkg) instead of npm install for simplicity"
  - "Navigator positioned on right side of precedent pane (inside split pane)"
  - "Split sizes persist to localStorage key 'precedent-split-sizes'"
  - "Default split ratio 55/45 (main doc / precedent)"
  - "Minimum pane widths: main=400px, precedent=350px"

patterns-established:
  - "Split.js initialization with destroy on close"
  - "IntersectionObserver for tracking visible section in navigator"
  - "Gutter styled with SVG background for drag handles"

# Metrics
duration: 15min
completed: 2026-02-02
---

# Phase 03 Plan 01: Split-Pane Layout for Precedent Panel Summary

**Split.js integration replacing overlay with true side-by-side resizable split-pane layout and dedicated section navigator**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-03T00:30:20Z
- **Completed:** 2026-02-03T00:45:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Replaced overlay-based precedent panel with Split.js split-pane layout (UAT #1 fix)
- Added precedent navigator on right side of precedent pane (UAT #2 fix)
- Implemented draggable gutter for resizing with smooth visual feedback
- Split sizes persist to localStorage for user preference retention
- Main document content now pushes left when precedent opens instead of being covered

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Split.js and restructure HTML** - `9b55f71` (feat)
2. **Task 2: Update CSS for split-pane layout** - `6f4a45f` (feat)
3. **Task 3: Rewrite precedent.js for Split.js** - `14a1fd2` (feat)

## Files Created/Modified
- `app/static/index.html` - Added Split.js CDN, restructured to split-container with main-document-pane and precedent-pane
- `app/static/css/main.css` - Added .split-container, .gutter, .precedent-pane, .precedent-navigator styles; removed old overlay styles
- `app/static/js/precedent.js` - Rewrote to use Split.js, added navigator rendering, IntersectionObserver for scroll tracking
- `app/static/js/views.js` - Updated to show/hide split-container instead of document-panel

## Decisions Made
- Used Split.js via CDN (unpkg) for simplicity - no build step required
- Navigator placed inside precedent-pane on right side (body has content + navigator layout)
- Default 55/45 split ratio gives main document slightly more space
- Gutter width 6px with SVG grip pattern for visual affordance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation was straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Split-pane layout foundation is complete
- Plan 02 (TF-IDF matching) and Plan 03 (copy button) can proceed
- Manual verification needed: load session with precedent, click Compare Precedent, verify split behavior

---
*Phase: 03-compare-precedent-fix*
*Completed: 2026-02-02*
