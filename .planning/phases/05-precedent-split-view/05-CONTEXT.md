# Phase 5: Precedent Split View - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Side-by-side precedent document viewing with automatic related clause highlighting. The user can compare target contract language against their precedent while reviewing risks and generating revisions. Backend (API endpoints, matching service, HTML renderer) is already complete — this phase builds the React UI that replaces `precedent.js` (1,140 lines of vanilla JS).

</domain>

<decisions>
## Implementation Decisions

### Panel Trigger & Layout
- Precedent opens from the "Related" tab in the sidebar — clicking a related clause link opens the precedent panel scrolled to that clause
- If no related clauses found for the current paragraph, show a single "Open Precedent" link
- When precedent opens, sidebar auto-collapses to a thin restore tab on the left edge (hover/click expands sidebar as overlay without closing precedent)
- Default split ratio: 60% main document / 40% precedent panel
- User can resize panes; sizes persist to localStorage across sessions
- Precedent panel has a filename header bar showing the precedent document name + close button
- Close via X button in header OR keyboard shortcut
- Bottom sheet (revision editor) and precedent panel coexist — bottom sheet overlays the bottom of both panes

### Related Clause Behavior
- Related clauses auto-update when user clicks a paragraph in the main document (no debounce, immediate)
- NO auto-scroll in precedent content area — highlights pulse in the precedent navigator to draw attention, but the content view stays where the user left it
- Clause lock: user can lock the precedent view to a specific clause via lock icon toggle. While locked, navigating the main doc still triggers related clause highlights (pulsing in navigator) but doesn't change which clause the content is focused on
- Unlock by clicking the lock icon again; closing the panel also clears the lock
- Match confidence scores are NOT shown to the user — matches are sorted by confidence so best matches appear first (subtle sort order)
- Clicking a related clause in the navigator scrolls the precedent content to that clause with a brief flash/pulse animation

### Precedent Navigator
- Three position modes (user's choice, persisted to localStorage): right sidebar (default), bottom drawer, or toggle overlay
- Search box at top with text filter + toggle to show only paragraphs with related clause matches
- Paragraph captions: AI determines during initial analysis (Phase B pipeline) whether each paragraph has a descriptive caption (short phrase followed by a period, not a grammatical sentence). If yes, display that caption. If not, AI generates a short descriptive caption.
- Hierarchical display with indentation reflecting document structure (e.g., 3.2(a) indented under 3.2)

### Copy & Reference Flow
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

</decisions>

<specifics>
## Specific Ideas

- The sidebar "Related" tab is the natural entry point — clicking a related clause link opens precedent scrolled to that clause. This means precedent is always opened with context, not as a blank panel.
- Clause lock is the primary interaction model: user locks a clause for deep analysis, freely jumps around both documents, and related clause highlights pulse in the navigator as breadcrumbs without disrupting focus.
- AI-generated paragraph captions in the navigator should be generated during the initial analysis pipeline (Phase B) so there's zero loading delay when opening precedent.
- The precedent text → revision queue flow is non-disruptive: collect precedent references while browsing, then generate/regenerate with all context at once.
- User wants lock behavior as a reusable pattern beyond precedent (captured as deferred idea).

</specifics>

<deferred>
## Deferred Ideas

- **Reusable lock pattern across UI** — User wants the clause lock behavior to extend to other areas (e.g., locking a risk in the sidebar, locking a paragraph in the nav panel). This is a Phase 7 polish item or its own micro-phase.
- **Attorney flags vs client flags distinction** — The flag system categories (attorney/client) affect Phase 6's flag dialog design. Noted here for Phase 6 context.
- **Paragraph caption generation in analysis pipeline** — Requires a backend change to the Phase B analysis pipeline to generate captions for each precedent paragraph. This is a backend enhancement that Phase 5 depends on.

</deferred>

---

*Phase: 05-precedent-split-view*
*Context gathered: 2026-02-08*
