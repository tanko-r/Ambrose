---
status: diagnosed
phase: 06-dialogs-finalization
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md
started: 2026-02-10T22:00:00Z
updated: 2026-02-10T22:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Flag Dialog with Category Selection
expected: In the sidebar Flags tab, click the "Add Flag" button. A dialog opens with a 2x2 grid of category choices (Business Decision, Risk Alert, For Discussion, FYI), each with a distinct color. Select a category, optionally type a note, and submit. The flag is created and appears in the Flags tab list.
result: pass
notes: |
  - Date format shows DD/MM/YYYY, should be MM/DD/YYYY (locale-dependent). TODO: add to user settings page.
  - Remove quoted language from flag card; instead highlight language in document pane on click.
  - Add edit button (pencil icon) on flag card to allow editing.

### 2. Flags Tab Listing and Management
expected: The Flags tab shows all created flags as cards with category badge (colored), the flagged text or paragraph reference, and a remove button. Clicking the remove button on a flag removes it. Clicking a flag card navigates/scrolls to the flagged paragraph in the document.
result: issue
reported: "clicking does not navigate to the clause when clicked. otherwise pass."
severity: major

### 3. Document Margin Flag Icons
expected: Paragraphs that have flags display a colored icon in the left margin. The icon color corresponds to the flag's category (different colors for Business Decision, Risk Alert, For Discussion, FYI). Multiple flags on the same paragraph show the icon.
result: pass
notes: |
  - Icons should be on the right side, not left margin.
  - Hover should show the flag text as tooltip.
  - Click should navigate to the flag in the flags tab/clause panel.

### 4. Text Selection Flagging
expected: Select text in the document viewer by clicking and dragging. A floating "Flag" button appears near the selection. Clicking it opens the Flag Dialog pre-associated with that paragraph. After creating the flag, the margin icon appears on that paragraph.
result: issue
reported: "select works weirdly, it disappears and only pops up a flag button after selecting again. clicking flag does not reliably open the flag dialog."
severity: major

### 5. Finalize Dialog with Stats and Revision Accordion
expected: Opening the Finalize dialog shows 3 stats cards at the top: accepted revision count, flag count, and unreviewed warning count. Below that, an expandable accordion lists each accepted revision with its diff HTML. There's an author name input field for the track changes author.
result: issue
reported: "I don't think all of the approved changes are being included. Additionally, it should be 'Approved Revisions' rather than 'Accepted.' the text and icons in the boxes in the finalize dialog are aligned funny. think through a more sensible way to display this info. do not include the Original and Revised text in the expanded revision accordion. author name input field should autofill with user's name (but add a TODO to include author name preference in settings)"
severity: major

### 6. Finalize Redline Button in Bottom Bar
expected: The bottom bar shows a "Finalize Redline" button. It is disabled when no revisions have been accepted. After accepting at least one revision, the button becomes clickable and opens the Finalize dialog.
result: pass
notes: |
  - Export button in finalize dialog should be "Export" with a dropdown: Redline, Clean, or Both (default Both).

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Clicking a flag card navigates/scrolls to the flagged paragraph in the document"
  status: failed
  reason: "User reported: clicking does not navigate to the clause when clicked. otherwise pass."
  severity: major
  test: 2
  root_cause: "FlagCard outer div has no onClick handler. Navigation callback only wired to tiny Badge element inside card."
  artifacts:
    - path: "frontend/src/components/review/flags-tab.tsx"
      issue: "Line 57: FlagCard outer div missing onClick handler; onClickSection only on inner Badge"
  missing:
    - "Add onClick to FlagCard outer div calling onClickSection(flag.para_id)"
    - "Add cursor-pointer class to indicate clickability"
  debug_session: ".planning/debug/flag-card-navigation.md"

- truth: "Select text in document, floating Flag button appears reliably, clicking it opens Flag Dialog"
  status: failed
  reason: "User reported: select works weirdly, it disappears and only pops up a flag button after selecting again. clicking flag does not reliably open the flag dialog."
  severity: major
  test: 4
  root_cause: "3 interacting bugs: (1) paragraph click handler fires on mouseup after selection, calling selectParagraph which mutates DOM and collapses selection; (2) mousedown on Flag button collapses selection before click fires, removing button from DOM; (3) FlagDialog conditionally rendered on selectionContext which gets nulled when selection clears"
  artifacts:
    - path: "frontend/src/components/review/document-viewer.tsx"
      issue: "Click handler kills selection; mousedown on Flag button clears selection; dialog unmounts on selection clear"
  missing:
    - "Guard paragraph click handler: skip if text is selected"
    - "Add onMouseDown preventDefault to Flag button"
    - "Separate dialogContext state from selectionContext so dialog survives selection clearing"
  debug_session: ".planning/debug/text-selection-flagging.md"

- truth: "Finalize dialog shows all approved revisions with correct stats, clean layout, and author name"
  status: failed
  reason: "User reported: not all approved changes included; should say 'Approved Revisions' not 'Accepted'; text/icons aligned funny; rethink display layout; remove Original/Revised text from accordion; author name should autofill"
  severity: major
  test: 5
  root_cause: "4 data bugs: (A) dialog count from store but list from backend API — can diverge; (B) reopen() only updates frontend, no backend sync; (C) inline edits not sent to backend on accept; (D) related_revisions nested inside parent, never promoted to top-level for export. Plus UI issues: wrong terminology, bad alignment, redundant text, no author autofill."
  artifacts:
    - path: "frontend/src/components/dialogs/finalize-dialog.tsx"
      issue: "Dual data source mismatch; hardcoded 'accepted'; items-center alignment; Original/Revised text shown; no author default"
    - path: "frontend/src/hooks/use-revision.ts"
      issue: "reopen() no backend sync (line 168); accept doesn't send edited text (line 89)"
    - path: "app/api/routes.py"
      issue: "related_revisions nested, not promoted for finalize preview (line 658/992)"
  missing:
    - "Use single data source (store) for dialog revision list"
    - "Add POST /api/unaccept endpoint for reopen()"
    - "Send edited text in accept payload"
    - "Promote related_revisions to top-level entries for export"
    - "Rename 'Accepted' to 'Approved Revisions'"
    - "Fix stat box alignment"
    - "Remove Original/Revised text from accordion"
    - "Autofill author name with default"
  debug_session: ".planning/debug/finalize-dialog-issues.md"
