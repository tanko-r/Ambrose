## QA Test Report — Phase 6: Dialogs + Finalization

**Date:** 2026-02-12
**Tester Persona:** Sarah Chen (mid-career real estate attorney, tech-savvy, discerning)
**Branch:** `nextjs-migration`
**Full report:** `qa-reports/qa-report-2026-02-12.md`

Automated QA testing of all Phase 6 features (flags, finalize/export, transmittal, project management) using Playwright browser automation. 4 test waves, 32 total findings.

### Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 7 |
| Medium | 9 |
| Low | 8 |
| Observation | 8 |
| **Total** | **32** |

---

## High Severity (7)

### H1. "+New" button does nothing on review page
**Area:** Dashboard / Header
**Files:** `frontend/src/app/review/[sessionId]/page.tsx`, `frontend/src/components/layout/header.tsx`

Header on review page renders `<Header />` without passing `onNewProject` prop. The `handleNewProject` function silently exits when `onNewProject` is undefined. Button is completely inert from review context — no feedback, no navigation, no error.

**Fix:** Pass `onNewProject` prop from review page, or wire Header to use `useRouter` directly when on review page.

---

### H2. `resetSession()` clears the Recent Projects list
**Area:** Dashboard / Store
**Files:** `frontend/src/lib/store.ts`, `frontend/src/components/dashboard/recent-projects.tsx`

When "+New" calls `resetSession()`, it wipes the store's `sessions` array, making sidebar show "No saved projects yet." Sessions only re-fetch on full page reload. Looks like data loss even though it's only client-side.

**Fix:** Exclude `sessions` from `resetSession()`, or re-fetch sessions from API after reset.

---

### H3. Flags tab inaccessible without paragraph selection
**Area:** Flags / Sidebar
**Files:** `frontend/src/components/review/sidebar.tsx` (line 234), `frontend/src/components/review/flags-tab.tsx` (lines 168-222)

sidebar.tsx gates ALL tab content behind `!selectedParaId`, showing "Click a paragraph..." even when Flags tab is active. FlagsTab has a working "All Flags" view but it's never rendered without a selection. Lawyer who wants to review all flags must first click a paragraph.

**Fix:** Check `activeTab !== "flags"` before showing the empty state, or always render FlagsTab content regardless of selection.

---

### H4. Flag edit creates duplicate instead of updating
**Area:** Flags / Dialog
**Files:** `frontend/src/components/dialogs/flag-dialog.tsx` (line 98), `frontend/src/hooks/use-flags.ts`

Pencil icon opens FlagDialog pre-populated with existing data, but dialog always calls `create()` on submit, never an update function. Button label is always "Add Flag" regardless of context. Editing a flag creates a new flag instead of modifying the existing one.

**Fix:** FlagDialog needs an `isEditing` mode that calls an `update()` API instead of `create()`. Button label should change to "Update Flag" in edit mode.

---

### H5. Flag remove deletes ALL flags on a paragraph, not just one
**Area:** Flags / Backend
**Files:** `frontend/src/hooks/use-flags.ts` (line 42-59), `app/api/routes.py`

`remove()` takes only `paraId` and calls `unflagItem({ session_id, para_id })`, removing every flag on that paragraph. Paragraph with 2 flags loses both when one is removed.

**Fix:** The remove API and function need a flag identifier (index or ID) to target a specific flag.

---

### H6. Text selection visual lost before floating Flag button appears
**Area:** Flags / Document Viewer
**Files:** `frontend/src/components/review/document-viewer.tsx` (lines 308-369)

Selection exists after mouseup but collapses within ~50ms before `requestAnimationFrame` callback processes it. DOM mutations from `updateParagraphStates` (classList.toggle calls) cause browser to implicitly collapse the selection.

**Fix:** Defer `updateParagraphStates` or save selection range before DOM mutations and restore after.

---

### H7. Finalized banner does not appear on page load
**Area:** Finalize / Review Page
**Files:** `frontend/src/hooks/use-document.ts`, `frontend/src/app/review/[sessionId]/page.tsx`

Session status is "finalized" per backend API (`/api/session/{id}/info`), but green banner doesn't show when navigating to review page. `useDocument` hook never fetches or sets the `status` field. Banner only appears after client-side export from FinalizeDialog. Page refresh loses the banner.

**Fix:** Hydrate `status` from backend session info on page load. Either include `status` in the `/api/document/` response or fetch from `/api/session/{id}/info`.

---

## Medium Severity (9)

### M1. Status badges overflow Recent Projects panel at wide viewports
**Area:** Dashboard
**Files:** `frontend/src/components/dashboard/recent-projects.tsx`

At 1920px, badges extend 40-51px past the 280px panel card edge. Filename `truncate` + badge `shrink-0` causes overflow. Works at 1280px.

---

### M2. New Project dialog unreachable from review page
**Area:** Dashboard / Review Page
**Files:** `frontend/src/app/review/[sessionId]/page.tsx`

Dialog only rendered in `app/page.tsx` (dashboard), never in `app/review/[sessionId]/page.tsx`. Combined with H1, entire "+New" feature non-functional from review context.

---

### M3. "Attorney" flag type gets wrong margin icon color
**Area:** Flags / Document Viewer
**Files:** `frontend/src/components/review/document-viewer.tsx` (line 88)

Margin icon color determined by `data-flag-category`, falls back to "for-discussion" (purple) when flag has no category. Attorney flags without categories show misleading purple icon.

---

### M4. No toast on flag creation
**Area:** Flags / UX
**Files:** `frontend/src/hooks/use-flags.ts` (line 32)

After creating a flag, dialog closes but no success toast appears. Code calls `toast.success("Flagged for review")` but it was not visible. Possibly timing or z-index issue with Sonner toast container.

---

### M5. Category selector is a row, not a 2x2 grid
**Area:** Flags / Dialog
**Files:** `frontend/src/components/dialogs/flag-dialog.tsx`

Spec calls for "2x2 category selector grid" but implementation uses single horizontal row of 4 pill buttons. Works at current sizes but doesn't match spec.

---

### M6. "Edit" button on finalized banner is client-only
**Area:** Finalize / Review Page
**Files:** `frontend/src/app/review/[sessionId]/page.tsx` (line 102)

Clicking Edit sets store status to "analyzed" via `setSession()` but makes no API call. Backend continues to report "finalized". State inconsistency between client and server.

---

### M7. Transmittal: flag with empty note text
**Area:** Transmittal / Backend
**Files:** `app/api/routes.py`

First flag renders as `1. [1] (Risk Alert):` with nothing after colon. Backend returns empty note. Would look unprofessional in client email. Should require note text, omit empty-note flags, or display fallback.

---

### M8. Transmittal: revision summary text truncated mid-word
**Area:** Transmittal / Backend
**Files:** `app/api/routes.py`

Revision for [1F] reads "...to capture non-lease occu" — cut off mid-word. Backend truncating at fixed character limit without finding a word boundary.

---

### M9. Transmittal: "Include revision summary" checkbox doesn't reset on dialog reopen
**Area:** Transmittal / Dialog
**Files:** `frontend/src/components/dialogs/transmittal-dialog.tsx`

After checking the box, closing, and reopening, checkbox remains checked. Content is re-fetched but checkbox state persists across open/close cycles.

---

## Low Severity (8)

| # | Area | Finding |
|---|------|---------|
| L1 | Dashboard | No "Not Started" (gray) badge observable — no test data has that status |
| L2 | Flags | Missing `aria-describedby` on FlagDialog — 6 warnings accumulated |
| L3 | Flags | Flag margin icon very small (14x14px) and hard to discover — opacity 0.7, easy to miss |
| L4 | Finalize | Grammar: "1 revisions approved" should be "1 revision approved" — hardcoded plural |
| L5 | Finalize | Re-download buttons show both options regardless of export choice |
| L6 | Finalize | Cannot clear author name from localStorage — `if (authorName)` guard prevents empty write |
| L7 | Transmittal | "Copy to Clipboard" button state change barely visible — no animation or color change |
| L8 | Transmittal | Subject line is read-only — attorneys need to customize (matter numbers, "DRAFT" prefix) |

---

## Observations (8)

| # | Area | Finding |
|---|------|---------|
| O1 | Dashboard | Auto-save on "+New" updates session timestamp, bumping it to top of list |
| O2 | Dashboard | Delete buttons lack `aria-label` (have `title` but screen readers may miss it) |
| O3 | Flags | Flag tooltip only shows first flag's note — multi-flag paragraphs lose info |
| O4 | Flags | No confirmation dialog for flag removal — immediate delete, risky with H5 |
| O5 | Finalize | Unreviewed count shows risks (141) vs paragraph count (99) — potentially alarming |
| O6 | Finalize | Transmittal dialog uses "accepted" (line 185) vs finalize's "approved" terminology |
| O7 | Transmittal | No tooltip on disabled Generate Transmittal button explaining prerequisite |
| O8 | Transmittal | Email uses markdown `##` headers in plain text — literal `##` in email clients |

---

## What Works Well

- **Export workflow** — dropdown options, proper file naming, re-download buttons, "Session remains open"
- **Delete project** — destructive confirmation dialog, alertdialog role, clean server-side removal
- **Flag card navigation** — click card, document scrolls, paragraph selects, sidebar updates
- **Author name localStorage** — persistence across dialog opens, SSR-safe initialization
- **Mailto: fallback** — long-content truncation with clipboard copy and explanatory toast
- **Status badges** — correct semantic colors, clean pill design, only non-zero counts displayed
- **Zero console errors** across all 4 test waves
