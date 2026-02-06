# Conversation Snapshot: UI/UX Design Session
**Date:** 2026-01-29
**Branch:** `app-redesign-01-29-2026`
**Parent Branch:** `Collaborative-Review-App` at commit `6bd3231`

---

## Session Summary

Extended UI/UX design session using the `frontend-design` skill to extract David's workflow and mental model for contract review. The goal: design an interface that replicates how a seasoned transactional attorney thinks and works.

---

## Key Decisions Made

### 1. Workflow Insights Extracted

| Aspect | David's Preference |
|--------|-------------------|
| **First action on new contract** | Skim TOC/structure before substance |
| **Markup style** | In-document comments (Word muscle memory) |
| **Issue triage** | Risk-first: "How bad if this goes wrong?" |
| **Mental categorization** | Hybrid: severity + type + negotiation strategy |
| **Context sensitivity** | High-stakes sophisticated deals; client risk appetite + market conditions matter most |
| **AI interaction** | "Give me your best shot" — minimal hand-holding |
| **Review mode** | Hybrid linear + batch by category |

### 2. UI Layout Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [≡] Contract Title    │  [Progress: X/Y issues]  │  [Settings] [?] [Export]│
├──────────────┬──────────────────────────────────────┬───────────────────────┤
│              │                                      │                       │
│  NAVIGATION  │      DOCUMENT CANVAS (55%)           │  CLAUSE ANALYSIS (45%)│
│  PANE        │      (Word-faithful rendering)       │  SIDEBAR              │
│  (collapsible)│                                     │                       │
│              │                                      │  [Risks][Related]     │
│  ▼ Article 1 │  ┌────────────────────────────┐     │  [Definitions]        │
│    § 1.1     │  │ Clause text rendered       │     │  [History][Actions]   │
│    § 1.2 ●   │  │ with original formatting   │     │                       │
│  ▼ Article 2 │  │                            │     │  (Tabbed interface)   │
│              │  └────────────────────────────┘     │                       │
│  [Batch View]│                                      │                       │
├──────────────┴──────────────────────────────────────┴───────────────────────┤
│  [Export Word]  [Transmittal Email]  [Linear/Batch]  [◀ Prev] [Next ▶]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Panel ratios:** Collapsible nav / 55% document / 45% sidebar

### 3. Sidebar Renamed & Restructured

- **Name:** "Clause Analysis" (not "Risk Analysis")
- **Interface:** Tabbed (not dropdowns/accordions)
- **Tabs:** [Risks] [Related] [Definitions] [History] [Actions]

### 4. "Related" Tab Enhancement

Shows **semantically connected clauses**, not just textual cross-references:
- Rep/warranty → survival period, caps, knowledge definitions
- Indemnity → basket, deductible, materiality scrape
- These are **editable in the sidebar** for quick harmonization

### 5. Client Risk Appetite (Intake Form)

Three radio options with explanations:
- **Conservative:** "Maximize protections even at risk of slowing negotiations. Flag all deviations from preferred form."
- **Moderate:** "Balance protection with deal velocity. Push on material issues, accept market-standard positions elsewhere."
- **Aggressive:** "Prioritize closing. Only flag high-severity risks and provisions that deviate significantly from market."

### 6. Risk Display

- **Color coding:** Red/yellow/green traffic light
- **Combined severity + category:** e.g., "HIGH - Indemnity"
- **Dual categorization:** By legal domain AND by risk type

### 7. Backend Maps (Not User-Facing)

- **Concept Map:** Backend artifact feeding Gemini prompts with document structure/relationships
- **Risk Map:** Backend artifact powering UI (populates sidebar, issue counts, batch categories)
- User doesn't see "the maps" directly — they see the *outputs* in the interface

### 8. Anti-Patterns to Avoid

- Slow/laggy document rendering
- Forced linear workflows ("Next" button spam)
- Poor keyboard navigation

### 9. "Magic Moments" to Achieve

- Instantly understanding document context
- Suggesting redlines that sound like David wrote them
- Connecting related issues across the document proactively
- Dramatically faster than manual workflow (8h → 2h)

---

## Files Reviewed from WSL_Files

These files from the abandoned WSL branch contain valuable code ready for import:

| File | Purpose | Import Target |
|------|---------|---------------|
| `concept_map.py` | ConceptMap class with `to_prompt_format()` | `app/models/concept_map.py` |
| `risk_map.py` | RiskMap + Risk classes with relationship tracking | `app/models/risk_map.py` |
| `WSL_map_updater.py` | Detects concept changes, updates maps on accept | `app/services/map_updater.py` |
| `WSL_gemini_service.py` | Enhanced revision prompts with concept/risk context | Merge into `app/services/gemini_service.py` |
| `WSL_claude_service.py` | Analysis prompts extracting concept map + relationships | Merge into `app/services/claude_service.py` |
| `WSL_routes.py` | Additional endpoints (reanalyze, accept with map update) | Merge into `app/api/routes.py` |
| `WSL_reanalysis.js` | UI for affected clauses notification | `app/static/js/reanalysis.js` |
| `WSL_revision.js` | Inline track-changes editing, related revisions panel | `app/static/js/revision.js` |

### Key Architecture Patterns

1. **Risk Relationships:** `mitigated_by`, `amplified_by`, `triggers` create dependency graph
2. **Reactive Map Updates:** Accept revision → detect concept changes → recalculate affected risk severities
3. **Context-Aware Prompts:** Gemini receives formatted concept map + risk matrix

---

## Next Steps (When Resuming)

1. **Copy WSL model files** to `app/models/`
2. **Merge enhanced services** into existing service files
3. **Build UI prototype** based on the spec above
4. **Test with sample PSA document**

---

## How to Resume This Session

This snapshot captures the state of our conversation. To continue:

1. You're on branch `app-redesign-01-29-2026`
2. The parent branch `Collaborative-Review-App` is at commit `6bd3231`
3. All WSL_Files have been committed
4. Reference this document for context

Start by asking: "Let's continue the UI redesign from the 01-29 snapshot"
