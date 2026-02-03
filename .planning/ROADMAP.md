# Roadmap: Claude Redlining

**Created:** 2026-02-01
**Milestone:** v1.0 — Complete Placeholder Features

## Overview

4 phases implementing placeholder UI features. Each phase is **independent** and can run in parallel with separate agents.

| Phase | Name | Goal | Requirements | Status |
|-------|------|------|--------------|--------|
| 1 | Finalize Redline | Export Word docs with track changes | FIN-01, FIN-02, FIN-03, FIN-04 | Pending |
| 2 | Generate Transmittal | Create summary email for client | TRANS-01, TRANS-02, TRANS-03, TRANS-04 | Pending |
| 3 | Compare Precedent | Side-by-side precedent viewing | PREC-01, PREC-02, PREC-03, PREC-04 | Pending |
| 4 | New Project | Session management and reset | NEW-01, NEW-02, NEW-03, NEW-04 | Pending |
| 5 | High-Fidelity Document Rendering | Exact Word formatting in both panels | RENDER-01, RENDER-02, RENDER-03, RENDER-04 | Complete |
| 6 | Analysis Acceleration | Reduce analysis time from 30+ min to <5 min | ACCEL-01, ACCEL-02, ACCEL-03, ACCEL-04 | Pending |

## Phase Details

### Phase 1: Finalize Redline

**Goal:** Enable users to export their review as Word documents ready to send to opposing counsel.

**Requirements:**
- FIN-01: Export Word doc with track changes
- FIN-02: Export clean Word doc (final text only)
- FIN-03: Preserve original formatting exactly
- FIN-04: Show modal to review before export

**Success Criteria:**
1. User clicks "Finalize Redline" and sees modal listing all accepted revisions
2. User can download .docx with track changes that opens correctly in Microsoft Word
3. User can download clean .docx showing final text without markup
4. Downloaded documents preserve original numbering, fonts, and styles
5. Download includes all paragraphs that had revisions accepted

**Dependencies:** None (uses existing revision data in session)

**Implementation Notes:**
- Use python-redlines library for track changes (uncomment in requirements.txt)
- Backend endpoint: POST /api/finalize with response containing download links
- Frontend: Modal component showing revision summary, download buttons

---

### Phase 2: Generate Transmittal

**Goal:** Automate creation of the cover email attorneys send with redlined documents.

**Requirements:**
- TRANS-01: Generate transmittal email
- TRANS-02: Include summary of key revisions
- TRANS-03: Include flagged paragraphs with notes
- TRANS-04: Open default email client

**Success Criteria:**
1. User clicks "Generate Transmittal" and email client opens
2. Email body contains high-level summary of major revisions made
3. Email body lists all client-flagged paragraphs with their notes
4. Email format is professional and ready to send
5. Works with Outlook, Gmail, and other standard email clients

**Dependencies:** None (uses existing flags and revisions in session)

**Implementation Notes:**
- Backend: Generate email content from session data
- Frontend: Use mailto: URL with encoded subject/body
- Consider HTML vs plain text based on email client compatibility

---

### Phase 3: Compare Precedent

**Goal:** Let attorneys view their preferred form alongside the current document for reference.

**Requirements:**
- PREC-01: Open precedent in separate panel
- PREC-02: Full document navigation
- PREC-03: Highlight related clauses
- PREC-04: Allow text copying

**Success Criteria:**
1. User clicks "Compare Precedent" in sidebar and panel opens
2. Panel shows full precedent document with scroll navigation
3. System highlights sections in precedent relevant to current paragraph
4. User can select and copy text from precedent panel
5. Panel can be closed/reopened without losing position

**Dependencies:** Requires precedent document uploaded during intake

**Implementation Notes:**
- Frontend: New panel component (slide-in or split view)
- Backend: Endpoint to get precedent paragraph by ID
- Use existing document parsing to match sections between docs

---

### Phase 4: New Project

**Goal:** Allow attorneys to start a fresh review without restarting the application.

**Requirements:**
- NEW-01: Prompt to save/discard current work
- NEW-02: Save current session to disk
- NEW-03: Return to fresh intake form
- NEW-04: Optional session history

**Success Criteria:**
1. User clicks "New Project" and sees confirmation dialog
2. If "Save" selected, current session persists and can be accessed later
3. If "Discard" selected, session is cleared without saving
4. After either choice, UI shows fresh intake form
5. Previous session data is not mixed with new project

**Dependencies:** None

**Implementation Notes:**
- Frontend: Confirmation modal with Save/Discard/Cancel
- Backend: Session save endpoint (already exists, may need enhancement)
- Reset AppState and reload intake view
- Session history (NEW-04) is optional enhancement

---

### Phase 5: High-Fidelity Document Rendering

**Goal:** Render Word documents in both the main document panel and Compare Precedent panel with maximum fidelity — preserving exact formatting, indentation, automatic numbering, styles, fonts, and visual layout identical to Microsoft Word.

**Requirements:**
- RENDER-01: Document preview matches Word formatting exactly (fonts, sizes, spacing)
- RENDER-02: Automatic numbering renders correctly (1.1, (a), (i), etc.)
- RENDER-03: Indentation and margins preserved precisely
- RENDER-04: Both main panel and precedent panel use same rendering engine

**Success Criteria:**
1. Opening a document in the app produces visually identical rendering to Microsoft Word
2. Automatic numbering schemes (legal, outline, lettered) display correctly
3. Nested indentation levels are preserved
4. Font families, sizes, and styles match the source document
5. Precedent panel renders with same fidelity as main document panel

**Dependencies:** Phase 3 (Compare Precedent panel exists)

**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md — Backend HTML rendering service with docx-parser-converter
- [x] 05-02-PLAN.md — Frontend HTML integration for both panels

**Implementation Notes:**
- docx-parser-converter (already installed v1.0.3) for server-side DOCX→HTML conversion
- Preserves automatic numbering (1.1, 11.3.1 patterns), fonts, indentation, styles
- Pure Python solution — no external dependencies (LibreOffice not needed)
- HTML caching after first conversion
- Paragraph ID injection for click-to-select functionality
- ~100ms conversion time vs 2+ seconds with LibreOffice approach

---

### Phase 6: Analysis Acceleration

**Goal:** Dramatically reduce contract analysis time from 30+ minutes to under 5 minutes by filtering non-substantive content, optimizing API calls, and implementing smart caching.

**Requirements:**
- ACCEL-01: Pre-filter non-substantive paragraphs (blank, headers, signatures, notice addresses)
- ACCEL-02: Skip exhibit analysis when user indicates exhibits should be ignored
- ACCEL-03: Batch and parallelize API calls to Gemini
- ACCEL-04: Implement progress indicators and incremental results display

**Success Criteria:**
1. Standard 30-page PSA completes analysis in under 5 minutes
2. Blank paragraphs, signature blocks, notice addresses, and headers are auto-skipped
3. When user selects "ignore exhibits" in intake, exhibit paragraphs are not sent to LLM
4. Progress bar shows real-time analysis status
5. User sees risks populate incrementally as analysis progresses

**Dependencies:** None (optimizes existing analysis pipeline)

**Plans:** 3 plans

Plans:
- [ ] 06-01-PLAN.md — Content pre-filtering service (ACCEL-01, ACCEL-02)
- [ ] 06-02-PLAN.md — Parallel async analyzer with rate limiting (ACCEL-03)
- [ ] 06-03-PLAN.md — Progress streaming and incremental UI updates (ACCEL-04)

**Implementation Notes:**
- Pre-parse pass to classify paragraphs as substantive vs mechanical
- Regex patterns for signature blocks, notice addresses, exhibit markers
- Batch multiple paragraphs per API call where context allows
- Parallel API calls with rate limiting
- Streaming/incremental UI updates

---

## Parallel Execution Strategy

All 4 phases are **independent** and will be executed with separate agents in parallel:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Agent 1         │  │ Agent 2         │  │ Agent 3         │  │ Agent 4         │
│ Finalize Redline│  │ Gen Transmittal │  │ Compare Preced. │  │ New Project     │
│                 │  │                 │  │                 │  │                 │
│ FIN-01..FIN-04  │  │ TRANS-01..04    │  │ PREC-01..04     │  │ NEW-01..04      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼
    Commit to branch     Commit to branch     Commit to branch     Commit to branch
```

Each agent:
1. Implements its feature completely (backend + frontend)
2. Tests the implementation
3. Commits changes to the branch

---

## Success Metrics

- All 16 v1 requirements implemented
- All placeholder "Coming soon!" messages replaced with working features
- Each feature has at least basic error handling
- No regressions in existing functionality

---
*Roadmap created: 2026-02-01*
