# Contract Redlining Project

## Background \& Plan

The user (you can call him David) intends to develop a comprehensive legal contract revision assistant tool. The tool will assist David, a lawyer, in reviewing and revising complex legal documents.  The tool should be general purpose - will review any contract type - but it has built in "skills" for certain contract types.  Since David is a real estate lawyer, it should have skills for:

* Purchase and Sale Agreement
* Lease
* Development Agreement
* Easement
* Other real estate focused documents you may suggest.



David has been in extended conversations with Claude and with Gemini about making this project work.  So far, he has managed to make gemini achieve a pretty good outcome by brute-force revising each paragraph of a given agreement one by one, with a separate dynamic prompt sent to Gemini 3 Flash via the user's API (stored in api.txt).  Claude's plan makes sense, but its actual redlines have been underwhelming.  David has preferred that Gemini gives detailed, surgical redlines that he can choose from like a menu.



David's latest thinking is that the tool should be less of a brute-force redlining tool, and more of a thought partner in analyzing a contract, allowing the user to obtain a more bespoke set of redlines based on external context (deal posture, client style, lawyer style, opposing counsel style and sophistication) that are difficult to include in an LLM context.  As such, he wants to break the process into chunks:



1. **Intake Phase**: LLM asks the user basic intake questions, and asks the user to upload the document for review, and to upload the precedent document or clause library, if any.  LLM asks for which party the user represents, general deal context, user's preference on how to approach review (senior partner, mid-level associate, light touch, aggressive, etc...we should work out what these are), whether exhibits appearing after the main body of the document should be included or ignored, and other relevant questions that will impact analysis and redlining.
2. **Risk/Opportunity Analysis**: LLM analyzes the target document thoroughly, building a conceptual map of the entire document and then analyzing each clause int he context of the conceptual map.  Importantly, it does not treat each clause (usually this will be in the form of a single paragraph or, sometimes, multiple paragraphs, generally including a Word-created automatic ordinal at the beginning, such as "1.3" or "(iv)") as an island--the model is smart enough to pull in other relevant clauses from other areas of the document where needed for a complete contextual analysis.  LLM analyzes each clause for potential risks to the user's clients, and opportunities to strengthen the client's position (even if there is not a particular risk).  There is a pre-baked set of risks that all contracts should be reviewed for (e.g. uncapped liability, no term expiration or termination).  FOr contracts where the tool has a particular skill (e.g. PSAs), it knows to look for certain key risks specific to that type (e.g. default traps, closing escape "gotchas", timeline extensions, etc), but will also review both "skill" contracts and "off-skill" contracts to identify risks unique to that particular document or generally contained therein, as well as opportunities to strengthen the client's position.  Notably, \*\*there will be multiple risks/opportunities contained within a given clause or even within a single sentence\*\*. The LLM then builds a complete risk map of the document, which is keyed to the conceptual map, and also keyed to the clauses or paragraphs in the document.  It will need to describe narratively the risks and how they appear in each clause.  That can be done at this stage or in the next stage.
3. **Collaborative Review**: The LLM will build a local webapp (probably just a simple html page, but you can be creative--it will be important that the user does not need to build or install dependencies to run this) allowing the user and the LLM to interact with the document collaboratively.  The target document will be rendered in the webapp  faithfully, incorporating all formatting and automatic numbering.  When the user clicks into a given clause, the app will open a sidebar that shows the user the LLM's risk/opportunity analysis of that particular clause, and some basic context from the hierarchical document section where it is contained adn the document generally (if relevant).  FOr each risk/opportunity identified in the sidebar, the user can click on it and relevant language in the instant clause will be highlighted.  Additionally, the sidebar will offer to revise the clause to address that particular risk, which then generates a prompt to Gemini 3 flash to return corrected language, which is then rendered in track-changes style.  The user iterates this process through the rest of the opportunities/risks identified in each clause in the document.  Finally, the user can flag a given clause or language snippet for client review, and the webapp will record that to be included in a transmittal email generated at finalization.
4. **Finalization**: Once the user has completed the review, the webapp will generate a Word document exactly the same as the target document in style and formatting (\*\*including automatic numbering if present in the original target\*\*), but containing the revisions that the user approved in the collaborative review process, all shown in track changes using https://github.com/JSv4/Python-Redlines.  It also generates the transmittal email, summarizing at a \*\*very\*\* high level the most important items that were addressed and the user's flags.



Additionally, since he has found that gemini-3-flash has been great at generating the actual language, he wants to use that via his API.  This is also much more cost effective.



**BELOW ARE OLD NOTES AND COMPACTED CONTEXT FROM PRIOR CONVERSATIONS WITH CLUADE AND WITH GEMINI.**  Relevant concepts should be imported, and scripts can be reused and adapted, but the plan described above should be the canonical plan for this project.  DO NOT implement any of the following, except to the extent that it furthers the foregoing plan.





# PRIOR ATTEMPT CONVERSATION NOTES



## Architecture Overview

This project implements a **4-phase contract redlining pipeline** to fix issues with single-pass or paragraph-by-paragraph approaches (mid-sentence cuts, wrong-party perspective, duplicate concepts, context blindness).

### The 4 Phases

1. **Phase 1: Analysis \& Mapping** (`scripts/analyze\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_documents.py`)

   * Extract defined terms with full definitions from both docs
   * Map section correspondence between target and template
   * Build comprehensive risk inventory
   * Generate document-specific judgment framework

2. **Phase 2: Redline Planning** (`scripts/generate\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_plan.py`)

   * Create reviewable plan per section
   * Categorize changes: preserve, add qualifiers, restructure, heavy revision
   * **PAUSE for user approval before Phase 3**

3. **Phase 3: Section-by-Section Execution** (`scripts/redline\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_section.py`)

   * Process each section with compacted context package
   * Track deferred modifications (cross-references, new definitions needed)
   * Flag external dependencies for Phase 4

4. **Phase 4: Consistency Check \& Assembly** (`scripts/consistency\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_check.py`)

   * Process deferred modifications
   * Verify internal consistency (no duplicates, broken refs, conflicts)
   * Assemble final output files

### Key Scripts

|Script|Purpose|
|-|-|
|`scripts/parse\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_docx.py`|Parse Word docs to structured JSON|
|`scripts/rebuild\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_docx.py`|Rebuild Word doc from revised JSON|
|`scripts/full\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_redline.py`|Legacy orchestrator (being refactored)|
|`.claude/commands/redline.md`|Main slash command orchestrating pipeline|

### Examples Library

Located at `.claude/redline\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_examples/`:

* `seed\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_examples.json` - User-provided good/bad redline examples
* `feedback\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_log.json` - Corrections from past sessions
* `learned\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_patterns.json` - Extracted patterns for prompts

### User Preferences (Confirmed)

* **Plan Review**: Always pause after Phase 2 for user approval
* **Judgment Calls**: Ask user during execution for ambiguous situations
* **Learning**: Seed with examples, then learn from user corrections

### Output Files

Each redline produces:

* `analysis.json` - Phase 1 document analysis
* `redline\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_plan.json` - Phase 2 change plan
* `deferred\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_modifications.json` - Phase 3 cross-section changes needed
* `revised.json` - Final structured content
* `revised.docx` - Word document for Track Changes comparison
* `manifest.md` - Hierarchical change log with rationale

### Running the Redline

Use the `/redline` slash command which orchestrates all phases.

---

## Implementation Status

* Phase 1-4 scripts exist and need enhancement for full architecture
* Examples library structure is in place
* Main command file needs update to properly orchestrate pipeline

---

# ADDITIONAL PROJECT DISCUSSION CONTEXT

## Session Summary (2026-01-27)

### User Context

* User is a **real estate attorney** wanting to use Claude Code CLI to redline contracts
* Primary frustration with past LLM attempts: **wholesale replacement** instead of surgical edits, and **broken Word formatting**
* Spends 8+ hours manually redlining a full PSA — wants Claude to take its time and be thorough
* Workflow: Reviews in Word, makes own edits or copies Claude's edits, sends to client, then opposing counsel

### Key Requirements Confirmed

1. **Output Format**: Word document (.docx) preserving original formatting for clean Word Compare
2. **Change Manifest**: Include rationale for each change (one entry per clause/paragraph or per discrete concept)
3. **Surgical Approach**: Modify existing language, avoid wholesale replacement — better optics
4. **Terminology Matching**: Use target document's defined terms, not preferred form's
5. **Exhibit Handling**: Flag exhibits with contract language, ask user how to handle (ignore vs redline)
6. **Representation Types**: Seller, Buyer, Landlord, Tenant, Lender, Borrower, Developer, Grantor, Grantee, Other
7. **Context Inputs**: Aggressiveness (1-5), leverage position, open-ended additional context

### Parser Improvements Made (by user/linter)

* `parse\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_docx.py` enhanced with:

  * `SectionTracker` class for hierarchical section tracking
  * `extract\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_section\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_number()` for various numbering formats
  * `extract\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_caption()` for section titles
  * Section hierarchy included in each paragraph's metadata
  * Better section reference generation for manifest

### Redline Skill Enhanced (by user/linter)

* `.claude/commands/redline.md` updated to 4-phase pipeline:

  * Phase 1: Document Analysis \& Mapping
  * Phase 2: Redline Planning (requires user approval)
  * Phase 3: Section-by-Section Execution
  * Phase 4: Consistency Check \& Assembly

* Added judgment call handling
* Added compacted context package specification

### Agent Prompts Updated (by user/linter)

* `document\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_mapper.md`: Enhanced flag categories (high/medium priority, missing protections)
* `section\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_redliner.md`: More aggressive at level 4-5, emphasis on importing preferred form language

### Files in Project

```
Claude\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_Redlining/
├── .claude/commands/redline.md          # Main skill (4-phase pipeline)
├── scripts/
│   ├── parse\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_docx.py                    # Enhanced with section tracking
│   ├── rebuild\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_docx.py                  # Reconstruct .docx preserving formatting
│   ├── generate\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_manifest.py             # Create change log
│   ├── analyze\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_documents.py             # (needs creation for Phase 1)
│   ├── generate\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_plan.py                 # (needs creation for Phase 2)
│   ├── redline\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_section.py               # (needs creation for Phase 3)
│   └── consistency\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_check.py             # (needs creation for Phase 4)
├── agents/
│   ├── document\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_mapper.md               # Enhanced with PSA-specific flags
│   ├── section\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_redliner.md              # More aggressive redlining guidance
│   ├── consistency\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_checker.md           # Verify consistency
│   └── output\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_builder.md                # Compile outputs
├── test\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_output/                         # Parsed test documents
├── README.md
└── CLAUDE.md                            # This file
```

### Next Steps for Continuation

1. Create remaining Phase 1-4 scripts referenced in redline.md
2. Complete test run with the parsed documents
3. Review output quality and iterate on prompts
4. Consider examples library population after successful runs



---

# CONTEXT FROM GEMINI ATTEMPT

# Session Notes: Gemini Redlining Project (Jan 27, 2026)

## Project Overview

Automated legal redlining engine for Purchase and Sale Agreements (PSA).

* **Target:** `ASB - Seattle SS PSA`
* **Precedent:** `Seller PSA`
* **Representation:** Seller
* **Model:** `gemini-3-flash-preview`

## Current Status

* **Repo:** `Gemini\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_Redlining` (Private GitHub).
* **Workflow:** `redline.ps1` -> Parses DOCX -> RAG Retrieval -> AI Redline -> Rebuild DOCX.
* **Tools Built:**

  * `scripts/generate\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_native\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_redline.py`: Generates .docx with Track Changes (Requires .NET 8 SDK - Installed).
  * `scripts/generate\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_html\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_redline.py`: Generates legal-style HTML inline diffs.

## The "Think Like a Lawyer" Pivot

We shifted focus from "Aggressive Style Matching" to **"Substantive Risk Analysis"**.

### Verified Strategy (Ready to Implement)

We validated a new prompting strategy using `scripts/run\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_thinking\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_test\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_survival.py`.

1. **Materiality Matrix:** The AI must evaluate risks based on **Magnitude** (severity) and **Likelihood**.
2. **Market Awareness:** If a clause is "Market" and "Safe," return it **UNCHANGED** (Minimalism).
3. **Surgical Precision:** Prefer inserting specific qualifiers (e.g., Knowledge Waivers) over wholesale rewrites.
4. **Internal Triage:** The prompt forces the model to "Think" (Chain of Thought) before outputting the final text.

### Pending Actions (Next Session)

The following changes are defined in `redliner\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_update.md` but **NOT yet merged** into the main codebase:

1. **Update `agents/section\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_redliner.md`:**

   * Add "Materiality vs. Likelihood" definitions.
   * Add "Minimalist Rule" (Return Original if Safe).

2. **Update `scripts/semantic\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_redline\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_engine.py`:**

   * Inject the "Internal Triage" step into the prompt.
   * Suppress the triage output so only the final text is returned.

## Technical Fixes Applied

* **Truncation:** Increased `max\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_output\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_tokens` to **4096** and added `fsync` to file writing to prevent mid-sentence cutoffs.
* **Visualization:** Integrated `diff-match-patch` for high-quality HTML redlines.
