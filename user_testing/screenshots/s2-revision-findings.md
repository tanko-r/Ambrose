# S2: Revision Workflow Testing - QA Findings

**Tester Persona**: Sarah Chen, mid-career real estate attorney (8 yrs), tech-savvy
**Scope**: Revision lifecycle -- generate, view, approve, reject, reset, regenerate
**Date**: 2026-02-11
**App URL**: http://localhost:3000/review/test-sample-psa

---

## Summary

The revision workflow is architecturally sound and well-designed. The bottom sheet panel, track-changes rendering, and clause navigation are all professional-quality. Error handling with optimistic updates and toast notifications works correctly. Several issues relate to the Flask backend being unavailable (expected for this test), but the frontend degrades gracefully. A few minor UX and accessibility issues were found.

---

## What Works Well

1. **Revision panel design** -- The bottom sheet is elegant: header with clause reference, scrollable diff content, rationale section with distinct visual styling (violet left border, gradient background), and action buttons. The 3-snap-height resize cycle (25vh/50vh/100vh) is a nice touch.

2. **Track-changes rendering** -- Insertions are displayed with blue underlined text using `<ins class="diff-ins">` elements. The diff appears both in the document view AND the revision panel simultaneously, giving the user dual context.

3. **Navigation continuity** -- When navigating between clauses while the revision panel is open, the panel stays open and updates its content to match the newly selected clause. If the new clause has no revision, it shows a helpful empty state ("No revision to display. Select a paragraph and generate a revision."). Navigating back to a clause with a revision restores it instantly.

4. **Error handling** -- API failures produce toast notifications (via Sonner) with descriptive messages like "Session not found" or "Failed to fetch". The optimistic update pattern for Reopen correctly reverts state on API failure.

5. **Finalize & Export dialog** -- Excellent summary cards showing revisions approved, items flagged, and risks not yet reviewed. Includes Track Changes Author field and expandable revision list. Professional and informative.

6. **Flag dialog** -- Clean category selection (Attorney, Client, Business Decision, Risk Alert, For Discussion, FYI) with optional note field. Well-organized.

7. **Loading states** -- When generating/regenerating revisions, the button is replaced by a spinner + rotating verb text. The UI remains responsive and returns to normal state after completion or failure.

8. **Sidebar-action bar integration** -- The sidebar footer cleanly shows clause-specific actions (flag, View Revision/Generate Revision, Regenerate) while the global bottom bar shows project-level actions (Generate Transmittal, Finalize Redline).

---

## Issues Found

### ISSUE 1: Transmittal dialog shows "0 accepted revisions" despite 1 existing
| Field | Detail |
|-------|--------|
| **What tested** | Clicked "Generate Transmittal" button in bottom bar |
| **Expected** | Dialog should show "1 accepted revision" (matching the Finalize dialog and navigator counter) |
| **Actual** | Dialog footer shows "0 flags - 0 accepted revisions" while Finalize dialog correctly shows "1 revisions approved" |
| **Severity** | Medium -- data inconsistency between two dialogs viewing the same state |
| **Screenshot** | `s2-revision-14-transmittal-dialog.png` vs `s2-revision-15-finalize-dialog.png` |
| **Notes** | Likely the transmittal dialog reads from the API response (which failed with 404) while the finalize dialog reads from the Zustand store |

### ISSUE 2: Reopen/Reject/Approve API calls fail when backend is unavailable (no graceful offline mode)
| Field | Detail |
|-------|--------|
| **What tested** | Clicked "Reopen" on an approved revision |
| **Expected** | Error toast with actionable message |
| **Actual** | Toast shows generic "Failed to fetch" -- not user-friendly for an attorney |
| **Severity** | Low (backend dependency expected) but the error message should be more descriptive, e.g. "Unable to connect to server. Please check your connection." |
| **Screenshot** | `s2-revision-06-reopen-error-toast.png` |

### ISSUE 3: Prev/Next navigation buttons have no aria-labels
| Field | Detail |
|-------|--------|
| **What tested** | Inspected the chevron prev/next buttons in the bottom navigation bar |
| **Expected** | Buttons should have `aria-label="Previous clause"` and `aria-label="Next clause"` |
| **Actual** | Both chevron buttons have no `aria-label`, no `title`, no text content |
| **Severity** | Low -- accessibility issue, screen readers cannot identify these buttons |
| **Screenshot** | `s2-revision-17-final-state.png` (bottom bar) |

### ISSUE 4: Flag icon button has `title` but no `aria-label`
| Field | Detail |
|-------|--------|
| **What tested** | Inspected the flag icon button in the sidebar footer |
| **Expected** | Should have `aria-label="Flag this clause"` for screen reader support |
| **Actual** | Has `title="Flag this clause"` (native browser tooltip) but no `aria-label` |
| **Severity** | Low -- accessibility issue; `title` provides native tooltip but is not reliably announced by all screen readers |
| **Screenshot** | `s2-revision-17-final-state.png` |

### ISSUE 5: React warnings for missing Dialog description
| Field | Detail |
|-------|--------|
| **What tested** | Opened the Flag dialog |
| **Expected** | No console warnings |
| **Actual** | Console shows "Warning: Missing `Description` or `aria-describedby` ..." for the dialog component (appears twice) |
| **Severity** | Low -- accessibility warning; dialog should have a `DialogDescription` or `aria-describedby` |
| **Screenshot** | `s2-revision-16-flag-dialog.png` |

### ISSUE 6: No visual distinction between "approved" vs "not reviewed" clauses in the navigator
| Field | Detail |
|-------|--------|
| **What tested** | Scanned the navigator list for visual indicators of revision status |
| **Expected** | Clauses with approved revisions should be visually distinct (e.g., checkmark, green tint, strikethrough of risk count) |
| **Actual** | Only clause 1F has a small checkmark icon. Other clauses show no status. The checkmark is subtle and easy to miss |
| **Severity** | Medium -- As Sarah reviews 99 clauses, she needs at-a-glance progress tracking. The small checkmark is insufficient for a document with dozens of clauses |
| **Screenshot** | `s2-revision-02-clause-1f-selected.png` |

### ISSUE 7: Track-changes diff uses blue underline only -- no red strikethrough for deletions
| Field | Detail |
|-------|--------|
| **What tested** | Examined the track-changes rendering in the revision panel |
| **Expected** | Traditional track-changes style: red strikethrough for deletions, green/blue underline for additions |
| **Actual** | Only blue underlined `<ins>` elements for additions. No `<del>` elements exist in the test revision (it only has additions, no deletions). Cannot confirm deletion styling works |
| **Severity** | Info -- Cannot fully test since the sample revision has no deletions. The `<del>` rendering path needs testing with a revision that removes text |
| **Screenshot** | `s2-revision-04-panel-expanded.png` |

### ISSUE 8: Revision panel at 25vh snap hides the diff content, shows only rationale
| Field | Detail |
|-------|--------|
| **What tested** | Opened revision panel at default 25vh snap height |
| **Expected** | Should show at least the diff content or a clear indication that content is scrollable |
| **Actual** | At 25vh, the panel header and rationale are visible, but the diff text is barely visible (1-2 lines). The panel opens at 50vh initially (good), but clicking resize cycles to 25vh first which is too small to be useful |
| **Severity** | Low -- The 25vh snap is somewhat useless for revision review. Consider starting the cycle at 50vh and going to 100vh, then back to 50vh (skip 25vh) |
| **Screenshot** | `s2-revision-12-panel-open-before-nav.png` |

---

## Test Matrix

| Test Case | Result | Notes |
|-----------|--------|-------|
| Find clause with existing revision (1F) | PASS | Checkmark icon visible, "View Revision" button appears |
| Find clause without revision (5A, 5B) | PASS | "Generate Revision" button appears |
| Open revision panel (View Revision) | PASS | Bottom sheet slides up with diff + rationale |
| Revision panel header | PASS | Shows "1F -- Leases. All right, title and interest..." |
| Track-changes insertions | PASS | Blue underlined text via `<ins class="diff-ins">` |
| Track-changes deletions | UNTESTED | No deletions in sample data |
| Rationale display | PASS | Italic text with violet accent border, clear explanation |
| Panel resize (3 snap heights) | PASS | Cycles 25vh -> 50vh -> 100vh correctly |
| Panel close (X button) | PASS | Panel slides down, can be reopened |
| Approved status display | PASS | Green "Approved" text with checkmark icon |
| Reopen button | PASS (frontend) | Optimistic update + revert on API failure works |
| Approve button | UNTESTED | Revision already approved; API unavailable |
| Reject button | UNTESTED | API unavailable |
| Reset button | UNTESTED | Only appears when user edits diff; API unavailable |
| Generate Revision | PASS (frontend) | Shows spinner, calls API, shows toast error on failure |
| Regenerate | PASS (frontend) | Same flow as Generate, preserves existing revision on failure |
| Navigation with panel open | PASS | Panel updates to new clause content seamlessly |
| Prev/next nav arrows | PASS | Counter updates (5 of 99 -> 6 of 99), clause selection changes |
| Generate Transmittal button | PASS | Opens dialog with subject, text area, email/clipboard actions |
| Finalize Redline button | PASS | Opens dialog with summary cards, revision list, author field |
| Flag button | PASS | Opens flag dialog with 6 categories + note field |
| Reviewed counter | PASS | Shows "Reviewed: 1/99" accurately |
| Severity dots | PASS | Shows 49 orange, 86 yellow, 35 blue |

---

## Screenshots Index

| Screenshot | Description |
|------------|-------------|
| `s2-revision-01-initial-loaded.png` | App loaded, document visible, no clause selected |
| `s2-revision-02-clause-1f-selected.png` | Clause 1F selected, risks in sidebar, bottom bar buttons |
| `s2-revision-03-view-revision-panel.png` | Revision panel open at 50vh with diff + rationale |
| `s2-revision-04-panel-expanded.png` | Revision panel expanded to 50vh, full diff visible |
| `s2-revision-05-after-reopen-click.png` | After clicking Reopen (API failed, state reverted) |
| `s2-revision-06-reopen-error-toast.png` | Error toast after Reopen failure |
| `s2-revision-07-clause-5a-generate-available.png` | Clause 5A with "Generate Revision" button |
| `s2-revision-08-generate-revision-result.png` | After Generate Revision attempt (returned to normal) |
| `s2-revision-09-generate-loading-state.png` | Loading spinner during revision generation |
| `s2-revision-10-generate-error-toast.png` | Error toast "Session not found" |
| `s2-revision-11-regenerate-result.png` | After Regenerate attempt, toast visible |
| `s2-revision-12-panel-open-before-nav.png` | Panel open at 25vh before navigating to different clause |
| `s2-revision-13-panel-after-nav-no-revision.png` | Panel showing empty state after navigating to clause 5B |
| `s2-revision-14-transmittal-dialog.png` | Generate Transmittal dialog (shows 0 accepted revisions - bug) |
| `s2-revision-15-finalize-dialog.png` | Finalize & Export dialog with summary cards |
| `s2-revision-16-flag-dialog.png` | Flag for Review dialog with categories |
| `s2-revision-17-final-state.png` | Final state of the app |
