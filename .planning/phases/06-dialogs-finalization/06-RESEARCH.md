# Phase 6: Dialogs + Finalization - Research

**Researched:** 2026-02-09
**Domain:** Dialog components, Word export pipeline, email generation, project lifecycle management
**Confidence:** HIGH

## Summary

Phase 6 completes the end-to-end review workflow with four dialog components and supporting infrastructure. The codebase is well-positioned for this phase: the backend already has fully functional endpoints for flagging (`/api/flag`, `/api/unflag`), finalization (`/api/finalize`, `/api/finalize/preview`), transmittal (`/api/transmittal/<id>`), file download (`/api/download/<id>/<type>`), and session management (`/api/session/<id>/save`, `/api/session/<id>/load`, `/api/sessions/saved`). The frontend has shadcn Dialog and AlertDialog components installed, a NewProjectDialog already partially built, and a FlagsTab placeholder that says "Full flagging UI available in Phase 6." The Word export pipeline uses python-docx with manual `w:ins`/`w:del` XML elements for track changes -- this is already working code that does not need replacement.

The primary work is building four frontend dialog components (flag, finalize, transmittal, new-project enhancement), upgrading the FlagsTab from placeholder to full functionality, enhancing the flag data model to support categories (currently only `client`/`attorney` types), and wiring everything together. The backend transmittal endpoint needs minor enhancement to support the configurable revision summary toggle, and the flag endpoint needs a `category` field. No new external libraries are needed.

**Primary recommendation:** Build frontend-first since all required backend endpoints exist. Enhance the Flag type to include `category` (Business Decision, Risk Alert, For Discussion, FYI) alongside the existing `flag_type`. Wire the Finalize button in BottomBar (currently disabled) to open a Dialog with preview stats and download actions.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Flag dialog
- Flags capture: category + free-text note
- Four categories: Business Decision, Risk Alert, For Discussion, FYI
- Flag can be created from sidebar risk cards AND from text selection in the document
- Flagged paragraphs show a small flag/pin icon in the document margin (no text highlight)
- Flags tab in sidebar lists all flagged items

#### Finalize & export
- Finalize dialog shows: high-level stats (X revisions accepted, Y flagged) plus expandable revision list
- Produces two Word documents: track changes (redline) + clean (changes accepted)
- Both files download directly (no ZIP bundle)
- User can finalize with unreviewed risks remaining -- show warning with count of unreviewed items
- No cherry-picking in finalize dialog -- all accepted revisions are exported
- Track changes author name is configurable in the finalize dialog (text input)
- Formatting preservation already handled by Phase A pipeline -- reuse same approach
- Session stays open after export -- user can keep reviewing and re-export
- Finalize marks the document as "Finalized" in project history; user can reopen to continue editing (which clears finalized status)

#### Transmittal email
- Default content: flagged items only (each flag with its category, paragraph reference, and note)
- Configurable: user can toggle on a summary of key revisions in addition to flags
- Delivery: both "Copy to clipboard" and "Open in email client" (mailto:) buttons
- Tone: professional but conversational ("Attached is our markup of the PSA...")
- Editable in-app before copying/sending (textarea the user can revise)

#### New project flow
- Triggered from header menu action (File/Project dropdown)
- Auto-saves current session before navigating
- Brief confirmation dialog: "Current work will be saved. Start new project?" with Continue/Cancel
- Confirmation dialog has a "Don't show again" checkbox (preference persisted)
- Recent projects list shows status badges: In Progress, Finalized
- Projects are deletable from history with confirmation
- Reopening a finalized project shows a read-only summary view first, with an "Edit" button to re-enter full review mode

### Claude's Discretion
- Which intake settings to carry over vs reset when starting a new project
- Transmittal email editability UX (editable textarea before copy/send)
- Exact layout and styling of the finalize stats/revision list
- Flag icon design and margin positioning
- Read-only summary view design for finalized projects

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| radix-ui Dialog | 1.4.3 | Dialog/AlertDialog primitives | Already installed, used by NewProjectDialog |
| shadcn/ui | 3.8.4 | Pre-built Dialog, AlertDialog, Sheet, Badge, Accordion, Textarea | Already configured and used throughout codebase |
| zustand | 5.0.11 | State management for flags, revisions, UI state | Already the app's state layer |
| sonner | 2.0.7 | Toast notifications for success/error feedback | Already used for all user notifications |
| lucide-react | 0.563.0 | Icons (Flag, FileDown, Mail, Copy, Trash2, etc.) | Already the icon library |
| python-docx | >=0.8.11 | Word document generation with track changes XML | Already handles finalization |
| diff-match-patch | >=20200713 | Text diffing for track changes computation | Already used in `_apply_track_changes_to_paragraph` |
| redlines | 0.6.1 | Text comparison (imported but minimally used) | Already installed, available as fallback |

### Supporting (no new installs needed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| navigator.clipboard.writeText | Copy transmittal to clipboard | "Copy to clipboard" button |
| window.location.href (mailto:) | Open email client | "Open in email client" button |
| URL.createObjectURL + anchor click | Download Word files from blob | File download triggers |
| localStorage | Persist "Don't show again" preference | New project confirmation |

### No New Dependencies Required
The entire phase can be built with what is already installed. Do NOT add:
- `file-saver` (use native blob download)
- `react-hot-toast` (use sonner)
- `@radix-ui/react-checkbox` (use native HTML checkbox as intake-form already does)

**Installation:**
```bash
# No new packages needed. shadcn checkbox component can be added if desired:
npx shadcn@latest add checkbox
```

## Architecture Patterns

### Existing Dialog Pattern (follow this)
The codebase has a clear dialog pattern established by `NewProjectDialog`:

```
frontend/src/components/dialogs/
  new-project-dialog.tsx     # AlertDialog, controlled open/onOpenChange
```

All new dialogs should follow this same pattern:
- Components live in `frontend/src/components/dialogs/`
- Controlled via `open`/`onOpenChange` props from parent
- Use `AlertDialog` for destructive/confirmation actions (new project, delete)
- Use `Dialog` for complex forms (finalize, transmittal, flag)
- Loading states use `Loader2` icon from lucide + `disabled` prop on buttons
- Error handling via `sonner` toast

### Recommended File Structure
```
frontend/src/
  components/
    dialogs/
      new-project-dialog.tsx      # ENHANCE: add "Don't show again", auto-save
      finalize-dialog.tsx          # NEW: preview stats, author name, download
      transmittal-dialog.tsx       # NEW: email preview, edit, copy/mailto
      flag-dialog.tsx              # NEW: category picker, note input
      delete-project-dialog.tsx    # NEW: confirm project deletion
    review/
      flags-tab.tsx                # ENHANCE: full flag list, create/remove actions
      document-viewer.tsx          # ENHANCE: flag margin icons, text selection flagging
      sidebar.tsx                  # ENHANCE: flag button on risk cards
      bottom-bar.tsx               # ENHANCE: wire Finalize button
  hooks/
    use-flags.ts                   # NEW: flag CRUD operations
    use-finalize.ts                # NEW: finalize preview, export, download
  lib/
    types.ts                       # ENHANCE: FlagCategory type, updated Flag interface
    api.ts                         # Already has all needed endpoints
    store.ts                       # ENHANCE: add flag category support
```

### Pattern 1: Dialog with Backend Preview Data
**What:** Dialog fetches preview data from backend on open, shows loading state, then renders content.
**When to use:** Finalize dialog (calls `/api/finalize/preview`), Transmittal dialog (calls `/api/transmittal/<id>`).
**Example:**
```typescript
// Source: existing NewProjectDialog pattern
export function FinalizeDialog({ open, onOpenChange }: Props) {
  const [preview, setPreview] = useState<FinalizePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && sessionId) {
      setLoading(true);
      finalizePreview({ session_id: sessionId })
        .then(setPreview)
        .catch((err) => toast.error(err.message))
        .finally(() => setLoading(false));
    }
  }, [open, sessionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {loading ? <Loader2 /> : <PreviewContent data={preview} />}
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 2: Blob Download
**What:** Download Word files from backend as blob, trigger browser download.
**When to use:** Track changes and clean document downloads from finalize dialog.
**Example:**
```typescript
// Source: existing downloadFile in api.ts + standard blob pattern
async function handleDownload(sessionId: string, type: 'track_changes' | 'clean') {
  try {
    const blob = await downloadFile(sessionId, type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${type}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download started');
  } catch (err) {
    toast.error('Download failed');
  }
}
```

### Pattern 3: Clipboard + Mailto
**What:** Copy formatted text to clipboard, or open email client with prefilled content.
**When to use:** Transmittal dialog delivery buttons.
**Example:**
```typescript
// Copy to clipboard
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    // Fallback for non-HTTPS contexts (localhost development)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    toast.success('Copied to clipboard');
  }
}

// Open email client -- NOTE: mailto has ~2000 char URL limit
function openInEmailClient(subject: string, body: string) {
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // Truncate body if needed to stay under URL limit
  if (mailtoUrl.length > 2000) {
    // Truncate body and add note
    const truncatedBody = body.substring(0, 1500) + '\n\n[Full content copied to clipboard -- paste in email body]';
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(truncatedBody)}`;
    // Also copy full version to clipboard
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.info('Full email content also copied to clipboard (mailto has length limits)');
  } else {
    window.location.href = mailtoUrl;
  }
}
```

### Pattern 4: localStorage Preference Persistence
**What:** Store user preferences like "Don't show again" in localStorage.
**When to use:** New project confirmation dialog preference.
**Example:**
```typescript
// Source: existing pattern in review page (navigator position persistence)
const PREF_KEY = 'new-project-skip-confirm';

function shouldSkipConfirmation(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true';
}

function setSkipConfirmation(skip: boolean): void {
  localStorage.setItem(PREF_KEY, String(skip));
}
```

### Anti-Patterns to Avoid
- **Separate state for each dialog:** Don't create individual boolean states in the page component for each dialog. Instead, use a single `activeDialog` state or keep dialog open state colocated with the trigger.
- **Fetching data outside dialog:** Don't pre-fetch finalize preview or transmittal data before the dialog opens. Fetch on dialog open to ensure fresh data.
- **useRef for "loaded" guards:** Per project MEMORY.md, never use useRef guards in effects -- use store state checks instead.
- **Multiple instances of data-loading hooks:** Per project MEMORY.md, pass data as props from parent instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog overlay/focus trap | Custom modal implementation | shadcn Dialog (Radix primitive) | Accessibility, keyboard handling, portal rendering |
| Toast notifications | Custom notification system | sonner (already installed) | Already used throughout app, consistent UX |
| Track changes XML | New track changes library | Existing `_apply_track_changes_to_paragraph()` | Already working, creates proper `w:ins`/`w:del` elements |
| File download | `file-saver` npm package | Native blob + anchor click | Zero-dependency, browser-native, already have `requestBlob` in api.ts |
| Confirmation dialog | Custom modal | shadcn AlertDialog | Already used by NewProjectDialog, proper pattern |

**Key insight:** The backend endpoints are essentially complete. The finalize endpoint at `/api/finalize` already generates both track-changes and clean documents. The `/api/transmittal/<id>` endpoint already generates email content. The `/api/flag` and `/api/unflag` endpoints already work. This phase is primarily a frontend wiring task with minor backend enhancements.

## Common Pitfalls

### Pitfall 1: Mailto URL Length Limit
**What goes wrong:** Transmittal email body exceeds ~2000 character mailto URL limit, causing email client to open with truncated content or fail silently.
**Why it happens:** Legal transmittal emails with multiple flagged items and revision summaries can easily exceed 2000 characters when URL-encoded.
**How to avoid:** Always check URL length before using mailto. If over 2000 chars, auto-copy full content to clipboard and use truncated version for mailto with a note to paste from clipboard.
**Warning signs:** Email client opens but body is empty or cut off.

### Pitfall 2: Dialog State Stale Data
**What goes wrong:** Finalize dialog shows outdated revision counts because preview was fetched when dialog first opened, and user accepted more revisions since.
**Why it happens:** Preview data fetched on first open stays cached in component state.
**How to avoid:** Re-fetch preview data every time the dialog opens (useEffect with `open` dependency). Clear preview state when dialog closes.
**Warning signs:** Stats in dialog don't match bottom bar stats.

### Pitfall 3: Download Race Condition
**What goes wrong:** User clicks download before finalize API call completes, gets 404 or stale files.
**Why it happens:** Finalize generates files server-side. Download links are only valid after finalize completes.
**How to avoid:** Disable download buttons until finalize API returns success. Show loading spinner during finalization. Only enable download after receiving file paths in response.
**Warning signs:** 404 on download, or downloading previous session's files.

### Pitfall 4: Flag Category Type Mismatch
**What goes wrong:** Backend stores `flag_type: 'client'|'attorney'` but CONTEXT.md specifies four categories: Business Decision, Risk Alert, For Discussion, FYI. Mixing these up causes transmittal filtering to break.
**Why it happens:** The existing `flag_type` field serves a different purpose (transmittal inclusion vs internal) than the new `category` field (semantic classification).
**How to avoid:** Keep BOTH fields: `flag_type` (client/attorney -- determines transmittal inclusion) AND `category` (Business Decision/Risk Alert/For Discussion/FYI -- semantic classification). Map the four user-facing categories to always use `flag_type: 'client'` since all four are for client review per the decision.
**Warning signs:** Flags missing from transmittal, or wrong categories displayed.

### Pitfall 5: Session Stays Open After Export
**What goes wrong:** User exports, continues reviewing, but the "Finalized" status badge is stuck, confusing the session state.
**Why it happens:** Decision says session stays open after export and finalize marks as "Finalized". Re-exporting should work but status might not update correctly.
**How to avoid:** After export, set `status: 'finalized'`. If user makes any new changes (accept/reject/flag), clear finalized status back to `'analyzed'`. Track this in the store.
**Warning signs:** Status badge shows "Finalized" but user is still making changes.

### Pitfall 6: React Strict Mode Effect Double-Fire
**What goes wrong:** Dialog open effect fires twice in dev mode, causing duplicate API calls for preview data.
**Why it happens:** React strict mode mounts, unmounts, remounts components. Effects with fetch calls run twice.
**How to avoid:** Use AbortController in effects that fetch data. The second effect run cancels the first fetch.
**Warning signs:** Network tab shows duplicate requests, console shows cancelled requests.

## Code Examples

### Flag Data Model Enhancement
```typescript
// types.ts -- ENHANCE existing Flag interface
export type FlagCategory = 'business-decision' | 'risk-alert' | 'for-discussion' | 'fyi';

export interface Flag {
  para_id: string;
  section_ref: string;
  text_excerpt: string;
  note: string;
  flag_type: FlagType;       // Keep: 'client' | 'attorney' (transmittal inclusion)
  category: FlagCategory;    // NEW: semantic category
  timestamp: string;
}

// Updated FlagRequest
export interface FlagRequest {
  session_id: string;
  para_id: string;
  note: string;
  flag_type: FlagType;
  category: FlagCategory;    // NEW
}
```

### Flag Dialog Component Structure
```typescript
// Source: follows NewProjectDialog pattern
interface FlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paraId: string;
  defaultCategory?: FlagCategory;
}

export function FlagDialog({ open, onOpenChange, paraId, defaultCategory }: FlagDialogProps) {
  const [category, setCategory] = useState<FlagCategory>(defaultCategory || 'for-discussion');
  const [note, setNote] = useState('');
  // ... submit handler calls flagItem() API then store.addFlag()
}
```

### Finalize Dialog Structure
```typescript
// Uses Dialog (not AlertDialog) since it has complex content
export function FinalizeDialog({ open, onOpenChange }: Props) {
  const sessionId = useAppStore((s) => s.sessionId);
  const risks = useAppStore((s) => s.risks);
  const revisions = useAppStore((s) => s.revisions);

  const [preview, setPreview] = useState<FinalizePreviewResponse | null>(null);
  const [authorName, setAuthorName] = useState(''); // Default from intake
  const [exporting, setExporting] = useState(false);

  // Count unreviewed risks for warning
  const acceptedParaIds = new Set(
    Object.entries(revisions)
      .filter(([, r]) => r.accepted)
      .map(([id]) => id)
  );
  const unreviewedCount = new Set(
    risks.map(r => r.para_id).filter(id => !acceptedParaIds.has(id))
  ).size;

  // Fetch preview on open
  // Export handler calls finalize() then downloadFile() for each type
}
```

### Document Margin Flag Icon (CSS approach)
```css
/* In globals.css -- flag icon in document margin */
.document-container [data-para-id].flagged::before {
  content: '';
  position: absolute;
  left: -20px;
  top: 4px;
  width: 14px;
  height: 14px;
  background-image: url("data:image/svg+xml,..."); /* inline flag SVG */
  background-size: contain;
  background-repeat: no-repeat;
  opacity: 0.7;
}

.document-container [data-para-id].flagged {
  position: relative;
}
```

### Transmittal Email Enhancement (Backend)
```python
# routes.py -- enhance transmittal endpoint to support include_revisions toggle
@api_bp.route('/transmittal/<session_id>', methods=['GET'])
def get_transmittal(session_id):
    include_revisions = request.args.get('include_revisions', 'false').lower() == 'true'
    # ... existing flag collection logic ...
    # If include_revisions, add a "Key Revisions" section summarizing accepted revisions
```

### Blob Download Helper (use-finalize.ts)
```typescript
// Source: standard browser blob download pattern
export function useFinalize() {
  const sessionId = useAppStore((s) => s.sessionId);
  const setSession = useAppStore((s) => s.setSession);

  const doExport = async (authorName: string) => {
    if (!sessionId) return;

    const result = await finalize({ session_id: sessionId, author_name: authorName });
    setSession({ status: 'finalized' });

    return result;
  };

  const download = async (type: 'track_changes' | 'clean') => {
    if (!sessionId) return;

    const blob = await downloadFile(sessionId, type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redline_${type}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return { doExport, download };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `flag_type: client/attorney` only | `flag_type` + `category` (4 categories) | This phase | Backend flag endpoint needs `category` field added |
| Finalize button disabled in BottomBar | Finalize opens Dialog with preview | This phase | Wire existing disabled button to dialog |
| FlagsTab placeholder text | Full flag list with create/remove | This phase | Replace placeholder with functional component |
| NewProjectDialog: Save/Discard only | Auto-save + "Don't show again" checkbox | This phase | Simplify flow per user preference |
| Static transmittal on backend | Editable transmittal in frontend textarea | This phase | More flexible client communication |

**Existing infrastructure that is already complete:**
- Backend `/api/finalize` endpoint with track changes generation
- Backend `/api/finalize/preview` endpoint with revision details
- Backend `/api/transmittal/<id>` endpoint with email content
- Backend `/api/download/<id>/<type>` endpoint with blob response
- Backend `/api/flag` and `/api/unflag` endpoints
- Backend `/api/session/<id>/save`, `/load`, sessions listing
- Frontend `downloadFile()` in api.ts with `requestBlob()`
- Frontend `finalize()`, `finalizePreview()`, `getTransmittal()` in api.ts
- Frontend `flagItem()`, `unflagItem()` in api.ts
- Frontend `saveSession()`, `discardSession()`, `loadSession()`, `listSavedSessions()` in api.ts
- Frontend Zustand store with `addFlag()`, `removeFlag()`, `setFlags()`, `resetSession()`, `setSavedSessions()`
- Frontend NewProjectDialog (basic version)
- Frontend RecentProjects with status badges
- shadcn Dialog, AlertDialog, Sheet, Badge, Accordion, Textarea components

## Discretion Recommendations

### Intake Settings Carry-Over
**Recommendation:** Carry over `representation`, `approach`, and `aggressiveness` from the previous session as defaults in the intake form. Reset `dealContext`, `includeExhibits`, and file uploads. Rationale: a lawyer working on multiple deals for the same client will likely keep the same representation and style preferences, but deal context and documents are always different.

### Transmittal Email Editability UX
**Recommendation:** Render the generated transmittal in a `<textarea>` that fills most of the dialog. Place "Copy to clipboard" and "Open in email client" buttons in the dialog footer. Show a small muted note above the textarea: "Edit as needed before sending." This matches the existing pattern of the TrackChangesEditor being editable.

### Finalize Stats/Revision List Layout
**Recommendation:** Top section: summary cards in a row (revisions accepted count, flags count, unreviewed warning if applicable). Below: expandable accordion list of revisions grouped by section, each showing section ref + rationale + small diff preview. Bottom: author name input + download buttons. Use the existing Accordion component from shadcn. Max dialog width `sm:max-w-3xl` to fit diff previews.

### Flag Icon Design
**Recommendation:** Use a small pin/flag SVG icon (14x14px) positioned in the left margin of flagged paragraphs via CSS `::before` pseudo-element. Color-code by category: blue (Business Decision), orange (Risk Alert), purple (For Discussion), gray (FYI). The `document-viewer.tsx` already toggles a `.flagged` CSS class on paragraphs -- extend this with a `data-flag-category` attribute for color coding.

### Read-Only Summary View for Finalized Projects
**Recommendation:** When reopening a finalized project, show the regular review page but with a banner at the top: "This project was finalized on [date]. [Edit] [View Export]". The Edit button clears finalized status and enables full review mode. The View Export button opens the finalize dialog with previously generated files available for re-download. This avoids building an entirely separate view.

## Open Questions

1. **Flag from text selection in document**
   - What we know: Decision says flags can be created from text selection in the document viewer. The document viewer uses `dangerouslySetInnerHTML` for high-fidelity HTML rendering.
   - What's unclear: How to capture text selection within the iframe-like rendered HTML and map it back to a paragraph ID. The `document-viewer.tsx` uses DOM manipulation to add click handlers to `[data-para-id]` elements.
   - Recommendation: Use `window.getSelection()` to detect text selection, find the nearest `[data-para-id]` ancestor of the selection, and open the flag dialog with that paragraph pre-selected. The selected text becomes the `text_excerpt`. This is a standard DOM API that works with `dangerouslySetInnerHTML` content.

2. **Backend session deletion**
   - What we know: Decision says projects are deletable from history with confirmation. There is a `DELETE /api/session/<id>` endpoint that removes from memory.
   - What's unclear: Whether this also deletes from disk (the JSON file in sessions folder).
   - Recommendation: Enhance the DELETE endpoint to also remove the JSON file from the session folder. Currently it only removes from the in-memory `sessions` dict.

3. **Transmittal with revision summary: LLM or template?**
   - What we know: Decision says user can toggle on a summary of key revisions. The current backend generates a basic template.
   - What's unclear: Whether the revision summary should use an LLM call (more natural language) or a template (faster, deterministic).
   - Recommendation: Use a template approach for now -- group revisions by section, show counts and key rationale excerpts. LLM-generated summaries can be deferred to a future enhancement. The template approach is instant and predictable.

## Sources

### Primary (HIGH confidence)
- Codebase files read directly: `routes.py`, `document_service.py`, `store.ts`, `types.ts`, `api.ts`, `flags-tab.tsx`, `new-project-dialog.tsx`, `bottom-bar.tsx`, `header.tsx`, `recent-projects.tsx`, `sidebar.tsx`, `document-viewer.tsx`, `revision-sheet.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `package.json`, `requirements.txt`
- Existing flag endpoints verified in `routes.py` lines 847-909
- Existing finalize endpoints verified in `routes.py` lines 912-1017
- Existing transmittal endpoint verified in `routes.py` lines 1109-1171
- Existing session management endpoints verified in `routes.py` lines 1174-1351
- Track changes implementation verified in `document_service.py` lines 697-872

### Secondary (MEDIUM confidence)
- [Redlines PyPI](https://pypi.org/project/redlines/) - v0.6.1, text comparison library (confirmed installed v0.6.1)
- [JSv4/Python-Redlines](https://github.com/JSv4/Python-Redlines) - Separate project for docx-level comparison (NOT what this project uses)
- [python-docx track changes issue #340](https://github.com/python-openxml/python-docx/issues/340) - Confirmed manual XML approach is the standard workaround
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard) - navigator.clipboard.writeText for copy functionality
- [Mailto URL length limits](https://www.growingwiththeweb.com/2012/07/getting-around-mailto-character-limit.html) - ~2000 char practical limit

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Patterns directly observed from existing code
- Backend completeness: HIGH - All endpoints verified by reading routes.py
- Pitfalls: HIGH - Derived from code analysis and known browser limitations
- Flag category model: MEDIUM - Need to verify backend accepts new category field gracefully

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable -- no rapidly moving dependencies)
