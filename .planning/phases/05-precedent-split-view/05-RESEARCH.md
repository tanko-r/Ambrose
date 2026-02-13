# Phase 5: Precedent Split View - Research

**Researched:** 2026-02-08
**Domain:** Resizable split pane layout, precedent document rendering, related clause matching, text selection tooltip, clause lock state management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Panel Trigger & Layout
- Precedent opens from the "Related" tab in the sidebar — clicking a related clause link opens the precedent panel scrolled to that clause
- If no related clauses found for the current paragraph, show a single "Open Precedent" link
- When precedent opens, sidebar auto-collapses to a thin restore tab on the left edge (hover/click expands sidebar as overlay without closing precedent)
- Default split ratio: 60% main document / 40% precedent panel
- User can resize panes; sizes persist to localStorage across sessions
- Precedent panel has a filename header bar showing the precedent document name + close button
- Close via X button in header OR keyboard shortcut
- Bottom sheet (revision editor) and precedent panel coexist — bottom sheet overlays the bottom of both panes

#### Related Clause Behavior
- Related clauses auto-update when user clicks a paragraph in the main document (no debounce, immediate)
- NO auto-scroll in precedent content area — highlights pulse in the precedent navigator to draw attention, but the content view stays where the user left it
- Clause lock: user can lock the precedent view to a specific clause via lock icon toggle. While locked, navigating the main doc still triggers related clause highlights (pulsing in navigator) but doesn't change which clause the content is focused on
- Unlock by clicking the lock icon again; closing the panel also clears the lock
- Match confidence scores are NOT shown to the user — matches are sorted by confidence so best matches appear first (subtle sort order)
- Clicking a related clause in the navigator scrolls the precedent content to that clause with a brief flash/pulse animation

#### Precedent Navigator
- Three position modes (user's choice, persisted to localStorage): right sidebar (default), bottom drawer, or toggle overlay
- Search box at top with text filter + toggle to show only paragraphs with related clause matches
- Paragraph captions: AI determines during initial analysis (Phase B pipeline) whether each paragraph has a descriptive caption (short phrase followed by a period, not a grammatical sentence). If yes, display that caption. If not, AI generates a short descriptive caption.
- Hierarchical display with indentation reflecting document structure (e.g., 3.2(a) indented under 3.2)

#### Copy & Reference Flow
- Text selection in precedent shows a floating tooltip with actions: Copy, "Use in Revision", "Flag for Reference"
- "Use in Revision" adds selected precedent text to a generation queue for the target clause. When user generates (or regenerates) a revision, the prompt includes instructions to incorporate the queued precedent language.
- Generate button shows a badge count of queued precedent snippets; click to expand and see/remove them before generating
- "Flag for Reference" creates an attorney flag with a reference link to the precedent clause location
- Flag system has two categories: attorney flags and client flags (not a generic flag list)
- No drag-and-drop from precedent to revision editor — the queue is the primary workflow

### Claude's Discretion
- Related clause highlight styling in the precedent content area (color/border treatment fitting the design system)
- Match indicator styling in the navigator (how matched items are visually distinct from unmatched)
- Exact keyboard shortcut for closing precedent panel
- Animation/transition details for panel open/close
- Navigator position toggle UI (button group, dropdown, etc.)
- Pulse animation design for related clause highlights in navigator

### Deferred Ideas (OUT OF SCOPE)
- **Reusable lock pattern across UI** -- Phase 7 polish item
- **Attorney flags vs client flags distinction** -- Phase 6 flag dialog design
- **Paragraph caption generation in analysis pipeline** -- Backend enhancement
</user_constraints>

## Summary

Phase 5 replaces `precedent.js` (1,140 lines of vanilla JS using Split.js) with a React-based precedent split view. The backend is fully complete: `GET /api/precedent/{session_id}` returns parsed precedent content, `GET /api/precedent/{session_id}/html` returns high-fidelity HTML, and `GET /api/precedent/{session_id}/related/{para_id}` returns TF-IDF-matched related clauses with confidence scores. The Zustand store already has `precedentPanelOpen`, `togglePrecedentPanel`, and `precedentHtml` state. The API client already has `getPrecedent`, `getPrecedentHtml`, and `getRelatedClauses` functions typed.

The core technical challenge is the multi-panel layout. The project already has `react-resizable-panels@4.6.2` installed but not yet used. This library's v4 API exports `Group`, `Panel`, `Separator`, and `useDefaultLayout` (not the old v3 `PanelGroup`/`PanelResizeHandle`/`autoSaveId` API). The split layout wraps the existing `DocumentViewer` and the new `PrecedentPanel` inside a `Group` component, with `useDefaultLayout` providing automatic localStorage persistence. A secondary challenge is the text selection floating tooltip for copy/use-in-revision/flag actions, which can be built using `@floating-ui/react-dom` (already installed as a Radix UI transitive dependency) with a virtual element positioned at the selection range.

The phase has significant state management needs: clause lock state, precedent snippet queue (for "Use in Revision"), navigator position mode, and related clause cache. These fit naturally into the existing Zustand store pattern. The precedent navigator is an independent subcomponent with three position modes (right sidebar, bottom drawer, overlay toggle) that reuses the hierarchical outline pattern from the existing `NavigationPanel`.

**Primary recommendation:** Use `react-resizable-panels` v4 `Group`/`Panel`/`Separator` with `useDefaultLayout` for the split pane; build the text selection tooltip using `@floating-ui/react-dom` `useFloating` with a virtual element from `Range.getBoundingClientRect()`; extend Zustand store with precedent-specific state slices.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-resizable-panels | 4.6.2 | Resizable split pane layout | Already in package.json; 1530+ npm dependents; built for exactly this use case |
| @floating-ui/react-dom | 2.1.7 | Text selection floating tooltip positioning | Already installed as Radix UI transitive dep; provides `useFloating`, virtual element support |
| zustand | 5.0.11 | State management for lock, queue, navigator mode | Already used throughout; precedent state fits same pattern |
| lucide-react | 0.563.0 | Icons (Lock, Unlock, Copy, FileText, X, ChevronRight, Search, Filter, Columns) | Already used throughout |
| sonner | 2.0.7 | Toast notifications for copy/flag actions | Already used throughout |

### Core (Already Available via shadcn)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| shadcn Badge | Match count, section refs in navigator | Related clause indicators |
| shadcn Button | Close, lock/unlock, position mode toggle, action buttons | Panel header, navigator controls |
| shadcn Input | Search box in precedent navigator | Filter precedent paragraphs |
| shadcn Skeleton | Loading state for precedent content | While fetching precedent HTML |
| shadcn Tooltip | Static tooltips on lock icon, position toggle | Brief explanatory tooltips |

### No Additional Dependencies Needed
The text selection floating tooltip does NOT require installing `@floating-ui/react` (the full interactive package). The `@floating-ui/react-dom` package already provides `useFloating`, `offset`, `flip`, `shift`, and `autoUpdate` -- everything needed for positioning. The tooltip UI itself is just a styled div with button actions, not a complex interactive floating element.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-resizable-panels | Split.js (as in vanilla version) | Split.js is not React-native, requires imperative DOM manipulation, already moved away from it |
| @floating-ui/react-dom | Radix Popover | Radix Popover requires a trigger element, doesn't work with arbitrary text selections |
| Custom text selection tooltip | react-text-selection-popover (npm) | Last updated 2020, 18 monthly downloads, dead project |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/
  components/review/
    precedent-panel.tsx            # NEW: Main precedent panel (header + content + navigator)
    precedent-content.tsx          # NEW: Rendered precedent HTML with highlight logic
    precedent-navigator.tsx        # NEW: Paragraph-level navigator (3 position modes)
    precedent-selection-tooltip.tsx # NEW: Floating tooltip for text selection actions
    split-layout.tsx               # NEW: Group/Panel wrapper around DocumentViewer + PrecedentPanel
  hooks/
    use-precedent.ts               # NEW: Precedent data loading, related clauses, snippet queue
  lib/
    store.ts                       # MODIFY: Add precedent state slice
    types.ts                       # MODIFY: Add PrecedentSnippet, NavigatorPosition types
```

### Pattern 1: react-resizable-panels v4 Split Layout
**What:** Wrap the document viewer and precedent panel in a `Group` component with `orientation="horizontal"`.
**When to use:** When precedent panel is open.
**Key v4 API details:** In v4, the component names changed from `PanelGroup`/`PanelResizeHandle` to `Group`/`Separator`. Size values are strings with units (e.g., `"60%"`) not bare numbers. Persistence is via `useDefaultLayout` hook (not `autoSaveId` prop).

```typescript
// split-layout.tsx
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";

export function SplitLayout({ children }: { children: React.ReactNode }) {
  const precedentPanelOpen = useAppStore((s) => s.precedentPanelOpen);

  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    groupId: "precedent-split",
    storage: localStorage,
  });

  if (!precedentPanelOpen) {
    // No split -- render document viewer at full width
    return <>{children}</>;
  }

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChange={onLayoutChange}
    >
      <Panel id="main-doc" defaultSize="60%" minSize="35%">
        {children}
      </Panel>
      <Separator id="split-handle" />
      <Panel id="precedent" defaultSize="40%" minSize="25%">
        <PrecedentPanel />
      </Panel>
    </Group>
  );
}
```

### Pattern 2: Text Selection Floating Tooltip with Virtual Element
**What:** Show a floating action bar (Copy / Use in Revision / Flag for Reference) when the user selects text in the precedent panel.
**When to use:** On `mouseup` / `selectionchange` events within the precedent content area.

```typescript
// precedent-selection-tooltip.tsx
import { useFloating, offset, flip, shift } from "@floating-ui/react-dom";

function useSelectionTooltip(containerRef: React.RefObject<HTMLDivElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: "top",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setIsOpen(false);
        return;
      }

      // Check selection is within our container
      if (!container.contains(selection.anchorNode)) {
        setIsOpen(false);
        return;
      }

      setSelectedText(selection.toString().trim());

      // Create virtual element from selection range
      const range = selection.getRangeAt(0);
      refs.setPositionReference({
        getBoundingClientRect: () => range.getBoundingClientRect(),
        getClientRects: () => range.getClientRects(),
      });

      setIsOpen(true);
    };

    container.addEventListener("mouseup", handleMouseUp);
    return () => container.removeEventListener("mouseup", handleMouseUp);
  }, [containerRef, refs]);

  return { isOpen, selectedText, floatingRef: refs.setFloating, floatingStyles };
}
```

### Pattern 3: Sidebar Auto-Collapse with Restore Tab
**What:** When precedent opens, the sidebar (380px) collapses to a thin edge tab (hover to expand as overlay). When precedent closes, sidebar restores.
**When to use:** Triggered by `precedentPanelOpen` state change.

```typescript
// In the review page layout, the sidebar rendering is conditional:
// - If precedentPanelOpen && sidebarOpen: render sidebar as a fixed overlay (z-50)
// - If precedentPanelOpen && !sidebarOpen: render thin restore tab
// - If !precedentPanelOpen: render sidebar normally in flex layout

// The sidebar component already has a collapsed state (PanelRightOpen button).
// The key change is: when precedent opens, force sidebarOpen=false and show
// a thin tab. The sidebar overlay on hover/click is a z-50 positioned element
// that doesn't affect the split layout.
```

### Pattern 4: Clause Lock State Machine
**What:** A lock toggle that freezes the precedent view on a specific clause. Related clause queries still run on paragraph selection changes, but the precedent content area stays focused on the locked clause.
**When to use:** User clicks lock icon in the precedent header.

```typescript
// State in Zustand store:
interface PrecedentState {
  lockedParaId: string | null;       // null = unlocked
  lockedRelatedClauses: RelatedClause[] | null; // cached clauses for locked para
}

// In use-precedent.ts hook:
// When user selects a paragraph in the main doc:
// 1. Always fetch related clauses for the new para (for navigator pulse highlights)
// 2. If NOT locked: update precedent content focus to first match
// 3. If locked: only update navigator highlights (pulse), don't touch content scroll
```

### Pattern 5: Precedent Snippet Queue
**What:** A queue of text snippets selected from the precedent, attached to a target paragraph, that get sent along with the next revision generation request.
**When to use:** User selects text in precedent, clicks "Use in Revision".

```typescript
// State in Zustand store:
interface PrecedentSnippetQueue {
  snippets: PrecedentSnippet[];  // ordered list of queued snippets
}

interface PrecedentSnippet {
  id: string;                     // unique ID
  text: string;                   // selected text
  sourceParagraphId: string;      // which precedent paragraph it came from
  sourceSection: string;          // section ref for display
  targetParaId: string;           // which target paragraph it's queued for
  timestamp: string;
}

// When revision is generated, pass snippets as custom_instruction:
// "Incorporate the following precedent language: [snippet texts]"
```

### Anti-Patterns to Avoid
- **Rendering precedent HTML inside React reconciliation:** The precedent HTML comes from the backend as a pre-rendered string. Use `dangerouslySetInnerHTML` with imperative highlight/click handlers (same pattern as `DocumentViewer`). Do NOT try to parse it into React components.
- **Storing panel sizes in Zustand:** Use `useDefaultLayout` from react-resizable-panels -- it handles localStorage persistence internally. Don't duplicate this logic in the Zustand store.
- **Debouncing related clause fetches:** The user decision explicitly says "no debounce, immediate." The existing `RelatedClausesTab` already has a cache (`cacheRef`) that prevents redundant API calls for the same paragraph.
- **Showing confidence scores to user:** The user explicitly said NOT to show match percentages. Sort by score but don't display it.
- **Auto-scrolling precedent content on paragraph change:** The user explicitly said NO auto-scroll. Only the navigator highlights pulse; the content stays where the user left it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable split pane | Custom CSS resize + drag handlers | react-resizable-panels v4 `Group`/`Panel`/`Separator` | Handles min/max constraints, persistence, keyboard accessibility, cursor management, SSR |
| Panel size persistence | Custom localStorage read/write | `useDefaultLayout` hook from react-resizable-panels | Already handles serialization, debouncing saves, and restoration |
| Floating tooltip positioning | Manual `getBoundingClientRect` + absolute positioning | `@floating-ui/react-dom` `useFloating` with virtual element | Handles viewport edge collision, scroll anchoring, flip/shift middleware |
| Related clause caching | Custom Map/WeakMap in component | Extend existing `cacheRef` pattern from `RelatedClausesTab` | Already proven pattern in the codebase |

**Key insight:** The split pane layout seems simple but has many edge cases (min size constraints, keyboard drag, cursor styles during resize, window resize recalculation, SSR hydration). react-resizable-panels handles all of these. Similarly, floating tooltip positioning near text selections requires viewport collision detection that `@floating-ui/react-dom` already provides.

## Common Pitfalls

### Pitfall 1: react-resizable-panels v4 Import Confusion
**What goes wrong:** Using v3 import names (`PanelGroup`, `PanelResizeHandle`, `autoSaveId`) with v4 which exports `Group`, `Separator`, `useDefaultLayout`.
**Why it happens:** Most blog posts and StackOverflow answers reference v3. The shadcn/ui resizable wrapper uses v3 names internally.
**How to avoid:** Import directly from `react-resizable-panels` using v4 names: `Group`, `Panel`, `Separator`, `useDefaultLayout`, `usePanelRef`, `useGroupRef`. Do NOT install or use the shadcn `resizable` wrapper component (it has compatibility issues with v4).
**Warning signs:** TypeScript errors about missing exports, runtime errors about undefined components.

### Pitfall 2: Sidebar Overlay Z-Index Conflicts
**What goes wrong:** The sidebar overlay (when expanded during precedent view) sits behind the split pane or the revision bottom sheet.
**Why it happens:** The revision sheet uses `z-50`. The sidebar needs to layer above the document but below modal dialogs.
**How to avoid:** Use `z-40` for the sidebar overlay (below the `z-50` revision sheet). The thin restore tab should be `z-30`.
**Warning signs:** Sidebar appearing behind document content, or blocking the revision sheet.

### Pitfall 3: Text Selection Tooltip Disappearing on Scroll
**What goes wrong:** User selects text, tooltip appears, then scrolls -- tooltip stays at old position or disappears.
**Why it happens:** The virtual element's `getBoundingClientRect` returns stale coordinates after scroll.
**How to avoid:** Pass `whileElementsMounted: autoUpdate` to `useFloating` to recalculate position on scroll/resize. Also dismiss the tooltip on scroll since the selection often collapses on scroll anyway.
**Warning signs:** Tooltip floating in wrong position after scroll, or persisting after selection is gone.

### Pitfall 4: Precedent HTML Click Handlers Not Attaching
**What goes wrong:** Clicking paragraphs in the precedent HTML does nothing (no click event fires).
**Why it happens:** The precedent HTML is rendered with `dangerouslySetInnerHTML` and click handlers must be attached imperatively after render. If the effect runs before the HTML is painted, `querySelectorAll` finds nothing.
**How to avoid:** Use `requestAnimationFrame` in the `useEffect` that attaches click handlers (same pattern as `DocumentViewer.attachClickHandlers`).
**Warning signs:** Console logs showing 0 elements found by `querySelectorAll("[data-para-id]")`.

### Pitfall 5: Related Clause Cache Stale After Lock/Unlock
**What goes wrong:** After unlocking a clause, the navigator shows stale highlights because the cache returns old data for the current paragraph.
**Why it happens:** The cache keyed by paraId returns the cached result even though the lock state has changed.
**How to avoid:** When unlocking, immediately re-fetch related clauses for the currently selected paragraph (bypass cache). The lock/unlock action should trigger a fresh fetch.
**Warning signs:** Navigator highlights not updating after unlock.

### Pitfall 6: Bottom Sheet Not Spanning Both Panes
**What goes wrong:** The revision bottom sheet only covers the main document pane, leaving a gap over the precedent pane.
**Why it happens:** The bottom sheet is positioned with `fixed inset-x-0` but if it's inside a flex container, it may not span the full width.
**How to avoid:** The `RevisionSheet` component already uses `fixed inset-x-0 bottom-0` which spans the full viewport. Since it's rendered outside the `Group` (in the review page, not inside a `Panel`), it naturally overlays both panes. Keep it at the page level, not inside the split layout.
**Warning signs:** Bottom sheet appearing only under one pane.

## Code Examples

Verified patterns from the existing codebase and library documentation:

### Loading Precedent Data (from existing API client)
```typescript
// Source: frontend/src/lib/api.ts (already implemented)
import { getPrecedent, getPrecedentHtml, getRelatedClauses } from "@/lib/api";

// In use-precedent.ts hook:
const [precData, precHtml] = await Promise.all([
  getPrecedent(sessionId),
  getPrecedentHtml(sessionId).catch(() => null),
]);
// precData: PrecedentResponse { content, sections, defined_terms, metadata, filename }
// precHtml: string (full HTML) or null
```

### Related Clauses Response Shape (from matching_service.py)
```typescript
// The API returns clauses with these fields (from matching_service.py line 208-216):
interface MatchedClause {
  id: string;          // precedent paragraph ID (note: 'id' not 'para_id')
  text: string;        // full paragraph text
  section_ref: string; // e.g., "3.2(a)"
  caption: string | null; // section caption if available
  hierarchy: SectionHierarchyItem[];
  score: number;       // 0-1 boosted similarity (NOT shown to user, used for sort)
  base_score: number;  // raw TF-IDF score
}

// IMPORTANT: The matching_service returns 'id' not 'para_id' as the field name.
// But the RelatedClause TypeScript type uses 'para_id' and 'similarity'.
// The API route may transform these. Verify the actual response shape.
```

### Existing RelatedClause Type (frontend types.ts)
```typescript
// Source: frontend/src/lib/types.ts line 273-278
export interface RelatedClause {
  para_id: string;       // note: frontend uses 'para_id'
  section_ref: string;
  text: string;
  similarity: number;    // note: frontend uses 'similarity' not 'score'
}
```

### Imperative Panel Control (v4 API)
```typescript
// Source: Verified via node_modules inspection
import { usePanelRef } from "react-resizable-panels";

function PrecedentPanel() {
  const panelRef = usePanelRef();

  // Programmatic panel control:
  panelRef.collapse();        // Collapse panel
  panelRef.expand();          // Expand panel
  panelRef.resize(40);        // Resize to 40%
  panelRef.getSize();         // Get current size
  panelRef.isCollapsed();     // Check collapsed state
  panelRef.isExpanded();      // Check expanded state
}
```

### Document Viewer Pattern (existing codebase reference)
```typescript
// Source: frontend/src/components/review/document-viewer.tsx
// Pattern for attaching imperative handlers to dangerouslySetInnerHTML content:
useEffect(() => {
  if (documentHtml) {
    requestAnimationFrame(() => {
      attachClickHandlers();
      updateParagraphStates();
    });
  }
}, [documentHtml, attachClickHandlers, updateParagraphStates]);
```

### Virtual Element for Text Selection (floating-ui pattern)
```typescript
// Source: @floating-ui/react-dom docs + floating-ui.com/docs/virtual-elements
import { useFloating, offset, flip, shift } from "@floating-ui/react-dom";

const { refs, floatingStyles } = useFloating({
  placement: "top",
  middleware: [offset(8), flip(), shift({ padding: 8 })],
});

// Position at text selection:
const range = selection.getRangeAt(0);
refs.setPositionReference({
  getBoundingClientRect: () => range.getBoundingClientRect(),
  getClientRects: () => range.getClientRects(),
});
```

## State of the Art

| Old Approach (vanilla JS) | Current Approach (React) | When Changed | Impact |
|---|---|---|---|
| Split.js for resizable panes | react-resizable-panels v4 `Group`/`Panel`/`Separator` | v4 released late 2024 | React-native, SSR support, hook-based persistence |
| Manual localStorage for split sizes | `useDefaultLayout` hook | v4 API | Built-in debounced persistence, no custom code needed |
| `PanelGroup`/`PanelResizeHandle` (v3) | `Group`/`Separator` (v4) | v4 breaking change | Must use v4 names; v3 names don't exist |
| `autoSaveId` prop (v3) | `useDefaultLayout` hook (v4) | v4 breaking change | Hook-based, supports custom storage backends |
| `direction` prop (v3) | `orientation` prop (v4) | v4 breaking change | Aligns with ARIA orientation attribute |
| Numeric sizes (v3): `defaultSize={50}` | String sizes (v4): `defaultSize="50%"` | v4 breaking change | Supports px, rem, em, vh, vw units |
| Custom tooltip positioning | `@floating-ui/react-dom` with virtual element | Stable since 2023 | Collision detection, auto-update, middleware pipeline |

**Deprecated/outdated:**
- Split.js: Still maintained but not React-native; the project already uses react-resizable-panels
- shadcn Resizable wrapper: Has known compatibility issues with react-resizable-panels v4 (GitHub issues #9136, #9197, #9462). Use the library directly.

## Open Questions

1. **Precedent paragraph caption generation**
   - What we know: CONTEXT.md says captions should be generated during Phase B analysis pipeline
   - What's unclear: This backend enhancement is listed as a deferred idea. Without it, the navigator won't have AI-generated captions.
   - Recommendation: For Phase 5, fall back to displaying the first ~60 characters of paragraph text as the caption (same as the vanilla JS `precedent.js` approach). Add a `caption` field to the navigator item type so it's ready to receive AI-generated captions when the backend is updated.

2. **Field name mismatch between backend and frontend types**
   - What we know: `matching_service.py` returns `{ id, score }` but `types.ts` defines `RelatedClause` with `{ para_id, similarity }`. The API route may or may not transform these.
   - What's unclear: Whether routes.py transforms the matching service output before sending the JSON response.
   - Recommendation: Test the actual API response during implementation. If there's a mismatch, either update the TypeScript type or add a transform in the API client.

3. **Navigator position mode complexity**
   - What we know: Three modes (right sidebar, bottom drawer, overlay toggle) with localStorage persistence.
   - What's unclear: The exact UX for switching between modes and how each mode interacts with the split layout.
   - Recommendation: Start with the default mode (right sidebar within the precedent panel). Add bottom drawer and overlay toggle as progressive enhancements. All three share the same navigator list component, just different container/positioning.

4. **Precedent snippet queue integration with revision generation**
   - What we know: The queue adds context to the revision prompt via `custom_instruction`.
   - What's unclear: The exact prompt format for incorporating precedent snippets.
   - Recommendation: Store snippets in Zustand, format them as a JSON block in `custom_instruction` when calling `revise()`. The backend already accepts `custom_instruction` as a free-text field.

## Discretion Recommendations

### Related Clause Highlight Styling
**Recommendation:** Use a left border + subtle background tint, consistent with the existing document viewer risk highlighting pattern.
```css
/* In precedent content area */
[data-para-id].related-clause {
  border-left: 3px solid oklch(0.546 0.215 264);  /* primary blue */
  background: oklch(0.95 0.02 264 / 0.15);        /* very light blue wash */
}
```

### Match Indicator in Navigator
**Recommendation:** A small filled circle (primary blue) to the left of matched items, with unmatched items having no indicator. This is subtle and avoids visual clutter.
```
  3.2  Purchase Price         # no indicator
  * 3.3  Earnest Money        # blue dot = matched
  3.4  Due Diligence          # no indicator
  * 3.5  Closing Conditions   # blue dot = matched
```

### Keyboard Shortcut for Closing Precedent
**Recommendation:** `Escape` key when precedent panel is focused. This is consistent with modal/panel close patterns across the app. Add `Ctrl+Shift+P` (or `Cmd+Shift+P`) as a toggle shortcut.

### Animation/Transition for Panel Open/Close
**Recommendation:** CSS transition on the panel width (300ms ease-in-out). When opening, the precedent panel animates from 0% to its target width. When closing, it animates back to 0%. react-resizable-panels handles the resize smoothly; the transition applies to the initial mount/unmount.

### Navigator Position Toggle UI
**Recommendation:** A segmented button group (3 small icon buttons: sidebar icon, drawer icon, overlay icon) in the navigator header. Use lucide icons: `PanelRight` (sidebar), `PanelBottom` (drawer), `Layers` (overlay).

### Pulse Animation for Related Clause Highlights in Navigator
**Recommendation:** CSS keyframe animation that briefly scales the background opacity from 0 to 0.3 and back over 1.5 seconds, repeating twice. Applied via a `pulse-highlight` class added when related clauses update.
```css
@keyframes clause-pulse {
  0%, 100% { background-color: transparent; }
  50% { background-color: oklch(0.546 0.215 264 / 0.15); }
}
.pulse-highlight {
  animation: clause-pulse 750ms ease-in-out 2;
}
```

## Sources

### Primary (HIGH confidence)
- **react-resizable-panels v4 exports:** Verified by inspecting `node_modules/react-resizable-panels` -- exports `Group`, `Panel`, `Separator`, `useDefaultLayout`, `usePanelRef`, `useGroupRef`, `useGroupCallbackRef`, `usePanelCallbackRef`, `isCoarsePointer`
- **@floating-ui/react-dom exports:** Verified by inspecting `node_modules/@floating-ui/react-dom` -- exports `useFloating`, `autoUpdate`, `offset`, `flip`, `shift`, `inline`, `computePosition`, etc.
- **Existing codebase:** All component patterns, store shape, API client functions, types verified by reading source files directly
- **Matching service response format:** Verified from `app/services/matching_service.py` lines 208-216

### Secondary (MEDIUM confidence)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - v4 API changes confirmed
- [DeepWiki react-resizable-panels](https://deepwiki.com/bvaughn/react-resizable-panels/6-examples-and-usage-patterns) - v4 props and hooks documented
- [shadcn/ui Resizable issues](https://github.com/shadcn-ui/ui/issues/9197) - Confirmed shadcn wrapper compatibility issues with v4
- [Floating UI virtual elements](https://floating-ui.com/docs/virtual-elements) - Virtual element API for text selection positioning

### Tertiary (LOW confidence)
- Navigator three-position-mode UX: Based on training data patterns for IDE-like panel layouts. No specific library documentation for this pattern; it's custom UI work.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified as installed and API confirmed via node_modules inspection
- Architecture: HIGH - Patterns derived from existing codebase (DocumentViewer, NavigationPanel, RevisionSheet) and verified library APIs
- Pitfalls: HIGH - v4 API breaking changes verified, z-index conflicts derived from existing component analysis, text selection tooltip issues from floating-ui documentation
- State management: HIGH - Zustand store shape derived from existing patterns, all new state fits established conventions

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable libraries, no fast-moving dependencies)
