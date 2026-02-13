# Phase 6: Dialogs + Finalization - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the end-to-end workflow with four dialogs: flag items for client review, finalize and export Word documents with track changes, generate a transmittal email summarizing the review, and manage project transitions (new project, reopen). Covers requirements FIN-01..04, TRANS-01..04, NEW-01..04.

</domain>

<decisions>
## Implementation Decisions

### Flag dialog
- Flags capture: category + free-text note
- Four categories: Business Decision, Risk Alert, For Discussion, FYI
- Flag can be created from sidebar risk cards AND from text selection in the document
- Flagged paragraphs show a small flag/pin icon in the document margin (no text highlight)
- Flags tab in sidebar lists all flagged items

### Finalize & export
- Finalize dialog shows: high-level stats (X revisions accepted, Y flagged) plus expandable revision list
- Produces two Word documents: track changes (redline) + clean (changes accepted)
- Both files download directly (no ZIP bundle)
- User can finalize with unreviewed risks remaining — show warning with count of unreviewed items
- No cherry-picking in finalize dialog — all accepted revisions are exported
- Track changes author name is configurable in the finalize dialog (text input)
- Formatting preservation already handled by Phase A pipeline — reuse same approach
- Session stays open after export — user can keep reviewing and re-export
- Finalize marks the document as "Finalized" in project history; user can reopen to continue editing (which clears finalized status)

### Transmittal email
- Default content: flagged items only (each flag with its category, paragraph reference, and note)
- Configurable: user can toggle on a summary of key revisions in addition to flags
- Delivery: both "Copy to clipboard" and "Open in email client" (mailto:) buttons
- Tone: professional but conversational ("Attached is our markup of the PSA...")
- Editable in-app before copying/sending (textarea the user can revise)

### New project flow
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

</decisions>

<specifics>
## Specific Ideas

- Finalized status in project history should be visible as a badge, clearing when the user reopens for editing
- "Don't show again" on new project confirmation — respect user's workflow speed preference
- Transmittal defaults to flags-only to keep client communication concise; revision summary is opt-in
- Track changes author field defaults to user's name from intake but is editable at export time

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-dialogs-finalization*
*Context gathered: 2026-02-09*
