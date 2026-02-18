# UI Enhancements & Refinements

Sorted easiest → hardest. Items fully implemented have been removed.

Legend: `🔧 Partial` `🆕 New`

**Last updated:** 2026-02-18 (Issue triage — closed 4 issues, commented on 13, consolidated duplicates)

---

## Tier 2: Small (30 min – 1 hr each)

### 1. Connector elbow routing verification `🔧 Needs verification`
- Elbow routing implemented (straight lines with rounded corners)
- Visual verification needed — does it route cleanly without crossing text?
- Test with flags at different Y positions relative to bubble
- Files: `connector.ts`, `document-viewer.tsx`

### 2. Clause caption generation tweaks `🔧 Needs refinement`
- Current: LLM generates 2-6 word captions, hard-capped at 6 words server-side
- Issue: Some captions may be complete sentences or too verbose
- Needed: Update initial analysis prompt to request 1-7 word **labels** (noun phrases, not sentences)
- Examples: "Delinquent Rents", "Operating Expense Pass-throughs", "Default Notice Period"
- Files: `initial_analyzer.py` (prompt), `routes.py` (word cap logic)

---

## Tier 3: Medium (1–3 hrs each)

### 1. "+New" button broken on review page (#47 H1, H2, M2) `🆕`
- Header on review page doesn't pass `onNewProject` prop — button inert
- `resetSession()` clears `sessions` array — looks like data loss
- New Project Dialog not rendered on review page
- Fix: wire up prop, exclude sessions from reset, render dialog on review page

### 2. `resetSession()` clears recent projects (#47 H2) `🆕`
- "+New" wipes store's `sessions` array
- Fix: exclude `sessions` from reset scope, or re-fetch after reset

### 3. Empty/loading states (#49) `🆕`
- No skeleton loading for document area
- No "no results" state for filtered navigation
- No filter direction clarity ("Hide risks" vs "Show risks")

### 5. Edit mode / review mode toggle (#53) `🆕`
- Add dropdown pill to document pane: Review Mode / Edit Mode
- Review: shortcuts active, read-only. Edit: single-key shortcuts disabled, contentEditable on
- Store in Zustand, persist in localStorage
- Need to thread mode through `useKeyboardShortcuts`

### 6. Text selection lost before flag button (#47 H6) `🆕`
- Selection collapses ~50ms before RAF callback processes it
- DOM mutations from `updateParagraphStates` collapse selection
- Fix: defer mutations or save/restore selection range

### 7. Revision font doesn't inherit from source (#38) `🆕`
- RevisionSheet uses generic styles regardless of source paragraph formatting
- Need to extract computed styles or use CSS class categories from source
- Files: `revision-sheet.tsx`, `track-changes-editor.tsx`, `globals.css`

---

## Tier 4: Large (3–8 hrs each)

### 1. Show revision options before calling agent (#4) `🔧 Partial`
- Currently: click "Generate Revision" → immediately calls agent; `model_instructions` field guides revision
- Needed: show description of how risk could be addressed, present 2+ options (add qualifier, add threshold, delete provision)
- User selects approach → agent called with specific instructions
- Pass full clause text + related language (definitions, interconnecting clauses)
- Requires new UI component + prompt engineering
- **Status (2026-02-18):** Commented on issue — revision workflow exists but no multi-approach selector

### 2. Bookmark clauses / breadcrumbs bar (#16) `🔧 Partial`
- Bookmark any clause with single click + optional label
- Persistent breadcrumbs bar (§4.2, Article VII(b))
- Drag-and-drop reorder, category grouping, keyboard shortcuts
- Persist in session/localStorage
- **Status (2026-02-18):** Flag system covers mark+navigate; breadcrumb bar UX not built

### 3. Document numbering & fidelity (#2, #23, #40) `🔧 Partial`
- MS Word automatic numbering not rendering (1.3, (iv), Section 2.1)
- Multi-level numbering (1.1.1, a.i.α) not handled
- Root cause: `html_renderer.py` doesn't inject extracted numbering into HTML
- Touches backend (`html_renderer.py`, `document_service.py`) and frontend (document viewer, navigation panel)
- Needs testing with real PSA and lease documents
- **Status (2026-02-18):** Backend extraction (NumberingResolver, SectionTracker) works; frontend rendering doesn't use it. #2 and #23 consolidated into #40

### 4. Print/export complete risk analysis (#14) `🆕`
- Full document with inline risk annotations (highlights, margin notes)
- Severity markers, category labels, summary table
- Output formats: HTML, PDF, Word
- New export pipeline

---

## Tier 5: Major Feature (1+ days)

### 1. Interactive visual risk graph (#7) `🆕`
- Risks as nodes with relationship edges (mitigated_by, amplified_by, triggers)
- Click risk → see connected provisions and clauses
- Needs graph library (e.g., react-flow, d3-force)
- Requires risk map data model with edge types

### 2. Document visualization / clause interaction map (#48) `🆕`
- Visualize how clauses interact: cross-references, default traps
- Mind-map or graph view of clause relationships
- Overlaps with #7 — could be combined

---

## Removed (Fully Implemented)

These were on the original list but are confirmed working in the codebase:

### Tier 2 items (Quick Task 7 — 2026-02-16)
- ~~Tooltips on bottom bar filter pills (#51)~~ — shadcn Tooltip with aria-description, "Filter:" prefix
- ~~Missing tooltips on disabled buttons (#49, #52)~~ — Finalize/Transmittal buttons explain prerequisites
- ~~Navigation counter updates with filters (#49)~~ — computes filtered count from active filter pills
- ~~Escape key closes sidebar (#49)~~ — added to priority chain after bottom sheet
- ~~Enter/Space on document paragraphs (#49)~~ — keydown handler mirrors click behavior
- ~~Arrow keys navigate sidebar tabs (#49)~~ — ARIA roving tabindex pattern with Home/End
- ~~Status badges overflow (#47 M1)~~ — flex-wrap + shrink-0 on container
- ~~Transmittal subject line editable (#47 L8)~~ — changed `<p>` to `<Input>`
- ~~Transmittal markdown headers (#47 O8)~~ — plain text ALL-CAPS headers, no `##`
- ~~Empty flag note in transmittal (#47 M7)~~ — fallback "Flagged for review" or text excerpt
- ~~Revision summary word-boundary truncation (#47 M8)~~ — backend + frontend word-aware truncation
- ~~Compact mode visually noticeable (#52 M5)~~ — font sizes, icon sizes, spacing all reduced
- ~~Finalized banner persisted (#47 H7)~~ — `status` hydrated from backend on page load

### UI polish (Quick Task 7 — 2026-02-16)
- ~~Workspace shading~~ — all chrome panels at `bg-muted/70` for paper-on-workspace effect
- ~~Resizable nav/sidebar panes~~ — drag handles with `← →` arrows on hover, clamped ranges
- ~~Stop generation button~~ — square inside spinning circle, static "Generating..." text, no rotating verbs

### Issue triage (2026-02-18)
- ~~Nav search improvements (#9)~~ — tabbed search (all/caption/content), `highlightMatch()`, risk/flag filter toggles
- ~~User focus history / back-forward (#13)~~ — `focusHistory` circular buffer (max 20), `goBackInHistory`/`goForwardInHistory` in store
- ~~Finalize: review dismissed/unaddressed risks (#25)~~ — `unreviewedRisks` with severity sort, expandable accordion, "Go to" navigation
- ~~Risk analysis print/export (#34)~~ — closed as duplicate of #14

### Earlier implementations
- ~~Grammar: "1 revisions approved" (#47 L4)~~ — singular/plural ternary added
- ~~Header missing role="banner" (#49)~~ — added to header.tsx
- ~~Settings/Preferences terminology (#52 L6)~~ — unified to "Settings"
- ~~Color contrast on pagination text (#49)~~ — muted-foreground token already fixed to AA-compliant oklch(0.49)
- ~~Flag shortcut no feedback (#52 M10)~~ — toast added on F key press
- ~~Ctrl+\ behavior unclear (#52 M11)~~ — label clarified to "Toggle Revision Sheet (Bottom Panel)"
- ~~Command palette missing aliases (#52 L13)~~ — keywords added to all commands (dark, theme, preferences, export, email, etc.)
- ~~Risk color visual noise (#55)~~ — only selected paragraph shows risk colors
- ~~Full-width document rendering~~ — `html_renderer.py` scopes body selectors correctly
- ~~Ghost navigators~~ — both implemented with hover trigger, frosted glass, 300ms dismiss
- ~~Legal-themed thinking indicators (#6)~~ — rotating legal verbs in sidebar loader (now removed, replaced with simple "Generating...")
- ~~Flag bubble redesign (#54)~~ — multi-flag, auto-save, trash icon, portal rendering, elbow connector
- ~~Flag edit creates duplicate (#47 H4)~~ — `isEditing` mode with update API implemented
- ~~Flag remove deletes all (#47 H5)~~ — `remove()` now takes `flagId`
- ~~Flag tab gated behind selection (#47 H3)~~ — FlagsTab renders regardless of selection
- ~~Subsection indentation (#23)~~ — hierarchical tree with depth-based margin implemented
- ~~Nav panel risk/flag inline filters~~ — toggle buttons with filtered results working
- ~~Sidebar ARIA role (#49)~~ — correctly uses `role="complementary"`
- ~~Track changes style in sidebar (#3)~~ — diff classes rendering correctly

---

## Deferred / Out of Scope for Now

- Configurable flag audiences with routed transmittals (#46) — still hard-coded binary `client`/`attorney` toggle; major refactor needed
- Session diff / "What did I change?" (#43) — store tracks data, but no dedicated panel, no pattern detection, no mid-review summary
- Clause-level attorney notes (#41) — partially covered by attorney flags; superseded by #46 audience system
- Cross-reference map / ripple effect view (#42) — not started
- Revisions cheatsheet (#26) — not started
- Track changes per-run formatting (#27) — export works but per-word formatting not preserved through diff pipeline
- Performance diagnostics (#37) — works but no timing breakdown or optimization

## Issues Commented On (2026-02-18)

Summary of GitHub issue status updates made during triage:

| Issue | Status | Key Note |
|-------|--------|----------|
| #1 | Partial | Frontend highlighting logic exists; backend field mapping needed |
| #2 | Consolidated | → #40 |
| #4 | Partial | No multi-approach selector before revision generation |
| #16 | Partial | Flags serve as bookmarks; no breadcrumb bar |
| #23 | Consolidated | → #40 |
| #24 | Partial | Flat revision list, not grouped by document section hierarchy |
| #27 | Partial | Export works; per-run formatting not preserved |
| #37 | Partial | No timing diagnostics or batch optimization |
| #40 | Partial | Backend numbering extraction works; frontend doesn't render it |
| #43 | Partial | Data tracked in store; no dedicated summary panel |
| #46 | Not started | Hard-coded binary toggle; audience system not built |
| #47 | 11/32 fixed | H1,H2,H6,M2-M6,M9,L1-L3,L5-L7,O1-O6 still open |
| #49 | ~8/20 fixed | Empty/loading states and remaining items still open |
| #52 | 5 items fixed | Remaining regression items still open |
