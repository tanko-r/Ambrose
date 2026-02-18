# QA Test Report — Contract Review (Ambrose) — Phase 7 Regression
**Date:** 2026-02-13
**Tester Persona:** Sarah Chen (mid-career professional, tech-savvy, discerning)
**App URL:** http://localhost:3000
**Phases Tested:** Phase 7: Polish + Validation (regression of previous Critical/High bugs + thorough test of plans 07-01 and 07-02)

---

## Wave 1: Critical/High Regression Verification

### regression-verifier

#### Things That Work Well
- Filter input completely stable — special chars, partial words, clearing all work without any crashes
- Non-existent session handling is clean and professional (red alert icon, "Session Not Found" heading, "Back to Home" button, only 3 API requests)
- Compact mode now has visible effect on spacing/density
- Keyboard navigation (Enter + Space) works flawlessly on navigator paragraph buttons
- Document loads fast (~389 paragraphs in ~3 seconds)

#### Regression Results

| Original # | Severity | Bug | Status | Details |
|------------|----------|-----|--------|---------|
| 6 | Critical | Filter input crash | **FIXED** | Typed "seller", "(Seller)" with special chars, partial words, cleared input — zero crashes. Filter works correctly. |
| 7 | Critical | Infinite loading loop | **FIXED** | Shows clean error state with "Back to Home" button. Only 3 API requests, no spinner, no toast spam. |
| 15 | High | Sidebar wrong ARIA role | **STILL BROKEN** | Sidebar ASIDE still has `role="navigation"` instead of `role="complementary"`. axe-core console error persists. |
| 16 | High | Pagination low contrast | **STILL BROKEN** | "0 of 99" pagination counter still has 2.37:1 contrast (#a8a8a8 on #ffffff). WCAG AA requires 4.5:1. |
| 11 | Medium | Compact mode no effect | **FIXED** | Clear visual difference when toggled — tighter spacing, more items visible. |
| 19 | Medium | Keyboard paragraph activation | **FIXED** | Both Enter and Space keys activate paragraphs. Sidebar updates, document scrolls and highlights. |

#### New Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 1 | **Low** | **Additional contrast issue** — Console shows second contrast violation: 4.41:1 (#787878 on white). Close to but fails 4.5:1 WCAG AA. | N/A |
| 2 | **Low** | **Landmark warnings** — Console shows "Some page content is not contained by landmarks" errors. Affects screen reader navigation. | N/A |

#### Sarah's Verdict
> "Big relief seeing those crash bugs fixed — the filter works smoothly and bad sessions fail gracefully. But the accessibility debt is piling up: wrong ARIA roles, contrast failures, missing landmarks. Real users with low vision or screen readers are getting a subpar experience."

---

## Wave 2: Theme & Preferences (Plan 07-01)

### theme-preferences-tester

#### Things That Work Well
- Theme toggle button works smoothly with instant feedback and clean sun/moon CSS rotation animation
- Settings dialog accessible from BOTH hamburger menu AND user menu — excellent redundancy
- Settings dialog has clean, professional design with all 4 controls clearly labeled
- Dark mode styling on navigator, sidebar, toolbar, and dialogs is well-executed with good contrast
- Theme switching via Settings dialog buttons persists correctly across page reloads
- Default Sidebar Tab dropdown works smoothly with all options properly styled in dark mode
- No flash of unstyled content during theme transitions
- Risk cards, badges, and buttons maintain good readability in both themes

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 3 | **Critical** | **Header toggle doesn't persist theme** — Clicking the sun/moon toggle in header switches the UI theme instantly but only updates the standalone `theme` localStorage key, NOT the `ambrose-preferences` object. On page reload, app reverts to the theme stored in `ambrose-preferences`. Sarah loses her theme choice every refresh if she uses the header toggle instead of the Settings dialog. Two localStorage paths that don't sync. | `theme-preferences-tester-12-after-reload-persistence.png` |
| 4 | **High** | **Document viewer white background in dark mode** — The center document viewing area remains bright white in dark mode while all surrounding panels (navigator, sidebar, toolbar) are properly dark. Creates harsh eye strain and defeats the purpose of dark mode entirely. CSS overrides exist in globals.css but aren't taking effect on the document content area. | `theme-preferences-tester-08-review-page-dark-empty.png`, `theme-preferences-tester-17-document-viewer-white-bg-issue.png` |
| 5 | **Medium** | **Compact mode inconsistent** — Toggle changes visual state (blue/gray) but no observable change in UI spacing on the review page. Wave 1 agent saw a difference, Wave 2 agent didn't — may depend on page context or content loaded. Effect is subtle enough to be ambiguous. | `theme-preferences-tester-06-compact-mode-off.png` |
| 6 | **Low** | **Settings dialog title inconsistency** — Called "Settings" when accessed from hamburger menu but "Preferences" when accessed from user menu. Both open the same dialog titled "Settings". Minor terminology confusion. | `theme-preferences-tester-04-settings-dialog-light.png` |

#### Sarah's Verdict
> "The theme system looks polished and mostly works, but the header toggle button is a trap — it lies about persisting your choice. And that blinding white document viewer in dark mode? That's not dark mode, that's a flashlight pointed at my face at 2am."

---

## Wave 3: Keyboard Shortcuts & Command Palette (Plan 07-02)

### keyboard-shortcuts-tester

#### Things That Work Well
- Command palette (Ctrl+K) opens instantly with clean, organized interface showing 4 categorized groups
- Fuzzy search in command palette works perfectly — "toggle" filters to all toggle-related actions
- Command execution from palette works reliably (e.g., "Toggle Compact Mode" executes immediately)
- Risk navigation (j/k) works flawlessly — smooth scrolling, sidebar updates, document highlights
- Generate revision (g key) opens the revision sheet as expected
- Text input protection works correctly — single-char shortcuts (f, j, k, ?) properly disabled in text inputs
- Escape key reliably closes all dialogs and command palette
- Visual design of command palette is professional with clear keyboard shortcut indicators
- Platform-aware shortcuts displayed correctly (Ctrl on Windows)

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 7 | **Critical** | **Keyboard Help Dialog (?) completely non-functional** — Pressing the ? key does nothing in any context (outside text inputs, after closing dialogs). The help dialog never appears. Users have no discoverable way to learn available shortcuts without already knowing Ctrl+K opens the command palette. Complete feature failure. | `keyboard-shortcuts-tester-help-dialog.png` |
| 8 | **High** | **Bracket navigation ([ and ]) don't work** — According to the plan, [ should go to previous paragraph and ] to next. Pressing these keys does nothing. Command palette shows them mapped to "Toggle Navigator Panel" and "Toggle Sidebar" but those actions also don't trigger. Paragraph-to-paragraph keyboard navigation is completely missing. | `keyboard-shortcuts-tester-bracket-after-selection.png` |
| 9 | **High** | **Settings shortcut (Ctrl+,) non-functional** — Pressing Ctrl+, does nothing. Command palette lists "Open Settings" with Ctrl+, but the shortcut is broken. Users who know this standard shortcut from other apps (VS Code, browsers) will be frustrated. | `keyboard-shortcuts-tester-settings-dialog.png` |
| 10 | **Medium** | **Flag shortcut (f) provides no feedback** — Pressing f with a clause selected appears to do nothing. No dialog opens, no visual confirmation, no toast notification. Users need immediate feedback for keyboard actions — silence feels like a broken feature. | `keyboard-shortcuts-tester-f-key-flag.png` |
| 11 | **Medium** | **Ctrl+\ behavior unclear** — Pressing Ctrl+\ with revision sheet open doesn't toggle the sidebar as expected. Command palette lists it as "Toggle Revision Sheet" which contradicts expected "Toggle Sidebar" behavior. The distinction between these concepts is confusing. | `keyboard-shortcuts-tester-toggle-sidebar.png` |
| 12 | **Medium** | **No shortcuts for critical workflow actions** — "Finalize Redline" and "Generate Transmittal" appear in command palette but have no keyboard shortcuts assigned. These are end-of-workflow actions that power users would want quick access to. | `keyboard-shortcuts-tester-command-palette-full-list.png` |
| 13 | **Low** | **Command palette search terms don't match expectations** — Searching "dark" or "theme" returns "No results" even though theme toggle exists. Users typing intuitive search terms get zero results. Search index needs more aliases. | `keyboard-shortcuts-tester-command-palette-search-toggle.png` |
| 14 | **Observation** | **No visual indicator for shortcut active/disabled state** — When shortcuts are disabled (e.g., focus in text inputs), there's no visual cue. A subtle indicator would help users understand why keys aren't responding. | `keyboard-shortcuts-tester-text-input-multiple-chars.png` |

#### Sarah's Verdict
> "The command palette is polished and risk navigation (j/k) works beautifully, but half the promised shortcuts are completely broken. No help dialog, no settings access, no paragraph navigation — that's a partially-wired prototype. I shouldn't need to hunt through a command palette to discover features that should have a discoverable ? shortcut."

---

## Summary

### Previous Bug Regression Status

| Original # | Severity | Bug | Status |
|------------|----------|-----|--------|
| 6 | Critical | Filter input crash (TypeError) | **FIXED** |
| 7 | Critical | Infinite loading loop (146+ API requests) | **FIXED** |
| 15 | High | Sidebar wrong ARIA role | **STILL BROKEN** |
| 16 | High | Pagination low contrast (2.37:1) | **STILL BROKEN** |
| 11 | Medium | Compact mode no effect | **FIXED** (but inconsistent across contexts) |
| 19 | Medium | Keyboard paragraph activation | **FIXED** |

### New Issue Totals

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 3 (+2 unfixed from previous) |
| Medium | 4 |
| Low | 4 |
| Observation | 1 |
| **Total New** | **14** |
| **Total (incl. unfixed)** | **16** |

### Top Issues Sarah Would Notice First
1. **#7 (Critical)** — Keyboard help dialog (?) is completely broken. No way to discover shortcuts.
2. **#3 (Critical)** — Header theme toggle doesn't persist. Dark mode reverts on every page refresh.
3. **#8 (High)** — Bracket keys ([ ]) for paragraph navigation don't work at all.
4. **#9 (High)** — Ctrl+, for settings doesn't work despite being a standard app shortcut.
5. **#4 (High)** — Document viewer stays blinding white in dark mode while everything else is dark.

### Things Sarah Would Appreciate Most
- Command palette (Ctrl+K) is polished, fast, and well-organized
- Risk navigation (j/k) is smooth and reliable — sidebar + document stay in sync
- Filter input is rock-solid now (was a Critical crash before)
- Non-existent session handling is clean and professional
- Dark mode on panels, toolbar, and sidebar is well-executed
- Settings dialog has clean design with redundant access paths
- Text input protection prevents shortcut interference when typing

### Overall Assessment
> "The improvements since last week are real — those crash bugs are genuinely fixed, and the command palette is a feature I'd actually use daily. But the keyboard shortcuts story is half-told: the ones that work (j, k, g, Escape, Ctrl+K) work great, but ?, [, ], Ctrl+,, and Ctrl+\ are dead keys. That's not acceptable for a feature marketed as 'keyboard shortcuts for power users.' The dark mode is 80% there — panels and chrome look great, but the main document area is still a white rectangle. Fix the theme persistence bug (header toggle vs settings dialog fighting over localStorage), wire up the remaining shortcuts, and darken the document viewer, and this tool will be genuinely impressive. Right now it's close but not client-ready."
