---
status: complete
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
  artifacts: []
  missing: []

- truth: "Select text in document, floating Flag button appears reliably, clicking it opens Flag Dialog"
  status: failed
  reason: "User reported: select works weirdly, it disappears and only pops up a flag button after selecting again. clicking flag does not reliably open the flag dialog."
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "Finalize dialog shows all approved revisions with correct stats, clean layout, and author name"
  status: failed
  reason: "User reported: not all approved changes included; should say 'Approved Revisions' not 'Accepted'; text/icons aligned funny; rethink display layout; remove Original/Revised text from accordion; author name should autofill"
  severity: major
  test: 5
  artifacts: []
  missing: []
