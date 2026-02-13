# Phase 4: Revision Bottom Sheet + Track Changes - Research

**Researched:** 2026-02-07
**Domain:** React bottom sheet / drawer, contentEditable track changes, revision lifecycle
**Confidence:** HIGH

## Summary

Phase 4 adds the core revision workflow: generating redlines from selected risks, displaying them as track-changes diffs in a bottom sheet panel, allowing inline editing with undo/redo, and accepting/rejecting revisions. The old vanilla JS implementation (revision.js, 1040 lines) provides a complete blueprint. All backend API endpoints are already built (`/api/revise`, `/api/accept`, `/api/reject`), the Zustand store has revision state (`setRevision`, `removeRevision`, `setRevisions`, `toggleBottomSheet`), and the API client has typed functions for all revision operations.

The critical design challenge is the track-changes contentEditable editor. The old implementation intercepts `beforeinput` and `keydown` events to create Word-style track changes (red strikethrough for deletions, blue underline for insertions, yellow background for user edits). This is inherently DOM-imperative code that must work alongside React's render cycle. The approach is to isolate the contentEditable region inside a ref-managed div that React does not reconcile, similar to how the document-viewer already uses `dangerouslySetInnerHTML` with imperative `useEffect` handlers.

For the bottom sheet itself, shadcn's Drawer component (built on Vaul) is the standard choice. It provides bottom positioning, snap points (peek/half/full height), drag-to-dismiss, non-modal mode, and programmatic open/close -- exactly matching the old bottom sheet behavior. It is already part of the shadcn ecosystem and installs with one command.

**Primary recommendation:** Use shadcn Drawer (Vaul) for the bottom sheet with snap points at 200px/50%/full. Port the contentEditable track-changes logic from revision.js into a custom `useTrackChanges` hook that attaches to a ref-managed div, keeping React out of the contentEditable DOM subtree.

## Standard Stack

### Core (To Install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn Drawer | latest | Bottom sheet with snap points, drag, non-modal | Official shadcn component built on Vaul; same ecosystem as all other UI components |
| vaul | 1.1.2 | Underlying drawer primitive (auto-installed by shadcn) | 8.1k GitHub stars, 345k dependents, proven Radix-style API |

### Core (Already Installed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| Zustand | Revision state management | Already has `setRevision`, `removeRevision`, `toggleBottomSheet` |
| shadcn Button, Badge, Tabs | Action buttons, status badges, revision/details tabs | Already installed |
| lucide-react | Icons (Check, X, RotateCcw, Flag, Edit3) | Already used throughout |
| sonner (toast) | Toast notifications for revision status | Already used in use-document.ts |

### No Additional Dependencies Needed
The track-changes contentEditable editor is pure DOM manipulation using browser APIs (TreeWalker, Range, Selection, MutationObserver). No rich-text editor library is needed. The old revision.js proves this approach works well for this specific use case.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Drawer (Vaul) | Custom CSS bottom sheet | Would need to hand-roll snap points, drag gestures, animation, accessibility |
| Custom contentEditable | ProseMirror / TipTap | Massive overkill -- we only need track-changes behavior, not a full editor. The old code is 300 lines, not 30,000 |
| react-contenteditable | Custom ref-based approach | The npm package tries to reconcile React state with contentEditable which causes cursor jump issues. The ref-based approach (React stays out of the DOM subtree) is more reliable |

**Installation:**
```bash
npx shadcn@latest add drawer
```

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/
  components/review/
    revision-sheet.tsx          # NEW: Drawer-based bottom sheet wrapping revision content
    track-changes-editor.tsx    # NEW: contentEditable wrapper with track-changes behavior
    revision-actions.tsx        # NEW: accept/reject/reset/flag button bar
  hooks/
    use-revision.ts             # NEW: revision generation, accept, reject, reopen lifecycle
  lib/
    track-changes.ts            # NEW: port of contentEditable manipulation logic from revision.js
```

### Pattern 1: shadcn Drawer as Non-Modal Bottom Sheet
**What:** Use shadcn's Drawer component with `direction="bottom"`, `modal={false}`, and snap points to create a bottom sheet that coexists with the document viewer and sidebar.
**When to use:** Whenever the user generates a revision and needs to review/edit it.

```typescript
// revision-sheet.tsx
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

const SNAP_POINTS = ['200px', 0.5, 1] as const;

export function RevisionSheet() {
  const { bottomSheetOpen } = useAppStore();
  const [snap, setSnap] = useState<string | number>(SNAP_POINTS[1]);

  // Controlled open state from store
  return (
    <Drawer
      open={bottomSheetOpen}
      onOpenChange={(open) => {
        if (!open) useAppStore.getState().toggleBottomSheet();
      }}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      direction="bottom"
      modal={false}
      dismissible={true}
    >
      <DrawerContent>
        {/* Tabs: Revision | Details */}
        {/* Track changes editor */}
        {/* Rationale */}
        {/* Action buttons */}
      </DrawerContent>
    </Drawer>
  );
}
```

### Pattern 2: Track Changes Editor as Imperative Island
**What:** A React component that wraps a contentEditable div, managing it entirely through refs and imperative DOM APIs. React renders the wrapper; the inner HTML is managed by the track-changes logic.
**When to use:** The diff display in the revision sheet.

```typescript
// track-changes-editor.tsx
interface TrackChangesEditorProps {
  diffHtml: string;
  readOnly: boolean;
  onContentChange: (editedHtml: string, finalText: string) => void;
  onModified: () => void;
}

export function TrackChangesEditor({
  diffHtml,
  readOnly,
  onContentChange,
  onModified,
}: TrackChangesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);

  // Set initial HTML when diffHtml changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = diffHtml;
      undoStackRef.current = [];
      redoStackRef.current = [];
    }
  }, [diffHtml]);

  // Attach imperative event handlers
  useEffect(() => {
    const el = editorRef.current;
    if (!el || readOnly) return;

    const handleBeforeInput = (e: InputEvent) => {
      // ... port from revision.js handleBeforeInput
    };
    const handleKeydown = (e: KeyboardEvent) => {
      // ... port from revision.js handleKeydown (undo/redo, backspace/delete)
    };

    el.addEventListener('beforeinput', handleBeforeInput);
    el.addEventListener('keydown', handleKeydown);

    return () => {
      el.removeEventListener('beforeinput', handleBeforeInput);
      el.removeEventListener('keydown', handleKeydown);
    };
  }, [readOnly, onContentChange, onModified]);

  return (
    <div
      ref={editorRef}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      className="revision-diff"
    />
  );
}
```

### Pattern 3: Revision Lifecycle Hook
**What:** A custom hook that encapsulates the full revision lifecycle: generate (POST /revise), accept (POST /accept), reject (POST /reject), reopen, and edit tracking.
**When to use:** Connected to the sidebar "Generate Revision" button and the revision sheet action buttons.

```typescript
// use-revision.ts
export function useRevision() {
  const sessionId = useAppStore((s) => s.sessionId);
  const setRevision = useAppStore((s) => s.setRevision);
  const removeRevision = useAppStore((s) => s.removeRevision);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async (
    paraId: string,
    riskIds: string[],
    includeRelatedIds?: string[],
    customInstruction?: string,
  ) => {
    if (!sessionId || riskIds.length === 0) return;
    setGenerating(true);

    try {
      const result = await revise({
        session_id: sessionId,
        para_id: paraId,
        risk_ids: riskIds,
        include_related_ids: includeRelatedIds,
        custom_instruction: customInstruction,
      });

      setRevision(paraId, {
        original: result.original,
        revised: result.revised,
        rationale: result.rationale,
        thinking: result.thinking,
        diff_html: result.diff_html,
        related_revisions: result.related_revisions,
        accepted: false,
        timestamp: new Date().toISOString(),
      });

      // Open the bottom sheet
      useAppStore.getState().toggleBottomSheet();
      toast.success("Revision generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setGenerating(false);
    }
  }, [sessionId, setRevision]);

  const accept = useCallback(async (paraId: string) => {
    if (!sessionId) return;
    const result = await acceptRevision({ session_id: sessionId, para_id: paraId });
    // Update local state
    const current = useAppStore.getState().revisions[paraId];
    if (current) {
      setRevision(paraId, { ...current, accepted: true });
    }
    toast.success("Revision accepted");
    return result;
  }, [sessionId, setRevision]);

  const reject = useCallback(async (paraId: string) => {
    if (!sessionId) return;
    await rejectRevision({ session_id: sessionId, para_id: paraId });
    removeRevision(paraId);
    toast.info("Revision rejected");
  }, [sessionId, removeRevision]);

  return { generate, accept, reject, generating };
}
```

### Pattern 4: Wiring Generate Button to Sidebar
**What:** The sidebar footer "Generate Revision" button collects included risk IDs from the risk accordion and calls `useRevision().generate()`.
**When to use:** This pattern connects Phase 3 (risk accordion with include/exclude toggles) to Phase 4 (revision generation).

The sidebar already has a disabled "Generate Revision" button in its footer. Phase 4 enables it and wires it to the revision hook. The risk inclusion state is currently local to `RiskAccordion` -- it needs to be either lifted to the sidebar or passed through a callback.

### Anti-Patterns to Avoid
- **Letting React reconcile contentEditable HTML:** React's virtual DOM diffing will fight contentEditable changes, causing cursor jumps and lost edits. The contentEditable div must be managed entirely through refs.
- **Using `dangerouslySetInnerHTML` for the track-changes editor:** This causes React to re-render the entire HTML on every state update, losing cursor position and undo history. Instead, set innerHTML once via ref and use imperative event handlers.
- **Storing edited HTML in React state:** Every keystroke would trigger re-render. Store in ref, only flush to store on significant events (accept, close sheet).
- **Modal bottom sheet:** The user needs to interact with the document and sidebar while the revision is open. Use `modal={false}` on the Drawer.
- **Forgetting to cleanup contentEditable listeners:** The beforeinput and keydown listeners must be removed on unmount to prevent memory leaks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet with drag/snap | Custom CSS transform + touch handlers | shadcn Drawer (Vaul) | Snap points, drag gestures, accessibility, animation all handled |
| Track changes diff HTML | Custom diff algorithm | Backend already generates `diff_html` via Gemini | The heavy diffing is done server-side; frontend just displays it |
| Undo/redo stack | Custom implementation from scratch | Port from revision.js (~30 lines) | Already battle-tested, handles edge cases (user-deletion spans, text node splitting) |
| Word-style track change styling | Custom CSS from scratch | Port CSS classes from old main.css | `.diff-del`, `.diff-ins`, `.user-addition`, `.user-deletion` already defined |
| Toast notifications | Custom notification system | sonner (already installed via shadcn) | Already used in `use-document.ts` |

**Key insight:** The backend does all the heavy lifting (Gemini API call, diff HTML generation, concept map updates on accept). The frontend's job is to display the diff, allow inline edits, and call accept/reject/flag APIs.

## Common Pitfalls

### Pitfall 1: ContentEditable Cursor Position Lost on React Re-render
**What goes wrong:** Any React state update causes the contentEditable div to lose cursor position, making typing impossible.
**Why it happens:** React reconciliation replaces the DOM subtree, which destroys the browser's Selection/Range state.
**How to avoid:** Never let React control the innerHTML of the contentEditable div. Set it once via `editorRef.current.innerHTML = diffHtml` in a `useEffect`, then manage all changes imperatively through event handlers. Only read the final HTML from the ref when needed (accept, close).
**Warning signs:** Cursor jumps to the start of the element after typing a character.

### Pitfall 2: Bottom Sheet Covers Document Viewer Scroll
**What goes wrong:** When the bottom sheet is at 50% height, the document viewer behind it can't scroll because the sheet captures all pointer events.
**Why it happens:** Vaul's default behavior prevents background interaction.
**How to avoid:** Use `modal={false}` on the Drawer component. This allows interaction with elements behind the sheet. The old implementation used `position: fixed` with `right: var(--sidebar-width)` to leave the sidebar uncovered.
**Warning signs:** User can't scroll the document while revision is open.

### Pitfall 3: Stale Revision Data After Accept/Reject
**What goes wrong:** The bottom sheet shows the old revision content after the user accepts and navigates to another paragraph, then comes back.
**Why it happens:** The bottom sheet reads from a stale closure or cached state rather than the current store.
**How to avoid:** Read revision data directly from the store using the current `selectedParaId` as the key. When `selectedParaId` changes, the sheet should update. When a revision is accepted, the sheet should show the accepted state (read-only, green checkmark).
**Warning signs:** Sheet shows "Proposed Revision" but the revision was already accepted.

### Pitfall 4: User Edits Lost When Switching Paragraphs
**What goes wrong:** User makes inline edits to the diff, clicks another paragraph, comes back -- edits are gone.
**Why it happens:** The contentEditable HTML is only stored in the DOM element, which gets replaced when the sheet re-opens with different content.
**How to avoid:** On every significant change (or on sheet close/paragraph switch), persist the edited HTML to the store via `setRevision(paraId, { ...existing, editedHtml: editor.innerHTML })`. The old revision.js stored `revision.editedHtml` on every input event -- but in React, do it on blur/close/paragraph-switch to avoid excessive store updates.
**Warning signs:** User edits are lost between paragraph switches.

### Pitfall 5: Accept API Returns Affected Paragraphs but Nothing Happens
**What goes wrong:** The accept response includes `affected_para_ids` (paragraphs whose risk analysis may have changed due to concept map updates), but the UI doesn't re-analyze them.
**Why it happens:** The affected paragraphs feature was built but never wired up.
**How to avoid:** For Phase 4, log `affected_para_ids` and optionally show a toast "N related clauses may need re-analysis". Full re-analysis UI can be deferred to Phase 5+. Don't ignore the data -- it's the foundation of the smart contract analysis.
**Warning signs:** Accepting a revision that changes a defined term doesn't update risks in related paragraphs.

### Pitfall 6: Backspace/Delete Removes Text Instead of Striking Through
**What goes wrong:** Pressing backspace in the contentEditable div removes text from the DOM rather than wrapping it in a `<span class="user-deletion">` with strikethrough.
**Why it happens:** Default browser behavior for backspace is to delete content.
**How to avoid:** Intercept both `keydown` (for backspace/delete) and `beforeinput` (for text insertion) events with `e.preventDefault()`, then apply the track-changes transformation manually. This is the core of the old `handleKeydown()` and `handleBeforeInput()` functions -- port them exactly.
**Warning signs:** Red strikethrough doesn't appear; text just disappears.

### Pitfall 7: Bottom Sheet Position Conflicts with BottomBar
**What goes wrong:** The Drawer component renders at the very bottom of the viewport, overlapping or conflicting with the existing BottomBar component.
**Why it happens:** The Drawer uses `position: fixed; bottom: 0` which is the same space the BottomBar occupies.
**How to avoid:** Two approaches: (a) When the revision sheet is open, hide the BottomBar or reduce it to a minimal state. (b) Render the Drawer inside the main content area (not full-viewport) so it sits above the BottomBar. The old implementation used `right: var(--sidebar-width)` to avoid covering the sidebar. The recommended approach is (a) -- toggle BottomBar visibility based on `bottomSheetOpen`.
**Warning signs:** BottomBar buttons are unreachable when the sheet is open.

## Code Examples

### Track Changes CSS (port from old main.css)
```css
/* Add to globals.css */

/* Track changes in revision editor */
.revision-diff {
  background: oklch(0.98 0 0);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  font-family: inherit;
  font-size: 0.9375rem;
  line-height: 1.7;
  max-height: 200px;
  overflow-y: auto;
  transition: all 150ms;
}

.revision-diff:hover {
  background: oklch(1 0 0);
  border-color: oklch(0.546 0.215 264);
  box-shadow: 0 0 0 2px oklch(0.546 0.215 264 / 0.1);
}

.revision-diff[contenteditable="true"] {
  cursor: text;
  outline: none;
}

.revision-diff[contenteditable="true"]:focus {
  box-shadow: 0 0 0 2px oklch(0.546 0.215 264 / 0.2);
}

.revision-diff.user-modified {
  border-color: oklch(0.705 0.213 47.604);
  background: oklch(1 0 0);
}

/* AI-generated diffs (from backend diff_html) */
.diff-del,
del.diff-del {
  color: #b91c1c;
  text-decoration: line-through;
  text-decoration-color: #b91c1c;
}

.diff-ins,
ins.diff-ins {
  color: #1d4ed8;
  text-decoration: underline;
  text-decoration-style: solid;
}

/* User inline edits (yellow background like Word track changes) */
.user-addition {
  background: #fef9c3;
  color: #1d4ed8;
  text-decoration: underline;
  text-decoration-color: #1d4ed8;
  padding: 0 1px;
}

.user-deletion {
  background: #fef9c3;
  color: #dc2626;
  text-decoration: line-through;
  text-decoration-color: #dc2626;
  padding: 0 1px;
}
```

### Rationale Display
```typescript
// Inside revision-sheet.tsx
function Rationale({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <div className="rounded-r border-l-[3px] border-violet-500 bg-gradient-to-r from-violet-50 to-purple-50 px-3 py-2.5 text-sm italic text-muted-foreground">
      <span className="not-italic font-semibold text-foreground">Rationale: </span>
      {text}
    </div>
  );
}
```

### Extract Final Text from Edited Content
```typescript
// lib/track-changes.ts
// Port of extractFinalText from revision.js
export function extractFinalText(element: HTMLElement): string {
  let text = '';
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      // Skip deletions (struck through text)
      if (el.classList?.contains('user-deletion')) return;
      if (el.classList?.contains('diff-del')) return;
      // Include everything else (including user-addition spans)
      text += el.textContent;
    }
  });
  return text;
}
```

### Wrap Range as Deleted (core track-changes operation)
```typescript
// lib/track-changes.ts
// Port of wrapRangeAsDeleted from revision.js
export function wrapRangeAsDeleted(range: Range): void {
  const container = range.commonAncestorContainer;
  const parent =
    container.nodeType === Node.TEXT_NODE
      ? (container as Text).parentElement
      : (container as HTMLElement);

  // If selection is inside a user-addition span, actually delete it
  if (parent?.classList?.contains('user-addition')) {
    range.deleteContents();
    if (parent.textContent === '') parent.remove();
    return;
  }

  const contents = range.extractContents();
  if (!contents.textContent?.trim() && contents.childNodes.length === 0) return;

  const span = document.createElement('span');
  span.className = 'user-deletion';
  span.appendChild(contents);
  range.insertNode(span);

  // Move cursor after the deletion span
  const selection = window.getSelection();
  const newRange = document.createRange();
  newRange.setStartAfter(span);
  newRange.setEndAfter(span);
  selection?.removeAllRanges();
  selection?.addRange(newRange);
}
```

### Insert User Text (core track-changes operation)
```typescript
// lib/track-changes.ts
// Port of insertUserText from revision.js
export function insertUserText(text: string): void {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  const container = range.startContainer;

  // If cursor is inside a user-addition span, append to it
  if (
    container.nodeType === Node.TEXT_NODE &&
    (container as Text).parentElement?.classList?.contains('user-addition')
  ) {
    const textNode = container as Text;
    const offset = range.startOffset;
    const current = textNode.textContent || '';
    textNode.textContent = current.slice(0, offset) + text + current.slice(offset);

    const newRange = document.createRange();
    newRange.setStart(textNode, offset + text.length);
    newRange.setEnd(textNode, offset + text.length);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    // Create new user-addition span
    const span = document.createElement('span');
    span.className = 'user-addition';
    span.textContent = text;
    range.insertNode(span);

    const newRange = document.createRange();
    newRange.setStart(span.firstChild!, span.firstChild!.length);
    newRange.setEnd(span.firstChild!, span.firstChild!.length);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
}
```

## Existing State and API Analysis

### Store State Already Available
| Property | Type | Ready? |
|----------|------|--------|
| `revisions` | `Record<string, Revision>` | Yes |
| `bottomSheetOpen` | `boolean` | Yes |
| `selectedParaId` | `string \| null` | Yes |
| `sessionId` | `string \| null` | Yes |

### Store Actions Already Available
| Action | Signature | Ready? |
|--------|-----------|--------|
| `setRevision` | `(paraId: string, revision: Revision) => void` | Yes |
| `removeRevision` | `(paraId: string) => void` | Yes |
| `setRevisions` | `(revisions: Record<string, Revision>) => void` | Yes |
| `toggleBottomSheet` | `() => void` | Yes |
| `selectParagraph` | `(paraId: string \| null) => void` | Yes |

### Store State That Needs Adding
| Property | Type | Why |
|----------|------|-----|
| `revisionSheetParaId` | `string \| null` | Track which paragraph's revision is shown in the sheet (may differ from selectedParaId if user clicks doc while sheet is open) |
| `generatingRevision` | `boolean` | Loading state for revision generation |

### API Functions Already Available
| Function | Endpoint | Ready? |
|----------|----------|--------|
| `revise(data)` | `POST /api/revise` | Yes -- accepts `session_id, para_id, risk_ids[], include_related_ids[], custom_instruction` |
| `acceptRevision(data)` | `POST /api/accept` | Yes -- returns `concept_changes, affected_para_ids` |
| `rejectRevision(data)` | `POST /api/reject` | Yes -- deletes revision from session |
| `reanalyze(data)` | `POST /api/reanalyze` | Yes -- for re-analyzing after related clause changes |

### Types Already Available
| Type | Fields | Ready? |
|------|--------|--------|
| `Revision` | `original, revised, rationale, thinking, diff_html, related_revisions, accepted, timestamp, prompts` | Yes |
| `RelatedRevision` | `para_id, original, revised, rationale` | Yes |
| `ReviseRequest` | `session_id, para_id, risk_id, risk_ids, include_related_ids, custom_instruction` | Yes |
| `ReviseResponse` | `para_id, original, revised, rationale, thinking, diff_html, related_revisions` | Yes |
| `AcceptResponse` | `status, para_id, concept_changes, affected_para_ids` | Yes |

### What Needs to Be Extended in Revision Type
The Revision type currently does not include `editedHtml` (for persisting user inline edits). Two options:
1. Add `editedHtml?: string` to the Revision type in types.ts
2. Store it only in the track-changes editor ref and flush on accept

Recommendation: Add `editedHtml` to the type for persistence across paragraph switches.

## Key Implementation Details

### Data Flow: Generate Revision
```
User clicks "Generate Revision" in sidebar footer
  -> collect included risk IDs from RiskAccordion
  -> useRevision.generate(paraId, riskIds)
    -> POST /api/revise { session_id, para_id, risk_ids }
    -> Backend calls Gemini API, generates diff_html
    -> Response: { para_id, original, revised, rationale, diff_html, related_revisions }
  -> setRevision(paraId, revisionData)
  -> Open bottom sheet (toggleBottomSheet or set bottomSheetOpen=true)
  -> RevisionSheet reads revision from store by selectedParaId
  -> TrackChangesEditor renders diff_html in contentEditable div
```

### Data Flow: Accept Revision
```
User clicks "Accept" in bottom sheet
  -> useRevision.accept(paraId)
    -> Persist editedHtml from editor ref to store
    -> Extract final text from contentEditable (keep additions, remove deletions)
    -> POST /api/accept { session_id, para_id }
    -> Backend marks revision as accepted, detects concept changes, updates maps
    -> Response: { status, concept_changes, affected_para_ids }
  -> Update revision in store: { ...revision, accepted: true }
  -> Document viewer re-renders paragraph with "revision-accepted" class
  -> Bottom sheet shows accepted state (read-only, reopen button)
```

### Data Flow: User Inline Edit
```
User types in contentEditable div
  -> beforeinput event intercepted (preventDefault)
  -> Save undo state (innerHTML snapshot)
  -> Insert user text wrapped in <span class="user-addition">
  -> Mark revision as modified (show reset button, border color change)
  -> On significant event (close/accept/switch para):
    -> Flush editedHtml (editor.innerHTML) to store
    -> Extract final text (additions kept, deletions removed) to store
```

### Layout Integration
The RevisionSheet component should be rendered in the review page layout. Current layout:
```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                       │
├──────┬──────────────────────────────────┬───────────────────┤
│ Nav  │ Document Viewer                   │ Sidebar (380px)   │
│ Panel│                                   │                   │
│      │                                   │                   │
│      │                                   │                   │
├──────┴──────────────────────────────────┴───────────────────┤
│ BottomBar                                                    │
└─────────────────────────────────────────────────────────────┘
```

With revision sheet open:
```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                       │
├──────┬──────────────────────────────────┬───────────────────┤
│ Nav  │ Document Viewer                   │ Sidebar (380px)   │
│ Panel│                                   │                   │
│      │                                   │                   │
│      ├──────────────────────────────────┤                   │
│      │ Revision Bottom Sheet             │                   │
│      │ (snaps: 200px / 50% / full)       │                   │
├──────┴──────────────────────────────────┴───────────────────┤
│ BottomBar (may be hidden when sheet is open)                 │
└─────────────────────────────────────────────────────────────┘
```

The Drawer/Sheet should span from the nav panel to the sidebar (not full viewport width). This may require custom positioning CSS on the DrawerContent.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom CSS bottom sheet with translateY | shadcn Drawer (Vaul) with snap points | 2024 | Better gestures, snap points, accessibility |
| innerHTML manipulation + global state | React ref + Zustand store | Phase 4 migration | Same behavior, better lifecycle management |
| `onclick` inline handlers | React event handlers + useCallback | Phase 4 migration | Type safety, cleanup on unmount |

**Note on Vaul maintenance:** Vaul's maintainer marked the repo as unmaintained (hobby project). However, it has 345k dependents and shadcn officially uses it. For this project's needs (basic bottom drawer with snap points), the library is stable and feature-complete. No breaking changes are expected.

## Open Questions

1. **Should the bottom sheet span full width or only the document area?**
   - The old implementation used `left: var(--nav-width); right: var(--sidebar-width)` to sit between nav and sidebar.
   - Vaul's Drawer defaults to full viewport width. Custom CSS overrides may be needed to constrain it.
   - Recommendation: Start with full width minus sidebar, iterate based on visual testing. The sidebar needs to remain accessible when the sheet is open.

2. **Should user inline edits be persisted to the backend?**
   - The old code stored `editedHtml` only in frontend state (AppState.revisions[paraId].editedHtml).
   - The backend only has `original` and `revised` fields in the revision.
   - Recommendation: For Phase 4, persist only to Zustand store (in-session). Persisting to backend can be added later if needed.

3. **How to handle the risk inclusion state flow?**
   - The risk inclusion state lives in RiskAccordion's local state (`riskInclusions`).
   - The "Generate Revision" button in the sidebar footer needs access to the included risk IDs.
   - Options: (a) Lift state to sidebar, (b) Use a callback from RiskAccordion to sidebar, (c) Move inclusion state to Zustand store.
   - Recommendation: (b) -- pass a `getIncludedRiskIds` callback from sidebar to RiskAccordion, call it when the generate button is clicked.

4. **Should the sheet auto-open when a paragraph with an existing revision is selected?**
   - The old behavior: clicking a paragraph with a revision auto-opened the bottom sheet.
   - Recommendation: Yes, auto-open. Check `revisions[selectedParaId]` in a useEffect -- if it exists, open the sheet.

## Sources

### Primary (HIGH confidence)
- `app/static/js/revision.js` - Complete old implementation (1040 lines) -- track changes editor, bottom sheet, accept/reject/reset/flag/reopen lifecycle
- `app/static/css/main.css` lines 3458-3865 - Old bottom sheet + track changes CSS
- `app/static/index.html` lines 549-595 - Old revision sheet HTML structure
- `app/api/routes.py` lines 538-728 - Backend revision endpoints (revise, accept, reject, reanalyze)
- `frontend/src/lib/store.ts` - Zustand store with revision state and bottomSheetOpen
- `frontend/src/lib/types.ts` - Revision, ReviseRequest, ReviseResponse types
- `frontend/src/lib/api.ts` - revise(), acceptRevision(), rejectRevision() API functions
- `frontend/src/components/review/sidebar.tsx` - Current sidebar with disabled "Generate Revision" button
- `frontend/src/components/review/risk-accordion.tsx` - Risk inclusion toggle state
- `frontend/src/components/review/document-viewer.tsx` - Paragraph state classes (has-revision, revision-accepted)

### Secondary (MEDIUM confidence)
- [shadcn Drawer documentation](https://ui.shadcn.com/docs/components/radix/drawer) - Installation and API
- [Vaul snap points documentation](https://vaul.emilkowal.ski/snap-points) - Snap point configuration

### Tertiary (LOW confidence)
- Vaul GitHub - Maintenance status note (unmaintained as hobby project, but 345k dependents and used by shadcn officially)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - shadcn Drawer is the obvious choice; all APIs and types already exist
- Architecture: HIGH - Direct port from well-understood vanilla JS implementation
- Track changes editor: HIGH - revision.js is fully readable, all edge cases already handled
- Pitfalls: HIGH - Derived from real contentEditable + React integration challenges
- Code examples: HIGH - Ported directly from existing source files

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable - internal project, minimal external dependency changes expected)
