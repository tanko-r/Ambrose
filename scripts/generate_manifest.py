#!/usr/bin/env python3
"""
Manifest Generator for Contract Redlining Workflow

Generates a markdown manifest comparing original and revised content,
with rationale for each change.
"""

import json
import sys
from pathlib import Path
from datetime import datetime


def generate_manifest(original_json_path, revised_json_path, output_path, context=None):
    """
    Generate a change manifest comparing original and revised documents.

    Args:
        original_json_path: Path to parsed original document JSON
        revised_json_path: Path to revised content JSON
        output_path: Path for output manifest markdown
        context: Optional dict with context info (representation, deal type, etc.)
    """
    with open(original_json_path, 'r', encoding='utf-8') as f:
        original = json.load(f)

    with open(revised_json_path, 'r', encoding='utf-8') as f:
        revised = json.load(f)

    # Build lookups
    original_lookup = {}
    revised_lookup = {}

    def build_lookup(content, lookup):
        for item in content:
            if item["type"] == "paragraph":
                lookup[item["id"]] = item
            elif item["type"] == "table":
                for row in item["rows"]:
                    for cell in row:
                        for para in cell["paragraphs"]:
                            lookup[para["id"]] = para

    build_lookup(original.get("content", []), original_lookup)
    build_lookup(revised.get("content", []), revised_lookup)

    # Generate manifest
    lines = []
    lines.append("# Contract Redline Manifest")
    lines.append("")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"**Source Document:** {original.get('source_file', 'Unknown')}")
    lines.append("")

    if context:
        lines.append("## Context")
        lines.append("")
        for key, value in context.items():
            lines.append(f"- **{key}:** {value}")
        lines.append("")

    # Document summary
    lines.append("## Document Summary")
    lines.append("")
    lines.append(f"- **Paragraphs:** {len(original_lookup)}")
    lines.append(f"- **Defined Terms:** {len(original.get('defined_terms', []))}")
    lines.append(f"- **Sections:** {len(original.get('sections', []))}")
    lines.append(f"- **Exhibits:** {len(original.get('exhibits', []))}")
    lines.append("")

    if original.get("exhibits_with_contracts"):
        lines.append("### Exhibits with Contract Language Detected")
        lines.append("")
        for ex in original["exhibits_with_contracts"]:
            lines.append(f"- {ex}")
        lines.append("")

    # Changes
    lines.append("## Changes")
    lines.append("")

    change_num = 0

    for para_id in sorted(original_lookup.keys(), key=lambda x: int(x.split('_')[1])):
        orig_item = original_lookup[para_id]
        orig_text = orig_item.get("text", "").strip()

        if para_id in revised_lookup:
            rev_item = revised_lookup[para_id]
            rev_text = rev_item.get("text", "").strip()

            if orig_text != rev_text:
                change_num += 1

                # Get section context
                section_info = ""
                style_info = orig_item.get("style_info", {})
                if style_info.get("is_heading"):
                    section_info = f" (Heading: {style_info.get('style', '')})"

                lines.append(f"### Change #{change_num}")
                lines.append("")
                lines.append(f"**Paragraph ID:** {para_id}{section_info}")
                lines.append("")

                # Get rationale if provided
                rationale = rev_item.get("rationale", "")

                lines.append("**Original:**")
                lines.append("```")
                lines.append(orig_text if orig_text else "[Empty paragraph]")
                lines.append("```")
                lines.append("")
                lines.append("**Revised:**")
                lines.append("```")
                lines.append(rev_text if rev_text else "[Deleted]")
                lines.append("```")
                lines.append("")

                if rationale:
                    lines.append(f"**Rationale:** {rationale}")
                    lines.append("")

                lines.append("---")
                lines.append("")

    # Summary
    lines.append("## Summary")
    lines.append("")
    lines.append(f"**Total changes:** {change_num}")
    lines.append("")

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    return change_num


def main():
    if len(sys.argv) < 4:
        print("Usage: python generate_manifest.py <original.json> <revised.json> <output.md>")
        sys.exit(1)

    original_path = Path(sys.argv[1])
    revised_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3])

    print(f"Generating manifest...")
    changes = generate_manifest(original_path, revised_path, output_path)
    print(f"Manifest generated: {output_path}")
    print(f"Total changes documented: {changes}")


if __name__ == "__main__":
    main()
