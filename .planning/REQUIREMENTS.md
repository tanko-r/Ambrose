# Requirements: Claude Redlining

**Defined:** 2026-02-01
**Core Value:** Analyze contracts intelligently and generate precise, surgical redlines

## v1 Requirements

Requirements for completing placeholder UI features.

### Finalization

- [ ] **FIN-01**: User can export Word document with track changes showing all accepted revisions
- [ ] **FIN-02**: User can export clean Word document showing final text only (no markup)
- [ ] **FIN-03**: Exported documents preserve original formatting exactly (numbering, styles, fonts)
- [ ] **FIN-04**: Finalize button shows modal to review accepted revisions before export

### Transmittal

- [ ] **TRANS-01**: User can generate transmittal email summarizing the review
- [ ] **TRANS-02**: Transmittal includes high-level summary of key revisions made
- [ ] **TRANS-03**: Transmittal includes all paragraphs flagged for client review with notes
- [ ] **TRANS-04**: Generate Transmittal opens default email client with content prefilled

### Precedent Comparison

- [ ] **PREC-01**: User can open precedent document in separate panel from sidebar
- [ ] **PREC-02**: Precedent panel displays full document with navigation
- [ ] **PREC-03**: System highlights clauses in precedent that relate to current paragraph
- [ ] **PREC-04**: User can copy text from precedent panel for reference

### New Project

- [ ] **NEW-01**: New Project menu item prompts user to save or discard current work
- [ ] **NEW-02**: If save selected, current session is preserved to disk
- [ ] **NEW-03**: After save/discard decision, UI returns to fresh intake form
- [ ] **NEW-04**: Session history allows returning to previous projects (optional enhancement)

### Document Rendering

- [x] **RENDER-01**: Document preview matches Word formatting exactly (fonts, sizes, spacing)
- [x] **RENDER-02**: Automatic numbering renders correctly (1.1, (a), (i), etc.)
- [x] **RENDER-03**: Indentation and margins preserved precisely
- [x] **RENDER-04**: Both main panel and precedent panel use same high-fidelity rendering engine

## v2 Requirements

Deferred to future release.

### Document Library

- **LIB-01**: User can browse previously analyzed documents
- **LIB-02**: User can resume previous sessions
- **LIB-03**: User can build clause library from approved revisions

### Settings

- **SET-01**: User can configure default aggressiveness level
- **SET-02**: User can set preferred representation type
- **SET-03**: User can manage API keys through UI

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Single-user local tool for now |
| Multi-user collaboration | Not needed for solo attorney workflow |
| Cloud deployment | Runs locally, no infrastructure complexity |
| Automatic clause library | Future milestone after core features complete |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIN-01 | Phase 1 | Pending |
| FIN-02 | Phase 1 | Pending |
| FIN-03 | Phase 1 | Pending |
| FIN-04 | Phase 1 | Pending |
| TRANS-01 | Phase 2 | Pending |
| TRANS-02 | Phase 2 | Pending |
| TRANS-03 | Phase 2 | Pending |
| TRANS-04 | Phase 2 | Pending |
| PREC-01 | Phase 3 | Pending |
| PREC-02 | Phase 3 | Pending |
| PREC-03 | Phase 3 | Pending |
| PREC-04 | Phase 3 | Pending |
| NEW-01 | Phase 4 | Pending |
| NEW-02 | Phase 4 | Pending |
| NEW-03 | Phase 4 | Pending |
| NEW-04 | Phase 4 | Pending |
| RENDER-01 | Phase 5 | Complete |
| RENDER-02 | Phase 5 | Complete |
| RENDER-03 | Phase 5 | Complete |
| RENDER-04 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 after initial definition*
