# Contract Redlining Workflow for Claude Code

A comprehensive system for automated contract redlining using Claude Code CLI.

## Quick Start

```bash
# In Claude Code CLI:
/redline path/to/contract.docx --represent seller
```

## Project Structure

```
Claude_Redlining/
├── .claude/
│   └── commands/
│       └── redline.md          # Main /redline skill definition
├── scripts/
│   ├── parse_docx.py           # Extract text from .docx with structure
│   ├── rebuild_docx.py         # Reconstruct .docx with changes
│   └── generate_manifest.py    # Create change log
├── agents/
│   ├── document_mapper.md      # Agent: Analyze document structure
│   ├── section_redliner.md     # Agent: Redline individual sections
│   ├── consistency_checker.md  # Agent: Verify consistency
│   └── output_builder.md       # Agent: Compile final outputs
└── README.md
```

## Workflow Overview

1. **Invoke `/redline`** with your target contract
2. **Provide context**: representation, aggressiveness, leverage
3. **Claude parses** the document, detecting structure and exhibits
4. **Exhibit check**: Claude asks how to handle exhibits with contract language
5. **Document mapping**: Extracts defined terms, structure, flags issues
6. **Section redlining**: Agents review and propose surgical changes
7. **Consistency check**: Verifies all changes work together
8. **Output generation**: Creates revised.docx, manifest.md, analysis.md

## Output Files

Each redline session creates a folder: `[ContractName]_redline_[timestamp]/`

- **revised.docx** - Modified document for Word Compare
- **manifest.md** - Every change with rationale
- **analysis.md** - Document map, defined terms, flags

## Usage Examples

### Basic Redline
```
/redline "C:/Contracts/PSA_Draft.docx" --represent buyer
```

### With Preferred Form
```
/redline "C:/Contracts/PSA_Draft.docx" --form "C:/Forms/Buyer_PSA.docx" --represent buyer
```

### Context Options
- `--represent`: seller, buyer, landlord, tenant, lender, borrower, developer, grantor, grantee, other
- `--form`: Path to preferred form (optional)

Claude will ask for:
- Aggressiveness (1-5)
- Leverage position
- Additional context

## Word Compare Workflow

After receiving outputs:

1. Open **revised.docx** in Word
2. Go to Review → Compare → Compare Documents
3. Select original as "Original document"
4. Select revised.docx as "Revised document"
5. Click OK to see tracked changes
6. Review, accept/reject changes as needed

## Scripts

### parse_docx.py
```bash
python scripts/parse_docx.py input.docx [output.json]
```
Extracts document content with paragraph IDs for reconstruction.

### rebuild_docx.py
```bash
python scripts/rebuild_docx.py original.docx revisions.json output.docx
```
Applies changes while preserving original formatting.

### generate_manifest.py
```bash
python scripts/generate_manifest.py original.json revised.json manifest.md
```
Creates human-readable change log.

## Requirements

- Python 3.8+
- python-docx library (`pip install python-docx`)
- Claude Code CLI

## Key Principles

1. **Surgical changes**: Modify existing language, don't wholesale replace
2. **Terminology matching**: Use target document's defined terms
3. **Formatting preservation**: Output matches original structure
4. **Comprehensive rationale**: Every change is explained
5. **Consistency checking**: Cross-references and terms verified
