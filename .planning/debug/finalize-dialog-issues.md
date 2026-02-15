---
status: diagnosed
trigger: "Finalize dialog not showing all approved revisions and has layout/content issues"
created: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:00:00Z
---

## Issue #1: Not All Approved Changes Included in Dialog

### ROOT CAUSE: Dual data source mismatch + related_revisions never promoted

The finalize dialog pulls revision data from TWO different sources that can diverge:

1. **Stat count** (`acceptedCount` on line 55-58 of finalize-dialog.tsx) reads from the **frontend Zustand store** (`store.revisions`), filtering by `r.accepted === true`.

2. **Revision list** (`preview.revisions` on line 164-199) comes from the **backend API** (`POST /api/finalize/preview`), which reads `session['revisions']` and filters by `r.get('accepted', False)`.

These two sources can diverge because:

#### Cause A: `reopen()` is client-only (no backend sync)

**File:** `frontend/src/hooks/use-revision.ts`, lines 168-177

```typescript
const reopen = useCallback((paraId: string) => {
    const { revisions, setRevision } = useAppStore.getState();
    const current = revisions[paraId];
    if (!current) return;
    setRevision(paraId, { ...current, accepted: false });
    toast.info("Revision reopened for editing");
}, []);
```

There is NO backend API call here. The frontend sets `accepted: false` but the backend still has `accepted: true`. When the dialog opens:
- `acceptedCount` (frontend) will NOT count reopened revisions
- `preview.revisions` (backend) WILL include reopened revisions

This means the LIST shows more items than the COUNT, or vice versa after re-accepting.

#### Cause B: Inline-edited text not sent to backend on accept

**File:** `frontend/src/hooks/use-revision.ts`, lines 81-126

When accepting with edits (lines 89-95), the edited `revised` text is written to the Zustand store BEFORE the API call, but the API call (`POST /api/accept`) only sends `session_id` and `para_id` -- it does NOT send the updated `revised` text. The backend still has the original AI-generated text.

Consequence: The preview shows stale revision text (original AI output) even though the user edited it before accepting.

#### Cause C: `related_revisions` are never promoted to top-level entries

**File:** `app/api/routes.py`, lines 652-662 (revise endpoint stores related_revisions nested inside parent)
**File:** `app/api/routes.py`, lines 992-1013 (finalize_preview only iterates top-level `revisions.items()`)

When Gemini returns `related_revisions` (changes to OTHER paragraphs needed for cross-reference consistency), they are stored as a nested array within the parent revision:

```python
session['revisions'][para_id] = {
    ...
    'related_revisions': revision.get('related_revisions', []),
    ...
}
```

These related revisions are NEVER promoted to independent entries in `session['revisions']`. So:
- They never appear in the finalize preview
- They never get exported in the final document
- They are silently lost

**Note:** In current test data (`test-sample-psa.json`), all `related_revisions` arrays are empty `[]`, so this hasn't surfaced yet. It will become a problem once the Gemini model returns actual related revisions.

### Evidence

| What | Where | Finding |
|------|-------|---------|
| Frontend stat source | finalize-dialog.tsx:55-58 | Reads `store.revisions`, filters `r.accepted` |
| Backend list source | routes.py:992-1013 | Reads `session['revisions']`, filters `accepted` |
| Reopen is local-only | use-revision.ts:168-177 | No API call, sets `accepted: false` only in store |
| No unaccept API | routes.py (full search) | No endpoint exists for reversing acceptance |
| Accept doesn't send edits | use-revision.ts:98-101 | `acceptRevision({session_id, para_id})` -- no `revised` field |
| Related revisions nested | routes.py:658, gemini_service.py:360 | Stored inside parent, not as separate entries |
| Finalize skips nested | routes.py:992-1013, document_service.py:647-664 | Only iterates top-level revisions dict |

### Recommended Fix

1. **Add backend `PATCH /api/revision/:para_id` or `POST /api/unaccept`** so `reopen()` syncs state
2. **Send edited text on accept**: Include `revised` and `editedHtml` in the `POST /api/accept` payload
3. **Promote related_revisions**: When accepting a revision that has `related_revisions`, create independent entries in `session['revisions']` for each related para_id
4. **Use single data source in dialog**: Either compute everything from the backend preview, or compute everything from the store -- don't mix

---

## Issue #2: Uses "Accepted" Terminology Instead of "Approved Revisions"

### Current Code

**File:** `frontend/src/components/dialogs/finalize-dialog.tsx`

- Line 122: `"revisions accepted"` (stat box label)
- Line 204: `"No accepted revisions to export."` (empty state)
- Line 240: `disabled={exporting || acceptedCount === 0}` (variable name)

The user prefers "Approved Revisions" terminology. The toast messages in `use-revision.ts` already say "Revision approved" (line 114, 117), creating an inconsistency.

### Fix

Replace "accepted" with "approved" in all user-facing text in the dialog. The variable name `acceptedCount` is internal and can stay, but UI labels should say "approved".

---

## Issue #3: Text and Icons in Stats Boxes Aligned Oddly

### Current Code

**File:** `frontend/src/components/dialogs/finalize-dialog.tsx`, lines 114-154

```tsx
<div className="flex flex-1 items-center gap-2 rounded-md border p-3">
  <CheckCircle2 className="h-5 w-5 text-green-600" />
  <div>
    <div className="text-lg font-semibold tabular-nums">{acceptedCount}</div>
    <div className="text-xs text-muted-foreground">revisions accepted</div>
  </div>
</div>
```

Layout: Icon is vertically centered (`items-center`) against the combined height of the number + label. The icon and the large number text are at different visual baselines. The third stat box conditionally hides the number (line 145: `unreviewedCount > 0 ? unreviewedCount : ""`) when all clauses are reviewed, which makes the "All risk clauses reviewed" text shift up since there's no number above it.

### Fix

- Consider `items-start` or custom alignment so icons align with the number
- Or restructure to put icon + number on one line, label on next line
- Handle the empty-number case in the third box (show "0" or a checkmark instead of empty string)

---

## Issue #4: Original and Revised Text Shown in Accordion (User Wants Only Diff)

### Current Code

**File:** `frontend/src/components/dialogs/finalize-dialog.tsx`, lines 180-196

```tsx
<AccordionContent className="px-3">
  <div
    className="revision-diff text-xs"
    dangerouslySetInnerHTML={{ __html: rev.diff_html }}
  />
  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
    <div>
      <span className="font-medium">Original:</span>{" "}
      {rev.original.slice(0, 120)}
      {rev.original.length > 120 ? "..." : ""}
    </div>
    <div>
      <span className="font-medium">Revised:</span>{" "}
      {rev.revised.slice(0, 120)}
      {rev.revised.length > 120 ? "..." : ""}
    </div>
  </div>
</AccordionContent>
```

The `diff_html` is already rendered (line 181-184), which shows the track-changes-style diff. Below that, lines 185-196 redundantly show truncated original and revised plain text.

### Fix

Remove the original/revised plain text block (lines 185-196). The `diff_html` already conveys the changes visually. If the user wants to see full text, expand the diff display rather than showing truncated duplicates.

---

## Issue #5: Author Name Input Doesn't Autofill

### Current Code

**File:** `frontend/src/components/dialogs/finalize-dialog.tsx`, line 43

```tsx
const [authorName, setAuthorName] = useState("");
```

The author name is initialized to empty string. There's no attempt to:
- Read from a stored user preference
- Read from session metadata
- Use a default like "David" or the user's name from any profile

The placeholder says `"e.g., David Smith"` (line 218) but the actual value is always empty.

### Fix

Options:
1. Store `authorName` in the Zustand store and persist across dialog opens
2. Default to a value from session settings (e.g., from intake form or environment)
3. Use `localStorage` to remember the last-used author name
4. At minimum, default to the placeholder value or a config constant

---

## Summary of All Issues

| # | Issue | Severity | Root Cause |
|---|-------|----------|------------|
| 1 | Missing approved changes | High | Dual data sources (store vs API) diverge; `reopen()` has no backend sync; related_revisions never promoted |
| 2 | "Accepted" vs "Approved" | Low | Hardcoded string, simple text change |
| 3 | Stat box alignment | Low | `items-center` + conditional empty number |
| 4 | Redundant original/revised text | Low | Extra block below diff_html |
| 5 | Author name not autofilled | Low | `useState("")` with no persistence |

### Files Involved

- `C:\Users\david\Documents\claude-redlining\frontend\src\components\dialogs\finalize-dialog.tsx` -- Dialog component (issues 1-5)
- `C:\Users\david\Documents\claude-redlining\frontend\src\hooks\use-revision.ts` -- Accept/reopen logic (issue 1)
- `C:\Users\david\Documents\claude-redlining\frontend\src\hooks\use-finalize.ts` -- Preview fetch (issue 1)
- `C:\Users\david\Documents\claude-redlining\frontend\src\lib\store.ts` -- Zustand store, no author persistence (issues 1, 5)
- `C:\Users\david\Documents\claude-redlining\app\api\routes.py` -- Backend finalize_preview and accept endpoints (issue 1)
- `C:\Users\david\Documents\claude-redlining\app\services\document_service.py` -- generate_final_documents (issue 1, related_revisions)
