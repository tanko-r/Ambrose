---
phase: 7-tier2-ui-refinements
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/review/bottom-bar.tsx
  - frontend/src/components/review/sidebar.tsx
  - frontend/src/components/review/document-viewer.tsx
  - frontend/src/components/layout/header.tsx
  - frontend/src/components/dialogs/transmittal-dialog.tsx
  - frontend/src/components/dialogs/finalize-dialog.tsx
  - frontend/src/hooks/use-keyboard-shortcuts.ts
  - frontend/src/hooks/use-document.ts
  - frontend/src/lib/store.ts
  - frontend/src/app/review/[sessionId]/page.tsx
  - frontend/src/components/keyboard-help.tsx
  - frontend/src/components/command-palette.tsx
  - app/api/routes.py
autonomous: true
must_haves:
  truths:
    - "Filter pills show descriptive hover tooltips"
    - "Intensity slider, disabled buttons show explanatory tooltips"
    - "Navigation counter reflects filtered paragraph count"
    - "Escape key closes the sidebar"
    - "Enter/Space activates document paragraphs with role=button"
    - "Arrow keys navigate sidebar tabs per ARIA tablist pattern"
    - "Status badges do not overflow at wide viewports"
    - "Transmittal subject line is editable"
    - "Transmittal body has no raw markdown syntax"
    - "Empty flag notes show fallback text in transmittal"
    - "Revision summary truncates at word boundaries"
    - "Compact mode visibly reduces font sizes, icon sizes, and spacing"
    - "Finalized banner appears on page load for finalized sessions"
    - "Connector line routes cleanly without crossing text"
  artifacts:
    - path: "frontend/src/components/review/bottom-bar.tsx"
      provides: "Tooltips on filter pills + disabled buttons, filtered nav counter"
    - path: "frontend/src/components/review/sidebar.tsx"
      provides: "Arrow key tab navigation, Escape close handler"
    - path: "frontend/src/components/review/document-viewer.tsx"
      provides: "Enter/Space paragraph activation"
    - path: "frontend/src/components/dialogs/transmittal-dialog.tsx"
      provides: "Editable subject line"
    - path: "app/api/routes.py"
      provides: "No markdown headers, fallback flag text, word-boundary truncation"
    - path: "frontend/src/hooks/use-document.ts"
      provides: "Hydrates session status from backend"
  key_links:
    - from: "frontend/src/hooks/use-document.ts"
      to: "app/api/routes.py"
      via: "getDocument or getSessionInfo call to hydrate status"
      pattern: "setSession.*status"
---

<objective>
Implement all 14 Tier 2 UI refinements across the contract review interface.

Purpose: Polish the review experience with tooltips, keyboard accessibility, transmittal fixes, and visual improvements.
Output: All 14 items from the refinement list addressed in a single coordinated pass.
</objective>

<execution_context>
Branch: ui-refinement (already checked out)
</execution_context>

<context>
@frontend/src/components/review/bottom-bar.tsx
@frontend/src/components/review/sidebar.tsx
@frontend/src/components/review/document-viewer.tsx
@frontend/src/components/layout/header.tsx
@frontend/src/components/dialogs/transmittal-dialog.tsx
@frontend/src/components/dialogs/finalize-dialog.tsx
@frontend/src/hooks/use-keyboard-shortcuts.ts
@frontend/src/hooks/use-document.ts
@frontend/src/lib/store.ts
@frontend/src/lib/utils/connector.ts
@app/api/routes.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Tooltips, nav counter fix, badge overflow, compact mode enhancement</name>
  <files>
    frontend/src/components/review/bottom-bar.tsx
    frontend/src/components/layout/header.tsx
    frontend/src/app/review/[sessionId]/page.tsx
    frontend/src/globals.css (or equivalent)
  </files>
  <action>
**Items 1, 2, 3, 7, 12 — all bottom-bar and layout-level visual fixes.**

**Item 1 — Filter pill tooltips:**
In `bottom-bar.tsx`, wrap each `FilterPill` with shadcn `Tooltip` (already installed at `@/components/ui/tooltip`). Add descriptive tooltip content:
- Risks: "Filter to paragraphs with risks"
- Revisions: "Filter to paragraphs with revisions"
- Flags: "Filter to flagged paragraphs"
Also add `aria-description` matching the tooltip text to each FilterPill button.
Add a visible "Filter:" label prefix before the pills group (small muted text).

**Item 2 — Missing tooltips on other controls:**
- Bottom bar "Finalize Redline" button: wrap with Tooltip "Export redline Word document with track changes". When disabled (no accepted revisions), add `title="Accept at least one revision to enable export"`.
- Bottom bar "Generate Transmittal" button: wrap with Tooltip "Generate client transmittal email". When disabled (no flags), add `title="Flag at least one item to enable transmittal"`.
- In `header.tsx`, the "Start Review" / "New" button does not appear to have a disabled state issue — skip unless found. Instead, check for any intensity slider reference and add tooltip if present. (The intensity slider may be in the settings dialog or sidebar — if not directly accessible, skip.)

**Item 3 — Navigation counter doesn't update with filters:**
In `bottom-bar.tsx`, the navigation counter currently shows `currentIndex + 1 of riskParaIds.length` which already counts risk paragraphs. The issue is that when filter pills (showRisks, showRevisions, showFlags) are toggled, the navigation list should reflect the active filter. Fix: create a `filteredParaIds` memo that computes the navigable set based on which filters are active:
- If `showRisks` is active: include paragraphs with risks
- If `showRevisions` is active: include paragraphs with revisions
- If `showFlags` is active: include paragraphs with flags
- Union of all active filters (if none active, show all risk paragraphs as default)
Replace `riskParaIds` with `filteredParaIds` for the counter display AND the prev/next navigation.

**Item 7 — Status badges overflow:**
In the bottom bar's severity summary pills container, add `max-w-[200px] overflow-hidden` or use `flex-wrap` to prevent pills from extending past the panel at wide viewports. Also add `shrink-0` to the filter pills container so it doesn't collapse.

**Item 12 — Compact mode more noticeable:**
Currently compact mode only changes padding in bottom-bar and sidebar. Enhance it:
- In `page.tsx`, the `.compact` class is applied to the root `div`. Add CSS rules (in globals.css or inline) for `.compact` that:
  - Reduce base font size: `.compact .document-container { font-size: 0.875rem; }`
  - Reduce sidebar header text: `.compact [role="tablist"] { font-size: 9px; }`
  - Tighter icon sizes in sidebar: `.compact .lucide { width: 14px; height: 14px; }`
  - Reduce header height: `.compact header[role="banner"] { height: 2.75rem; }`
  - Reduce bottom bar further spacing
- In `bottom-bar.tsx`, when `compactMode` is true, also reduce text size from `text-xs` to `text-[10px]` and icon sizes from `h-3 w-3` to `h-2.5 w-2.5` in filter pills.
  </action>
  <verify>
- `npm run build` in frontend/ passes
- Hover over filter pills to see tooltip text
- Toggle filter pills and verify navigation counter updates
- Toggle compact mode in settings and verify visible difference in font/icon/spacing
- Resize browser to 1920px wide, check severity badges don't overflow
  </verify>
  <done>
Filter pills have descriptive tooltips with aria-descriptions; nav counter reflects active filters; severity badges constrained at wide viewports; compact mode shows visible font/icon/spacing reduction; disabled Finalize/Transmittal buttons explain why they're disabled.
  </done>
</task>

<task type="auto">
  <name>Task 2: Keyboard accessibility — Escape sidebar, Enter/Space paragraphs, arrow key tabs</name>
  <files>
    frontend/src/hooks/use-keyboard-shortcuts.ts
    frontend/src/components/review/sidebar.tsx
    frontend/src/components/review/document-viewer.tsx
    frontend/src/components/keyboard-help.tsx
  </files>
  <action>
**Items 4, 5, 6 — keyboard accessibility fixes.**

**Item 4 — Escape closes sidebar:**
In `use-keyboard-shortcuts.ts`, the Escape handler currently only closes bottomSheet. Extend the priority chain:
```
if (store.bottomSheetOpen) { store.toggleBottomSheet(); return; }
if (store.sidebarOpen) { store.toggleSidebar(); return; }
```
This adds sidebar close as the second priority after bottom sheet.

**Item 5 — Enter/Space on document paragraphs:**
In `document-viewer.tsx`, within the main event handlers effect (around line 394), add a `keydown` handler on the container that listens for Enter and Space on `[data-para-id]` elements. Since the paragraphs are rendered via `dangerouslySetInnerHTML`, they already have `data-para-id` and presumably `role="button"` and `tabindex="0"` set by the HTML renderer. Add:
```typescript
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    const target = e.target as HTMLElement;
    const paraEl = target.closest<HTMLElement>('[data-para-id]');
    if (paraEl) {
      e.preventDefault();
      const paraId = paraEl.getAttribute('data-para-id');
      if (paraId) selectParagraph(paraId);
    }
  }
}
container.addEventListener('keydown', handleKeyDown);
// ... and remove in cleanup
```
NOTE: The existing `handleKeyDown` function in that effect only handles Escape on `document`. Rename it to `handleDocumentKeyDown` and add the new one on `container`.

**Item 6 — Arrow keys navigate sidebar tabs:**
In `sidebar.tsx`, the tab buttons are in a `role="tablist"` container (line ~208). Add an `onKeyDown` handler to the tablist `div` that implements ARIA tab navigation:
- ArrowLeft/ArrowUp: move to previous tab (wrap around)
- ArrowRight/ArrowDown: move to next tab (wrap around)
- Home: first tab
- End: last tab
When moving focus, call `setActiveTab(newTab)` and focus the new tab button using a ref or `document.querySelector`.
Also add `tabIndex={activeTab === tab.value ? 0 : -1}` to each tab button so only the active tab is in the tab order (roving tabindex pattern).

**Update keyboard help:**
In `keyboard-help.tsx`, add new entries to the Navigation section:
- "Close Sidebar/Panel" with key `Esc`  (already listed as "Close / Dismiss" — update description to be more specific: "Close active panel or dismiss")
- "Activate Paragraph" with keys `Enter` or `Space` (under a new "Document" section or in Navigation)
  </action>
  <verify>
- `npm run build` passes
- Press Escape while sidebar is open (and bottom sheet is closed) — sidebar closes
- Tab to a document paragraph and press Enter or Space — paragraph selects
- Focus a sidebar tab and press ArrowRight — next tab activates
- Press ? to open keyboard help — new shortcuts listed
  </verify>
  <done>
Escape closes sidebar when no higher-priority panel is open; Enter/Space activates document paragraphs matching their role="button"; sidebar tabs support arrow key navigation per ARIA authoring practices; keyboard help updated.
  </done>
</task>

<task type="auto">
  <name>Task 3: Transmittal fixes, revision truncation, finalized banner persistence</name>
  <files>
    frontend/src/components/dialogs/transmittal-dialog.tsx
    app/api/routes.py
    frontend/src/hooks/use-document.ts
  </files>
  <action>
**Items 8, 9, 10, 11, 13 — transmittal and backend fixes.**

**Item 8 — Transmittal subject line editable:**
In `transmittal-dialog.tsx`, replace the read-only subject display (line ~157-161):
```tsx
<p className="mt-0.5 text-sm font-medium">{subject || "\u00A0"}</p>
```
with an editable `Input` component:
```tsx
<Input
  value={subject}
  onChange={(e) => setSubject(e.target.value)}
  className="mt-0.5 text-sm font-medium h-8"
  placeholder="e.g., Redline Review: Contract Name"
/>
```
Import `Input` from `@/components/ui/input`.

**Item 9 — Strip markdown headers from transmittal body:**
In `app/api/routes.py` in the `get_transmittal` function (line ~1247 and ~1272), the email body uses `## Key Revisions Made` and `## Items for Your Review` — literal markdown headers that appear as raw text in email. Replace with plain text section headers:
- `"## Key Revisions Made"` -> `"KEY REVISIONS MADE"` followed by `"---"` (or just the all-caps header with a blank line)
- `"## Items for Your Review"` -> `"ITEMS FOR YOUR REVIEW"`
This keeps structure without markdown syntax.

**Item 10 — Empty flag notes in transmittal:**
In the same `get_transmittal` function (line ~1275), when building the flag line:
```python
note = flag.get('note', 'Flagged for review')
```
This already has a default. However, the issue is flags with an empty string `note=""` which bypasses the default. Fix:
```python
note = flag.get('note', '') or 'Flagged for review'
```
Also check `text_excerpt` — if the flag has a `text_excerpt`, append it as context when note is empty:
```python
note = flag.get('note', '') or flag.get('text_excerpt', '') or 'Flagged for review'
```

**Item 11 — Revision summary word-boundary truncation:**
In the same `get_transmittal` function (line ~1263), the rationale is truncated: `rationale[:100]`. Replace with word-boundary-aware truncation:
```python
def truncate_at_word(text, max_len=100):
    if len(text) <= max_len:
        return text
    truncated = text[:max_len]
    last_space = truncated.rfind(' ')
    if last_space > max_len * 0.6:  # Don't cut too short
        truncated = truncated[:last_space]
    return truncated + '...'
```
Use `truncate_at_word(rationale)` instead of `rationale[:100]`.
Also apply the same logic in `finalize-dialog.tsx` line ~206 where `rev.rationale.slice(0, 80)` is used:
```tsx
{rev.rationale.length > 80
  ? rev.rationale.slice(0, rev.rationale.lastIndexOf(' ', 80) > 50 ? rev.rationale.lastIndexOf(' ', 80) : 80) + '...'
  : rev.rationale}
```

**Item 13 — Finalized banner not persisted on page load:**
In `use-document.ts`, the `setSession` call (line ~57) only sets `targetFilename` and `hasPrecedent`. The backend `get_document` endpoint (routes.py line ~275) doesn't return `status`. Two options:
- **Option A (preferred, minimal):** Add `'status': session.get('status')` to the `get_document` response in `routes.py`, then read it in `use-document.ts`:
  ```typescript
  setSession({
    targetFilename: doc.filename,
    hasPrecedent: doc.has_precedent ?? false,
    status: doc.status ?? null,
  });
  ```
- Add `status` to the `DocumentResponse` type in `types.ts` if needed.
This ensures the finalized banner renders immediately on page load.
  </action>
  <verify>
- `npm run build` passes
- In transmittal dialog, subject line is an editable input
- Generate a transmittal — no `##` markdown headers in the body
- Create a flag with no note — transmittal shows the text excerpt or "Flagged for review"
- Check revision rationale truncation — no mid-word cuts
- Start a session, finalize it, reload the page — green "finalized" banner appears
  </verify>
  <done>
Transmittal subject line is editable via Input; email body uses plain text headers not markdown; empty flag notes show fallback text; revision summaries truncate at word boundaries; finalized banner appears on page reload by hydrating status from backend.
  </done>
</task>

<task type="auto">
  <name>Task 4: Connector line visual verification and improvement</name>
  <files>
    frontend/src/components/review/document-viewer.tsx
    frontend/src/lib/utils/connector.ts
  </files>
  <action>
**Item 14 — Connector line scroll/routing.**

The connector line connects a flag highlight in the document to the flag bubble on the right. Currently implemented via `calculateConnectorPath` which uses a cubic Bezier. Two known issues:

1. **Scroll tracking:** The connector updates via a scroll listener on `scrollParent` (line ~341-355 in document-viewer.tsx). Verify this works. If the connector SVG layer uses `position: absolute` within the container ref, it should scroll with the document naturally. The issue might be that `anchorRect` (the bubble position) is stored in viewport coordinates but the SVG layer uses container-relative coordinates. Check the `updateConnector` callback — if `bubbleContext.anchorRect` is viewport coords but `cRect` is subtracted, this should be correct. If not, fix by ensuring both start and end points are in the same coordinate space.

2. **Routing through text:** The current Bezier curve goes from highlight right-edge to bubble position. If they're at similar Y positions, the curve may be mostly horizontal and cross over text. Improve `calculateConnectorPath` to:
   - Add a minimum "escape" offset from the start point (push right by at least 20px before curving)
   - If start and end Y are similar (within 40px), add a slight vertical arc to avoid a flat line through text
   - Keep the existing org-chart style for larger vertical deltas

Updated `connector.ts`:
```typescript
export function calculateConnectorPath(
  startX: number, startY: number,
  endX: number, endY: number
): string {
  const deltaX = endX - startX;
  const deltaY = Math.abs(endY - startY);

  // Minimum escape distance from text before curving
  const escapeX = Math.min(30, deltaX * 0.3);

  if (deltaY < 40) {
    // Nearly horizontal — add a subtle arc to avoid flat line through text
    const midX = startX + deltaX / 2;
    const arcY = startY - 25; // arc above
    return `M ${startX} ${startY} Q ${midX} ${arcY}, ${endX} ${endY}`;
  }

  // Standard S-curve for vertical displacement
  const horizontalOffset = Math.max(deltaX * 0.5, 40);
  const cp1x = startX + horizontalOffset;
  const cp1y = startY;
  const cp2x = endX - horizontalOffset;
  const cp2y = endY;
  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}
```

Also verify the SVG layer CSS. The `flag-connector-layer` class should have `pointer-events: none` so it doesn't block text selection. Check globals.css for this class and add if missing.
  </action>
  <verify>
- `npm run build` passes
- Select text in a paragraph, click Flag, observe connector line from highlight to bubble
- Scroll the document — connector follows
- Test with flag on a paragraph near the same Y as the bubble — line arcs above instead of cutting through text
  </verify>
  <done>
Connector line routes cleanly with an arc for near-horizontal cases; scroll tracking verified; SVG layer doesn't block interaction.
  </done>
</task>

</tasks>

<verification>
- `cd frontend && npm run build` passes with no errors
- All 14 items addressed:
  1. Filter pill tooltips (Task 1)
  2. Missing tooltips on slider/disabled buttons (Task 1)
  3. Navigation counter updates with filters (Task 1)
  4. Escape closes sidebar (Task 2)
  5. Enter/Space on paragraphs (Task 2)
  6. Arrow keys navigate sidebar tabs (Task 2)
  7. Badge overflow fixed (Task 1)
  8. Transmittal subject editable (Task 3)
  9. No markdown in transmittal (Task 3)
  10. Empty flag fallback text (Task 3)
  11. Word-boundary truncation (Task 3)
  12. Compact mode noticeable (Task 1)
  13. Finalized banner persisted (Task 3)
  14. Connector line routing (Task 4)
</verification>

<success_criteria>
All 14 Tier 2 refinement items implemented. Build passes. Each item is visually or functionally verifiable per its description.
</success_criteria>
