---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/layout/header.tsx
  - frontend/src/hooks/use-keyboard-shortcuts.ts
  - frontend/src/app/review/[sessionId]/page.tsx
  - frontend/src/components/review/navigation-panel.tsx
  - frontend/src/components/review/bottom-bar.tsx
  - frontend/src/components/review/document-viewer.tsx
  - frontend/src/app/globals.css
  - frontend/src/components/command-palette.tsx
  - frontend/src/components/keyboard-help.tsx
autonomous: true
must_haves:
  truths:
    - "Header theme toggle persists across page reload"
    - "Pressing ? key opens the keyboard help dialog"
    - "Navigation panel ASIDE elements pass axe-core ARIA checks"
    - "Pagination counter text meets WCAG AA 4.5:1 contrast"
    - "Document viewer background is dark in dark mode"
    - "Bracket keys [ and ] toggle nav panel and sidebar respectively"
    - "Ctrl+, opens the Settings dialog"
  artifacts:
    - path: "frontend/src/components/layout/header.tsx"
      provides: "Theme toggle that syncs with ambrose-preferences"
    - path: "frontend/src/hooks/use-keyboard-shortcuts.ts"
      provides: "Working ? key binding and bracket key bindings"
    - path: "frontend/src/components/review/navigation-panel.tsx"
      provides: "Correct ARIA roles on aside elements"
    - path: "frontend/src/components/review/bottom-bar.tsx"
      provides: "WCAG AA compliant pagination counter"
  key_links:
    - from: "header.tsx cycleTheme()"
      to: "usePreferences().setThemePreference()"
      via: "direct function call"
    - from: "use-keyboard-shortcuts shift+/ handler"
      to: "page.tsx openHelpDialog callback"
      via: "react-hotkeys-hook useHotkeys"
    - from: "use-keyboard-shortcuts mod+comma handler"
      to: "page.tsx openSettings callback"
      via: "react-hotkeys-hook useHotkeys"
---

<objective>
Fix all 7 Critical and High QA items from the Phase 7 regression report.

Purpose: Resolve blocking accessibility, persistence, and functionality bugs before the app can be considered client-ready.
Output: All 7 fixes applied, verified by build success and manual checks.
</objective>

<execution_context>
@C:/Users/david/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/david/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/layout/header.tsx
@frontend/src/hooks/use-keyboard-shortcuts.ts
@frontend/src/hooks/use-preferences.ts
@frontend/src/app/review/[sessionId]/page.tsx
@frontend/src/components/review/navigation-panel.tsx
@frontend/src/components/review/bottom-bar.tsx
@frontend/src/components/review/document-viewer.tsx
@frontend/src/app/globals.css
@frontend/src/components/command-palette.tsx
@frontend/src/components/keyboard-help.tsx
@frontend/src/components/review/sidebar.tsx
@qa-reports/qa-report-2026-02-13-phase7-regression.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Critical bugs — theme persistence (#3) and help dialog (#7)</name>
  <files>
    frontend/src/components/layout/header.tsx
    frontend/src/hooks/use-keyboard-shortcuts.ts
    frontend/src/app/review/[sessionId]/page.tsx
  </files>
  <action>
**Fix #3 — Header theme toggle doesn't persist:**

The root cause: `Header.cycleTheme()` calls `setTheme()` from `next-themes` directly, which updates the standalone `theme` localStorage key. But on reload, `usePreferences` reads from `ambrose-preferences` and sets the theme from there, overwriting whatever `next-themes` stored. Two independent persistence paths.

Fix in `header.tsx`:
1. Import `usePreferences` from `@/hooks/use-preferences` (replaces the direct `useTheme` import for setting).
2. Still use `useTheme` for reading `resolvedTheme` (needed for the icon display).
3. Change `cycleTheme` to call `setThemePreference()` from `usePreferences` instead of `setTheme()` from `next-themes`. This writes to BOTH `ambrose-preferences` AND calls `next-themes` setTheme internally.
4. The cycle logic stays the same: `resolvedTheme === "light"` -> set "dark", else set "light".

Specifically:
- Keep: `const { resolvedTheme } = useTheme();`
- Add: `const { setThemePreference } = usePreferences();`
- Change `cycleTheme` body to use `setThemePreference("dark")` and `setThemePreference("light")` instead of `setTheme("dark")` and `setTheme("light")`.
- Remove `setTheme` from the `useTheme()` destructure since it's no longer used directly.

**Fix #7 — Keyboard Help Dialog (?) completely non-functional:**

The `?` key is bound as `shift+/` in `use-keyboard-shortcuts.ts`. This is the correct representation for `react-hotkeys-hook` v5. However, testing shows it doesn't fire.

Likely cause: `react-hotkeys-hook` may have trouble with `shift+/` syntax. The alternative is to use the `?` key directly or `shift+slash`.

Fix in `use-keyboard-shortcuts.ts`:
1. Change the hotkey string from `"shift+/"` to `"shift+slash"` (react-hotkeys-hook v5 uses key names, not characters — `/` may not be recognized as a valid key identifier).
2. If that doesn't work, try binding to `"?"` directly.
3. Also add `preventDefault: true` to the options to prevent any browser default behavior for `?`.

Additionally, the `singleCharOpts` object has `enableOnFormTags: false as const` — this is correct (don't fire in form fields). But verify the typing: in react-hotkeys-hook v5, `enableOnFormTags` accepts `boolean | string[]`. The `as const` cast to `false` should be fine but change it to just `false` (drop `as const`) for clarity.

**Fix #9 — Settings shortcut (Ctrl+,) non-functional:**

Root cause: In `page.tsx` line 52-55, `useKeyboardShortcuts` is called WITHOUT passing `openSettings`. The hook's `mod+comma` handler calls `openSettings?.()` which is `undefined?.()` = no-op.

But the `settingsOpen` state lives in `Header` component, not in `page.tsx`. We need a way for the keyboard shortcut to open settings.

Fix: Use the same custom event pattern used for other cross-component communication.

1. In `page.tsx`: Add `const [settingsOpen, setSettingsOpen] = useState(false)` state (rename the existing one or add new one). Actually, Header already manages its own `settingsOpen` state. The cleanest fix is to have Header listen for a custom event:

   In `header.tsx`, add a `useEffect` that listens for `"command:open-settings"` custom event and calls `setSettingsOpen(true)` when fired.

2. In `page.tsx`, pass `openSettings: () => window.dispatchEvent(new CustomEvent("command:open-settings"))` to `useKeyboardShortcuts`.

3. In `command-palette.tsx`, update the "Open Settings" action (currently a placeholder comment on line 185-186) to dispatch the same event: `window.dispatchEvent(new CustomEvent("command:open-settings"))`.
  </action>
  <verify>
1. `cd frontend && npx next build 2>&1 | head -20` — build succeeds with no type errors.
2. Manual: Toggle theme via header sun/moon button, reload page, theme persists.
3. Manual: Press `?` key on review page (not in a text field) — help dialog appears.
4. Manual: Press `Ctrl+,` — settings dialog opens.
  </verify>
  <done>
- Header theme toggle writes to `ambrose-preferences` via `usePreferences`, persists across reload.
- `?` key opens the keyboard help dialog.
- `Ctrl+,` opens the settings dialog from anywhere on the review page.
- Command palette "Open Settings" action also opens settings dialog.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix High bugs — ARIA roles (#15), contrast (#16), dark mode doc viewer (#4), brackets (#8)</name>
  <files>
    frontend/src/components/review/navigation-panel.tsx
    frontend/src/components/review/bottom-bar.tsx
    frontend/src/components/review/document-viewer.tsx
    frontend/src/app/globals.css
    frontend/src/components/keyboard-help.tsx
  </files>
  <action>
**Fix #15 — Sidebar wrong ARIA role:**

axe-core error: "ARIA role navigation is not allowed for given element" on `<aside>` elements in navigation-panel.tsx.

The `<aside>` element has implicit ARIA role `complementary`. Adding `role="navigation"` is not allowed per ARIA spec (role `navigation` maps to `<nav>`).

Fix in `navigation-panel.tsx`:
1. Line 182: Change `<aside role="navigation"` to `<nav` (change element from aside to nav). Close tag: `</aside>` -> `</nav>`. Keep `aria-label="Document navigator"`.
2. Line 283: Same change — `<aside role="navigation"` to `<nav`. Close tag on line 379: `</aside>` -> `</nav>`.

Using `<nav>` is semantically correct since this IS a navigation landmark (document outline/navigator). The `<aside>` was the wrong element choice.

**Fix #16 — Pagination low contrast:**

In `bottom-bar.tsx` line 168, the pagination counter span has class `text-muted-foreground`. The `--muted-foreground` color in light mode is `oklch(0.49 0 0)` which was already darkened for AA compliance, but the QA report measures `#a8a8a8` which is `oklch(0.698...)` — this means the old value is still being served or there's a caching issue. However, looking at the rendered value of `#a8a8a8`, that corresponds to approximately `oklch(0.71 0 0)` — much lighter than the CSS value.

The safest fix: change the pagination counter from `text-muted-foreground` to `text-foreground` since it's an important navigational indicator, not secondary text. This gives maximum contrast.

Fix in `bottom-bar.tsx`:
1. Line 168: Change `text-muted-foreground` to `text-foreground` in the pagination span's className.

**Fix #4 — Document viewer white background in dark mode:**

The document viewer in `document-viewer.tsx` line 437 uses `bg-card` which should resolve correctly in dark mode (`--card: oklch(0.175 0 0)`). However, the document HTML rendered via `dangerouslySetInnerHTML` likely contains inline styles or the `.document-container` itself has inherited white backgrounds from the DOCX HTML rendering.

Fix in `globals.css`:
1. Add a dark mode override for the document container area itself:
```css
.dark .document-container {
  color: oklch(0.985 0 0);
}
```
2. Add an override to neutralize any inline white backgrounds from DOCX HTML:
```css
.dark .document-container * {
  background-color: transparent !important;
  color: inherit;
}
```
Note: Use `!important` sparingly — only needed here because DOCX HTML embeds inline `style="background-color: white"` attributes that can't be overridden otherwise. The `color: inherit` ensures text adopts the dark mode foreground.

3. Exclude track-changes elements from the color override (they need their specific colors):
```css
.dark .document-container .diff-del,
.dark .document-container .diff-ins,
.dark .document-container .track-changes-insert,
.dark .document-container .track-changes-delete,
.dark .document-container .risk-highlight,
.dark .document-container .risk-highlight-active {
  color: revert-layer;
}
```

**Fix #8 — Bracket navigation [ ] don't work:**

The `[` and `]` keys ARE bound in `use-keyboard-shortcuts.ts` (lines 101-116) to toggle nav panel and sidebar respectively. The keyboard-help.tsx and command-palette.tsx confirm this is the intended behavior (not paragraph navigation as the QA tester assumed).

However, `react-hotkeys-hook` may have issues with bare bracket characters as hotkey strings. Brackets are special characters in some hotkey parsers.

Fix in `use-keyboard-shortcuts.ts`:
1. Change the hotkey string `"["` to `"BracketLeft"` (the `KeyboardEvent.code` or key name for the left bracket key).
2. Change the hotkey string `"]"` to `"BracketRight"`.
3. Note: react-hotkeys-hook v5 may use `code` values. If `BracketLeft`/`BracketRight` don't work, try `bracketleft`/`bracketright` (lowercase). Check the library's key mapping.
4. Actually, react-hotkeys-hook v5 uses `event.key` values. `event.key` for `[` is literally `"["` which should work. The issue might be that brackets are being interpreted as part of the hotkey syntax (modifier grouping). Try escaping or using the `keys` option instead of the string.
5. Safest approach: Use the `useHotkeys` callback form with a custom `keydown` check. OR wrap the bracket in the correct syntax. In react-hotkeys-hook, if `[` is problematic, use the `keys` option: `useHotkeys('bracketleft', callback, opts)`.

Test approach: Try `"bracketleft"` and `"bracketright"` first (these are the `event.code` lowercased without the "Key" prefix, which react-hotkeys-hook sometimes accepts). If that fails, fall back to manually adding a `keydown` event listener for bracket keys.

Also update `keyboard-help.tsx` to clarify that `[` toggles the navigator panel and `]` toggles the sidebar (the current text already says this, so no change needed there).
  </action>
  <verify>
1. `cd frontend && npx next build 2>&1 | head -20` — build succeeds.
2. Open browser DevTools console, run axe-core — no "ARIA role navigation is not allowed" error.
3. Inspect pagination counter in bottom bar — text is now higher contrast (not #a8a8a8).
4. Toggle dark mode — document viewer area has dark background, text is readable.
5. Press `[` key — navigator panel toggles. Press `]` key — sidebar toggles.
  </verify>
  <done>
- Navigation panel uses `<nav>` element instead of `<aside role="navigation">`, passing axe-core validation.
- Pagination counter uses `text-foreground` class, meeting WCAG AA 4.5:1 contrast ratio.
- Document viewer area has dark background in dark mode with readable text; inline DOCX styles overridden.
- `[` and `]` keys successfully toggle navigator panel and sidebar respectively.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create GitHub issue for Medium/Low/Observation items</name>
  <files>None (GitHub API only)</files>
  <action>
Create a single GitHub issue consolidating all Medium, Low, and Observation items from the QA regression report that are NOT being fixed in this plan.

Items to include:
- **#5 Medium** — Compact mode inconsistent (subtle/ambiguous effect)
- **#6 Low** — Settings dialog title inconsistency ("Settings" vs "Preferences" menu labels)
- **#10 Medium** — Flag shortcut (f) provides no feedback (no dialog/toast/visual confirmation)
- **#11 Medium** — Ctrl+\ behavior unclear (revision sheet vs sidebar confusion)
- **#12 Medium** — No shortcuts for Finalize Redline / Generate Transmittal
- **#13 Low** — Command palette search doesn't match "dark"/"theme" terms
- **#14 Observation** — No visual indicator for shortcut active/disabled state
- **#1 Low (Wave 1)** — Additional contrast issue (4.41:1 #787878 on white)
- **#2 Low (Wave 1)** — Landmark warnings ("Some page content not contained by landmarks")

Use `gh issue create` with:
- Title: "QA Phase 7 Regression: Medium/Low/Observation items"
- Labels: "bug", "qa" (create labels if they don't exist)
- Body: Markdown table with severity, description, and suggested fix for each item

Format the body as a checklist so items can be tracked individually.
  </action>
  <verify>
`gh issue list --limit 1` shows the newly created issue.
  </verify>
  <done>
Single GitHub issue created with all 9 Medium/Low/Observation items as a trackable checklist.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `cd frontend && npx next build` passes with zero errors
2. All 7 Critical/High QA items have code fixes applied
3. GitHub issue exists for remaining Medium/Low/Observation items
</verification>

<success_criteria>
- Theme toggle in header persists across page reload (writes to ambrose-preferences)
- ? key opens keyboard help dialog
- Ctrl+, opens settings dialog
- Navigation panel uses <nav> element (no axe-core ARIA errors)
- Pagination counter has sufficient contrast (text-foreground)
- Document viewer is dark in dark mode
- [ and ] keys toggle panels
- GitHub issue created for deferred items
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-critical-and-high-qa-items-from-phas/6-SUMMARY.md`
</output>
