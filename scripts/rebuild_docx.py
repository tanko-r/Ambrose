#!/usr/bin/env python3
"""
Document Rebuilder for Contract Redlining Workflow

Takes revised text content and maps it back into the original .docx structure,
preserving all formatting while applying text changes.
"""

import json
import sys
import shutil
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_block_items(document):
    """
    Iterate through document body items in order (paragraphs and tables).
    """
    parent = document.element.body
    for child in parent.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, document)
        elif child.tag == qn('w:tbl'):
            yield Table(child, document)


def replace_paragraph_text(paragraph, new_text):
    """
    Replace paragraph text while preserving formatting.

    Strategy: Keep the first run's formatting, clear other runs,
    set the text on the first run.
    """
    if not paragraph.runs:
        # No runs, just set text directly
        paragraph.text = new_text
        return

    # Preserve first run's formatting
    first_run = paragraph.runs[0]
    first_run_format = {
        'bold': first_run.bold,
        'italic': first_run.italic,
        'underline': first_run.underline,
        'font_name': first_run.font.name,
        'font_size': first_run.font.size,
    }

    # Clear all runs
    for run in paragraph.runs:
        run.text = ""

    # Set new text on first run
    first_run.text = new_text

    # Restore formatting
    first_run.bold = first_run_format['bold']
    first_run.italic = first_run_format['italic']
    first_run.underline = first_run_format['underline']
    if first_run_format['font_name']:
        first_run.font.name = first_run_format['font_name']
    if first_run_format['font_size']:
        first_run.font.size = first_run_format['font_size']


def rebuild_document(original_path, revisions_path, output_path):
    """
    Rebuild document with revisions applied.

    Args:
        original_path: Path to original .docx file
        revisions_path: Path to JSON file with revised content
        output_path: Path for output .docx file
    """
    # Load revisions
    with open(revisions_path, 'r', encoding='utf-8') as f:
        revisions = json.load(f)

    # Build lookup of revised content by paragraph ID
    revised_lookup = {}

    def build_lookup(content):
        for item in content:
            if item["type"] == "paragraph":
                revised_lookup[item["id"]] = item["text"]
            elif item["type"] == "table":
                for row in item["rows"]:
                    for cell in row:
                        for para in cell["paragraphs"]:
                            revised_lookup[para["id"]] = para["text"]

    build_lookup(revisions.get("content", []))

    # Copy original document
    shutil.copy2(original_path, output_path)

    # Open the copy and apply changes
    doc = Document(output_path)

    para_id = 0
    changes_made = 0

    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            para_id += 1
            para_key = f"p_{para_id}"

            if para_key in revised_lookup:
                original_text = block.text.strip()
                revised_text = revised_lookup[para_key]

                if original_text != revised_text:
                    replace_paragraph_text(block, revised_text)
                    changes_made += 1

        elif isinstance(block, Table):
            for row in block.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        para_id += 1
                        para_key = f"p_{para_id}"

                        if para_key in revised_lookup:
                            original_text = para.text.strip()
                            revised_text = revised_lookup[para_key]

                            if original_text != revised_text:
                                replace_paragraph_text(para, revised_text)
                                changes_made += 1

    # Save the modified document
    doc.save(output_path)

    return changes_made


def rebuild_from_plain_text(original_path, revised_text_path, output_path):
    """
    Rebuild document from a plain text file with paragraph markers.

    The revised text file should have the format:
    [p_1]
    First paragraph text here
    [p_2]
    Second paragraph text here
    ...

    Or it can be a continuous text file where we match paragraphs by order.
    """
    # Read revised text
    with open(revised_text_path, 'r', encoding='utf-8') as f:
        revised_content = f.read()

    # Check if it has paragraph markers
    if '[p_' in revised_content:
        # Parse marked format
        import re
        pattern = r'\[p_(\d+)\]\s*\n(.*?)(?=\[p_|\Z)'
        matches = re.findall(pattern, revised_content, re.DOTALL)
        revised_lookup = {f"p_{m[0]}": m[1].strip() for m in matches}
    else:
        # Sequential matching - split by double newlines
        paragraphs = [p.strip() for p in revised_content.split('\n\n') if p.strip()]
        revised_lookup = {f"p_{i+1}": text for i, text in enumerate(paragraphs)}

    # Create revisions structure
    revisions = {
        "content": [{"type": "paragraph", "id": k, "text": v} for k, v in revised_lookup.items()]
    }

    # Write temporary JSON
    temp_json = Path(revised_text_path).with_suffix('.temp.json')
    with open(temp_json, 'w', encoding='utf-8') as f:
        json.dump(revisions, f)

    # Rebuild
    changes = rebuild_document(original_path, temp_json, output_path)

    # Clean up temp file
    temp_json.unlink()

    return changes


def main():
    if len(sys.argv) < 4:
        print("Usage: python rebuild_docx.py <original.docx> <revisions.json|revisions.txt> <output.docx>")
        print("")
        print("The revisions file can be:")
        print("  - JSON file matching the structure from parse_docx.py")
        print("  - Text file with [p_N] markers")
        print("  - Plain text file (paragraphs matched by order)")
        sys.exit(1)

    original_path = Path(sys.argv[1])
    revisions_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3])

    if not original_path.exists():
        print(f"Error: Original file not found: {original_path}")
        sys.exit(1)

    if not revisions_path.exists():
        print(f"Error: Revisions file not found: {revisions_path}")
        sys.exit(1)

    print(f"Original document: {original_path}")
    print(f"Revisions file: {revisions_path}")
    print(f"Output document: {output_path}")

    if revisions_path.suffix.lower() == '.json':
        changes = rebuild_document(original_path, revisions_path, output_path)
    else:
        changes = rebuild_from_plain_text(original_path, revisions_path, output_path)

    print(f"\nDocument rebuilt successfully!")
    print(f"Paragraphs modified: {changes}")
    print(f"Output saved to: {output_path}")
    print(f"\nNext step: Use Word Compare to view changes between original and output.")


if __name__ == "__main__":
    main()
