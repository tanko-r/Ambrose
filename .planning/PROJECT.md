# Claude Redlining

## What This Is

A collaborative legal contract review tool that helps attorneys analyze documents for risks and opportunities, then generate surgical redlines. Built for David, a real estate lawyer, to reduce the 8+ hours typically spent manually redlining PSAs and other complex agreements.

## Core Value

The tool must analyze contracts intelligently (understanding cross-clause relationships) and generate precise, surgical redlines that attorneys can confidently present to clients and opposing counsel.

## Requirements

### Validated

- ✓ Document intake with DOCX upload, representation selection, aggressiveness level — existing
- ✓ Contract parsing with section hierarchy, numbering, and defined term extraction — existing
- ✓ Risk analysis via Claude Opus with concept mapping and cross-clause awareness — existing
- ✓ Risk/opportunity display in sidebar with severity and related clauses — existing
- ✓ Revision generation via Gemini Flash with track-changes visualization — existing
- ✓ Revision acceptance with automatic concept/risk map updates — existing
- ✓ Flagging paragraphs for client or attorney review — existing
- ✓ Session persistence to disk with resume capability — existing

### Active

- [ ] **FIN-01**: Finalize Redline exports Word doc with track changes preserving original formatting
- [ ] **FIN-02**: Finalize Redline also exports clean Word doc showing final text only
- [ ] **TRANS-01**: Generate Transmittal opens default email client with summary prefilled
- [ ] **TRANS-02**: Transmittal includes high-level summary of revisions and all client flags
- [ ] **PREC-01**: Compare Precedent opens precedent document in separate panel alongside current paragraph
- [ ] **PREC-02**: Compare Precedent highlights matching/relevant clauses in precedent
- [ ] **NEW-01**: New Project prompts to save current work before clearing
- [ ] **NEW-02**: New Project returns to fresh intake form after save/discard decision

### Out of Scope

- User authentication — single-user local tool for now
- Multi-user collaboration — concurrent editing not needed
- Cloud deployment — runs locally on attorney's machine
- Automatic clause library building — may add in future milestone

## Context

This is a brownfield project with a working intake, analysis, and revision workflow. The 4 features being added complete the end-to-end experience:

1. **Finalize Redline** closes the loop by producing the actual Word documents attorneys need
2. **Generate Transmittal** automates the cover email that accompanies every redline
3. **Compare Precedent** helps attorneys leverage their preferred forms during review
4. **New Project** enables back-to-back document reviews without restarting the app

The codebase uses Flask (Python) backend with vanilla JS frontend. Document processing relies on python-docx. Track changes will use the redlines library (currently commented out in requirements.txt).

## Constraints

- **Tech stack**: Python/Flask backend, vanilla JS frontend — must integrate with existing architecture
- **Document fidelity**: Output Word docs must preserve original formatting exactly (numbering, styles, fonts)
- **LLM costs**: Use Gemini Flash for generation, Claude Opus only for analysis
- **Local execution**: Tool runs on attorney's local machine, no cloud dependencies beyond LLM APIs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Parallel agent execution for feature implementation | User wants faster development with independent context per feature | — Pending |
| Track changes via python-redlines library | Already identified in codebase, maintains Word compatibility | — Pending |
| Email via default client (mailto:) | Simplest integration, works across Outlook/Gmail/etc | — Pending |

---
*Last updated: 2026-02-01 after initialization*
