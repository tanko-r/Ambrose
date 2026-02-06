# Context-Aware Revisions Design

## Overview

Enhance the revision generation system so Gemini receives full document context—concept map, risk map, and related clause text—enabling intelligent, coordinated revisions that account for document-wide provisions and risk relationships.

## Problem

Currently, Gemini generates revisions for clauses in isolation. It doesn't know:
- A $50K basket in Section 8.3 mitigates the rep warranty exposure
- Automatic termination in Section 10.4 amplifies foot-fault risk
- Related clauses that should be revised in coordination

This leads to suboptimal suggestions that ignore existing protections or miss amplifying risks.

## Solution

### 1. Concept Map

A document-wide inventory of provisions that affect risk, grouped by legal concept with section references preserved.

**Data Model:**
```json
{
  "concepts": {
    "liability_limitations": {
      "basket": { "value": "$50K", "section": "8.3", "applies_to": "rep claims only" },
      "cap": { "value": "$500K", "section": "8.3", "excludes": ["fraud"] },
      "survival": { "value": "18 months", "section": "8.1" }
    },
    "knowledge_standards": {
      "definition": { "text": "actual knowledge of CEO/CFO", "section": "5.2" }
    },
    "termination_triggers": {
      "buyer_term_for_rep_breach": { "section": "10.2", "timing": "pre-closing" },
      "auto_term_material_breach": { "section": "10.4" }
    },
    "default_remedies": {
      "cure_period": { "value": "10 days", "section": "9.2" },
      "notice_required": { "value": true, "section": "9.1" }
    },
    "defined_terms": {
      "material_adverse_effect": { "section": "1.1", "summary": "..." },
      "permitted_exceptions": { "section": "1.1", "summary": "..." }
    }
  }
}
```

**Categories to extract:**
- Liability limitations (baskets, caps, survival periods, deductibles)
- Knowledge standards (how "knowledge" is defined, who it applies to)
- Termination triggers (what events allow/require termination)
- Default remedies (cure periods, notice requirements, automatic vs. elective)
- Defined terms that affect risk (Material Adverse Effect, Permitted Exceptions, etc.)

### 2. Risk Map

Risks with explicit dependency chains showing how provisions interact.

**Data Model:**
```json
{
  "risks": {
    "R-5.3-1": {
      "clause": "5.3",
      "para_id": "para_23",
      "title": "Unqualified rep - no materiality",
      "description": "Representation lacks materiality qualifier...",
      "base_severity": "high",
      "effective_severity": "medium",
      "mitigated_by": [
        { "ref": "8.3:basket", "effect": "reduces exposure to claims under $50K" }
      ],
      "amplified_by": [
        { "ref": "10.4:auto_term", "effect": "foot-fault breach triggers termination" }
      ],
      "triggers": ["8.1:indem"]
    }
  }
}
```

**Relationship types:**
- `mitigated_by` - provisions that reduce this risk's severity
- `amplified_by` - provisions that increase exposure if this risk materializes
- `triggers` - obligations or consequences this risk activates

**Prompt format (matrix):**
```
| Risk ID | Clause | Severity | Mitigated By | Amplified By | Triggers |
|---------|--------|----------|--------------|--------------|----------|
| R-5.3-1 | 5.3    | HIGH→MED | 8.3:basket   | 10.4:auto-term | 8.1:indem |
| R-5.4-1 | 5.4    | LOW      | 5.2:knowledge | —            | —        |
```

The underlying JSON supports future visual graph exploration (see GitHub issue #7).

### 3. Map Generation

**When:** During Phase 2 initial analysis.

**How:** Single-pass extraction. Claude builds both maps as it analyzes each clause:

```
For each clause, identify:
1. Risks and opportunities (existing)
2. Provisions to add to concept map
   - If this clause contains a basket, cap, survival period, knowledge definition, etc.
3. Relationships to concepts already seen
   - If this risk is mitigated/amplified by a provision identified earlier
```

**Reconciliation:** Server-side processing after Claude's response:
- Calculate `effective_severity` based on mitigators and amplifiers
- Resolve cross-references between risks and provisions
- No additional API calls required

This adds ~10-15% to output tokens versus a separate second pass that would double cost.

### 4. Gemini Revision Prompt

When user requests a revision, include:

1. **Concept map** - full (typically under 1000 tokens)
2. **Risk map** - matrix rows for focused clause and related clauses
3. **Focused clause** - full text
4. **Related clauses** - full text of clauses in mitigated_by, amplified_by, triggers, and related_para_ids
5. **Selected risks** - which risks the user wants addressed

**Prompt structure:**
```
## Document Context
[Full concept map]

## Risk Context
| Risk | Severity | Mitigated By | Amplified By |
|------|----------|--------------|--------------|
[Matrix rows for focused clause and neighbors]

## Focused Clause (Section 5.3)
[Full text]

## Related Clauses
### Section 8.3 (mitigates via basket)
[Full text]

### Section 10.4 (amplifies via auto-termination)
[Full text]

## Instructions
Revise the focused clause to address the selected risks.

Consider how related clauses affect the risk:
- If a provision mitigates the risk, note this but address remaining exposure
- If a provision amplifies the risk, prioritize accordingly
- Suggest related clause revisions narratively if coordination is needed

[Tool: get_clause available for additional context if needed]
```

### 5. Get Clause Tool

Gemini can request additional clauses beyond those pre-included.

**Tool definition:**
```json
{
  "name": "get_clause",
  "description": "Retrieve full text of a clause by section reference",
  "parameters": {
    "section_ref": "e.g., '8.3' or 'Section 8.3'",
    "reason": "brief explanation of why this clause is needed"
  }
}
```

**Use case:** Model sees a reference in concept/risk map that wasn't pre-included as a related clause, decides it needs the full text.

### 6. Related Revision Suggestions

Gemini response includes narrative suggestions for related clauses:

```json
{
  "revised_text": "...",
  "rationale": "...",
  "related_suggestions": [
    {
      "section": "8.3",
      "para_id": "para_45",
      "suggestion": "Add carve-out for the materiality qualifier you added here",
      "priority": "recommended"
    },
    {
      "section": "10.4",
      "para_id": "para_52",
      "suggestion": "Consider adding cure period to match the 10-day notice",
      "priority": "optional"
    }
  ]
}
```

**UI:** Suggestions appear below the diff in the bottom sheet. User clicks [Generate Revision] to act on a suggestion.

Revisions for related clauses are only generated when user explicitly requests—no wasted API calls.

### 7. Incremental Map Updates

When user accepts a revision:

1. **Detect concept changes** - Pattern match the revision for baskets, caps, termination triggers, cure periods, etc.

2. **Update concept map** - Add/modify the affected provision

3. **Recalculate risk severities** - Update `effective_severity` for risks that reference the changed provision

4. **Track change history:**
```json
{
  "change_id": "chg_001",
  "timestamp": "2026-01-28T10:30:00",
  "para_id": "para_45",
  "section": "10.4",
  "change_type": "removed auto-termination",
  "affected_risks": ["R-5.3-1", "R-5.4-2", "R-6.1-1"]
}
```

5. **Identify affected clauses** - Which other clauses had risks referencing this provision

### 8. Re-Analysis Workflow

**Notification:** After accepting a revision that affects other clauses:
```
"Your revision to Section 10.4 may affect 3 other clauses"
[View Affected] [Dismiss]
```

**Affected clauses panel shows:**
- Clause section reference
- Why it's affected ("Risk R-5.3-1 was amplified by Section 10.4")
- Severity change (HIGH → MEDIUM)
- [Re-analyze] button

**User options:**
- Re-analyze individual clauses
- Dismiss notification (severity updates still apply)
- Full document re-analysis (from menu)

**Re-analyzed clauses show context:**
```
Risk: Unqualified rep (Severity: HIGH → MEDIUM)
Changed by: Your revision to Section 10.4 removed auto-termination
```

**Full re-analysis warning:**
```
Full Document Re-Analysis

This will re-analyze all 47 clauses with current context.
Estimated time: 15-20 minutes
Estimated cost: ~$4-6

[Cancel] [Proceed]
```

## Implementation

### Backend Changes

**`claude_service.py`**
- Modify analysis prompt to extract concept map provisions per clause
- Add risk relationship identification (mitigated_by, amplified_by, triggers)
- Return unified response: risks + concept_map + risk_map

**`analysis_service.py`**
- Add `reconcile_risk_map()` - calculate effective severities
- Add `update_maps_on_revision()` - detect changes, update maps, identify affected clauses
- Add `detect_concept_changes()` - pattern match revisions for provision changes

**`gemini_service.py`**
- Modify revision prompt to include concept map, risk map matrix, related clause text
- Add `get_clause` tool definition and handler
- Request related_suggestions in response format
- Handle multi-turn conversation for tool calls

**`routes.py`**
- Return concept_map and risk_map with analysis response
- Add `/api/reanalyze-clause` endpoint for single-clause re-analysis
- Add change history tracking on revision accept
- Add `/api/affected-clauses` endpoint

### Frontend Changes

**`state.js`**
- Store concept_map, risk_map, change_history in AppState

**`sidebar.js`**
- Display risk relationships (mitigated_by, amplified_by) in risk cards
- Show effective severity with explanation

**`revision.js`**
- Display related suggestions below diff
- Add [Generate Revision] buttons for suggestions

**New: `reanalysis.js`**
- Affected clauses notification banner
- Affected clauses panel with re-analyze buttons
- Full re-analysis confirmation dialog

### UI/UX Principles

- Clean, intuitive interfaces throughout
- Notifications are informative but not intrusive
- User stays in control of all re-analysis
- Cost/time warnings before expensive operations
- Clear visual hierarchy for risk severities and relationships

## Future Enhancements

- **Visual risk graph explorer** (GitHub issue #7) - Interactive node graph for exploring risk relationships
- **Risk severity trend tracking** - Show how risk profile changes as user makes revisions
- **Precedent clause matching** - Use concept map to find matching provisions in precedent document
