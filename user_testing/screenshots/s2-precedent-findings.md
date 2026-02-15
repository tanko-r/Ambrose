# QA Report: Precedent Panel Testing (Session 2)

**Tester Persona**: Sarah Chen -- mid-career real estate attorney, 8 years experience
**Date**: 2026-02-11
**Scope**: Precedent split-view panel -- opening, rendering, navigation, resize, lock/unlock, close, interactions

---

## Summary

The precedent panel is a well-architected feature with solid core functionality. The split-view, navigator modes (sidebar/drawer/ghost), search, match-only filter, lock/unlock, text selection tooltip, and keyboard shortcuts are all implemented. However, there are several issues that would frustrate a billable-hour attorney: the precedent document is nearly unreadable at default width in sidebar navigator mode, auto-scroll to the clicked clause does not work, and there is no way to access clause analysis while the precedent panel is open.

---

## Issues Found

### ISSUE P-1: Precedent document content unreadable in default sidebar navigator mode
- **What tested**: Opened precedent panel, observed document rendering at default 60/40 split with right-sidebar navigator
- **Expected**: Precedent document text flows in readable paragraphs
- **Actual**: The 40% panel is further split by the 220px navigator sidebar, leaving only ~170px for document content. Text wraps word-by-word, making it nearly unreadable (e.g., "PURCHASE AND SALE AGREEMENT" renders as 4 separate lines)
- **Severity**: HIGH -- defeats the purpose of side-by-side comparison
- **Workaround**: Switch navigator to drawer or ghost mode for much better readability
- **Screenshot**: `s2-precedent-document-rendering.png`, `s2-precedent-nav-click-scroll.png`
- **Recommendation**: Default to drawer or ghost navigator mode, or increase the precedent panel default width to 50%

### ISSUE P-2: Auto-scroll to clicked related clause does not work
- **What tested**: Selected clause 5A in target, clicked RELATED tab, clicked "3.1 Due Diligence Period" card
- **Expected**: Precedent document scrolls to clause 3.1 and highlights it
- **Actual**: Precedent panel opens but stays at the top of the document (scrollTop=0). The initial scroll target is set but the scroll does not execute
- **Severity**: MEDIUM -- user must manually find the clause in a long precedent document
- **Screenshot**: `s2-precedent-panel-opened.png`
- **Root cause**: In `precedent-panel.tsx`, `initialScrollDone` is a useRef guard. Combined with React strict mode and timing, the scroll target may be cleared before the content fully renders. The `requestAnimationFrame` call may fire before the HTML is actually in the DOM.

### ISSUE P-3: No way to access clause analysis sidebar while precedent panel is open
- **What tested**: With precedent panel open, looked for way to view RISKS/RELATED/DEFINITIONS/FLAGS tabs
- **Expected**: Some toggle or collapsed sidebar icon to reopen the right sidebar
- **Actual**: When a related clause card is clicked, the code calls `if (sidebarOpen) toggleSidebar()` which closes the right sidebar. There is no visible control to reopen it while the precedent panel is open. The left navigator has a "Show navigator" toggle but the right sidebar does not.
- **Severity**: MEDIUM -- attorney cannot view risk analysis and precedent side-by-side
- **Screenshot**: `s2-precedent-three-panel-layout.png`
- **Recommendation**: Either keep the sidebar open (collapsible) or add a toggle icon for the right sidebar, similar to the left navigator's "Show navigator" tab

### ISSUE P-4: Ctrl+Shift+P keyboard shortcut only works to close, not to open
- **What tested**: With precedent panel closed, pressed Ctrl+Shift+P to open it
- **Expected**: Panel toggles open
- **Actual**: Nothing happens. The keyboard handler is registered inside the `PrecedentPanel` component, which is only mounted when the panel is already open.
- **Severity**: LOW -- minor convenience issue
- **Recommendation**: Move the keyboard shortcut handler to the parent review page component so it works regardless of panel state

### ISSUE P-5: minSize constraint on precedent panel not properly enforced
- **What tested**: Dragged the resize handle all the way to the right
- **Expected**: Precedent panel stops shrinking at 25% of viewport width (320px at 1280px viewport)
- **Actual**: Panel shrinks to ~216px (about 17% of viewport), with document content area completely disappearing and only the navigator partially visible
- **Severity**: LOW -- edge case, but makes the panel useless if accidentally dragged too far
- **Screenshot**: `s2-precedent-split-min-size.png`

### ISSUE P-6: Section number concatenation in navigator
- **What tested**: Viewed navigator entries in match-only filter mode
- **Expected**: Clean section numbers like "4.3.4"
- **Actual**: Some entries show concatenated numbers like "4.34.4" or "16.516.6" (merging parent and child section references)
- **Severity**: LOW -- cosmetic but could confuse an attorney looking for specific section numbers
- **Screenshot**: `s2-precedent-nav-match-filter.png`

---

## What Works Well

### W-1: Three navigator position modes
The sidebar, bottom-drawer, and ghost overlay modes are excellent. The drawer mode gives the best balance of document readability and navigation access. The ghost mode's hover-to-reveal animation is polished and professional.

### W-2: Text selection tooltip
Selecting text in the precedent document triggers a floating tooltip with Copy, Use in Revision, and Flag for Reference actions. Well-positioned using @floating-ui, dismisses on click-away and scroll. This is exactly the kind of workflow an attorney needs.

### W-3: Search and match-only filter
The navigator search filters clauses in real-time. The match-only toggle (filter icon) shows only clauses related to the currently selected target clause, with blue dot indicators. Very useful for quickly finding relevant precedent language.

### W-4: Draggable resize divider
The react-resizable-panels separator works smoothly with hover/active visual feedback. The 60/40 default split is reasonable.

### W-5: Lock/unlock behavior
The lock toggle correctly freezes the related clause highlights so the user can navigate the target document without losing their place in the precedent. Visual feedback is clear (filled blue button when locked, ghost outline when unlocked).

### W-6: Close behavior (X and Escape)
Both the X button and Escape key close the panel and restore the layout cleanly. The close action also properly cleans up lock state and scroll targets.

### W-7: Persistent panel across navigation
The precedent panel stays open when navigating to different clauses in the target document (via navigator clicks or bottom bar arrows). Related clause indicators in the precedent navigator update dynamically.

### W-8: Related clause pulse animation
New related clause matches briefly pulse/highlight in the precedent navigator, drawing the eye to changes when navigating between target clauses.

---

## Screenshots Reference

| Screenshot | Description |
|---|---|
| s2-precedent-initial-state.png | App loaded, no clause selected |
| s2-precedent-clause-5A-selected.png | Clause 5A selected, RISKS tab showing |
| s2-precedent-related-tab-view.png | RELATED tab showing related clause cards |
| s2-precedent-panel-opened.png | Precedent panel opened (no auto-scroll) |
| s2-precedent-document-rendering.png | Precedent doc rendering (narrow, word-wrap) |
| s2-precedent-split-resized.png | Split dragged to give more space to precedent |
| s2-precedent-split-min-size.png | Split dragged to minimum (content disappears) |
| s2-precedent-selection-tooltip.png | Text selection tooltip (Copy/Use/Flag) |
| s2-precedent-nav-search.png | Navigator search for "indemnif" |
| s2-precedent-nav-match-filter.png | Match-only filter showing related clauses |
| s2-precedent-nav-drawer-mode.png | Navigator in bottom-drawer position |
| s2-precedent-nav-ghost-mode.png | Navigator in ghost (hidden) mode |
| s2-precedent-nav-ghost-hover.png | Ghost navigator revealed on hover |
| s2-precedent-locked-state.png | Lock toggle activated |
| s2-precedent-panel-closed.png | Panel closed, layout restored |
| s2-precedent-with-navigator.png | Panel open with left navigator visible |
| s2-precedent-navigate-different-clause.png | Navigated to different clause, panel persists |
| s2-precedent-three-panel-layout.png | Full layout with left nav + doc + precedent |

---

## Priority Recommendations

1. **Fix auto-scroll** (P-2) -- This is the most impactful fix. When clicking "3.1 Due Diligence Period" in the RELATED tab, the user expects to land right on that clause in the precedent, not at the top of a 400+ paragraph document.

2. **Default to drawer/ghost navigator mode** (P-1) -- The sidebar navigator mode makes the precedent document nearly unreadable. Drawer mode provides the best default experience.

3. **Add right sidebar toggle** (P-3) -- An attorney reviewing a contract needs to see risks AND precedent at the same time. A small toggle tab (like the left navigator's "Show" tab) would solve this.

4. **Move keyboard shortcut to parent** (P-4) -- Quick fix to register the Ctrl+Shift+P handler at the page level.
