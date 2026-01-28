#!/usr/bin/env python3
"""
Document Parser for Contract Redlining Workflow

Extracts text from .docx files while preserving paragraph structure
and tracking section hierarchy for manifest generation.
"""

import json
import sys
import re
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def get_paragraph_style_info(paragraph):
    """Extract style information from a paragraph."""
    style_name = paragraph.style.name if paragraph.style else "Normal"

    numbering_info = None
    if paragraph._p.pPr is not None:
        numPr = paragraph._p.pPr.find(qn('w:numPr'))
        if numPr is not None:
            ilvl = numPr.find(qn('w:ilvl'))
            numId = numPr.find(qn('w:numId'))
            if ilvl is not None and numId is not None:
                numbering_info = {
                    "level": int(ilvl.get(qn('w:val'))),
                    "numId": numId.get(qn('w:val'))
                }

    return {
        "style": style_name,
        "numbering": numbering_info,
        "is_heading": style_name.lower().startswith("heading")
    }


def extract_section_number(text):
    """
    Extract section number from paragraph text.
    Handles various formats:
    - "Article I", "ARTICLE 1"
    - "Section 1.1", "Section 3.B"
    - "1.", "2.", "1.1", "1.1.1"
    - "(a)", "(b)", "(i)", "(ii)"
    - "A.", "B.", "(A)", "(1)"

    Returns tuple: (section_number, remaining_text, number_type)
    """
    text = text.strip()

    patterns = [
        # Article patterns
        (r'^(ARTICLE\s+[IVXLCDM]+)[.\s:]+(.*)$', 'article'),
        (r'^(Article\s+[IVXLCDM]+)[.\s:]+(.*)$', 'article'),
        (r'^(ARTICLE\s+\d+)[.\s:]+(.*)$', 'article'),
        (r'^(Article\s+\d+)[.\s:]+(.*)$', 'article'),

        # Section patterns
        (r'^(Section\s+[\d]+\.[\d\.A-Za-z\(\)]+)[.\s:]+(.*)$', 'section'),
        (r'^(Section\s+[\d]+)[.\s:]+(.*)$', 'section'),
        (r'^(SECTION\s+[\d]+\.[\d\.A-Za-z\(\)]+)[.\s:]+(.*)$', 'section'),
        (r'^(SECTION\s+[\d]+)[.\s:]+(.*)$', 'section'),

        # Numbered patterns (1., 1.1, 1.1.1, etc.)
        (r'^(\d+\.\d+\.\d+\.?\s*)(.*)$', 'subsub'),
        (r'^(\d+\.\d+\.?\s*)(.*)$', 'sub'),
        (r'^(\d+\.)\s+(.*)$', 'top'),

        # Letter patterns
        (r'^([A-Z]\.)\s+(.*)$', 'letter_upper'),
        (r'^([a-z]\.)\s+(.*)$', 'letter_lower'),
        (r'^\(([A-Z])\)\s*(.*)$', 'paren_upper'),
        (r'^\(([a-z])\)\s*(.*)$', 'paren_lower'),
        (r'^\((\d+)\)\s*(.*)$', 'paren_num'),

        # Roman numeral patterns
        (r'^\(([ivxlcdm]+)\)\s*(.*)$', 'roman_lower'),
        (r'^\(([IVXLCDM]+)\)\s*(.*)$', 'roman_upper'),
    ]

    for pattern, num_type in patterns:
        match = re.match(pattern, text, re.IGNORECASE if num_type.startswith('article') or num_type.startswith('section') else 0)
        if match:
            section_num = match.group(1).strip()
            remaining = match.group(2).strip() if match.lastindex >= 2 else ""
            # For parenthetical patterns, reconstruct with parens
            if num_type.startswith('paren') or num_type.startswith('roman'):
                if not section_num.startswith('('):
                    section_num = f"({section_num})"
            return (section_num, remaining, num_type)

    return (None, text, None)


def extract_caption(text, max_length=60):
    """
    Extract a caption from paragraph text.
    Uses the first sentence or phrase, truncated if needed.
    """
    # Remove section number first
    section_num, remaining, _ = extract_section_number(text)
    text_to_use = remaining if remaining else text

    # Look for a caption pattern (text ending with period before main content)
    # Common pattern: "Caption.  Main text here..."
    caption_match = re.match(r'^([^.]+\.)\s{2,}', text_to_use)
    if caption_match:
        return caption_match.group(1).strip()

    # Otherwise, take first sentence or truncate
    first_sentence = re.match(r'^([^.]+\.)', text_to_use)
    if first_sentence and len(first_sentence.group(1)) <= max_length:
        return first_sentence.group(1).strip()

    # Truncate
    if len(text_to_use) > max_length:
        return text_to_use[:max_length].strip() + "..."

    return text_to_use.strip() if text_to_use.strip() else None


class SectionTracker:
    """Tracks the current section hierarchy as we parse the document."""

    def __init__(self):
        self.hierarchy = []  # List of dicts with level, number, caption
        self.counters = {}   # level -> current count
        self.last_level = -1
        self.last_numId = None

    def update(self, numbering_level, section_num, caption, numId=None):
        """
        Update hierarchy based on new section encountered.

        numbering_level: 0 = top level, 1 = subsection, 2 = sub-subsection, etc.
        section_num: The extracted section number from text (e.g., "7.", "7.A", "(ii)") or None
        caption: The section caption/title
        numId: Word's numbering list ID
        """
        # If we have Word numbering but no text-based section number, generate one
        if numbering_level is not None and section_num is None:
            # Reset counters if we're at a higher level or new numbering list
            if numId != self.last_numId:
                self.counters = {}
                self.last_numId = numId

            # Reset lower level counters when moving up
            levels_to_remove = [l for l in self.counters if l > numbering_level]
            for l in levels_to_remove:
                del self.counters[l]

            # Increment counter for this level
            self.counters[numbering_level] = self.counters.get(numbering_level, 0) + 1

            # Generate section number based on level
            section_num = self._generate_section_number(numbering_level)
            level = numbering_level

        elif section_num is not None:
            # Use text-based section number
            if numbering_level is not None:
                level = numbering_level
            else:
                # Infer from section number format
                if re.match(r'^(Article|ARTICLE|Section|SECTION)', section_num):
                    level = 0
                elif re.match(r'^\d+\.\d+\.\d+', section_num):
                    level = 2
                elif re.match(r'^\d+\.\d+', section_num):
                    level = 1
                elif re.match(r'^\d+\.', section_num):
                    level = 0
                elif re.match(r'^\([ivx]+\)', section_num, re.IGNORECASE):
                    level = 2
                elif re.match(r'^\([a-z]\)', section_num, re.IGNORECASE):
                    level = 2
                else:
                    level = self.last_level + 1 if self.last_level >= 0 else 0
        else:
            # No numbering info at all
            return

        # Trim hierarchy to current level
        self.hierarchy = self.hierarchy[:level]

        # Add current section
        self.hierarchy.append({
            "level": level,
            "number": section_num,
            "caption": caption
        })

        self.last_level = level

    def _generate_section_number(self, level):
        """Generate section number string based on counters."""
        if level == 0:
            return f"{self.counters.get(0, 1)}."
        elif level == 1:
            # Use letter for subsections: A., B., C.
            count = self.counters.get(1, 1)
            letter = chr(ord('A') + count - 1) if count <= 26 else f"A{count-26}"
            return f"{letter}."
        elif level == 2:
            # Use roman numerals for sub-subsections: (i), (ii), (iii)
            count = self.counters.get(2, 1)
            roman = self._to_roman(count).lower()
            return f"({roman})"
        else:
            # Fallback for deeper levels
            count = self.counters.get(level, 1)
            return f"({count})"

    def _to_roman(self, num):
        """Convert integer to roman numeral."""
        val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
        syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
        roman_num = ''
        for i in range(len(val)):
            while num >= val[i]:
                num -= val[i]
                roman_num += syms[i]
        return roman_num

    def get_current_hierarchy(self):
        """Return copy of current hierarchy."""
        return list(self.hierarchy)

    def get_section_ref(self):
        """Return concise section reference for manifest."""
        if not self.hierarchy:
            return None
        # Build reference like "7.A(ii)"
        parts = [item["number"].rstrip('.') for item in self.hierarchy]
        return "".join(parts)

    def get_full_reference(self):
        """Return full section reference string with captions."""
        if not self.hierarchy:
            return None
        parts = []
        for item in self.hierarchy:
            if item["caption"]:
                parts.append(f"{item['number']} {item['caption']}")
            else:
                parts.append(item['number'])
        return " > ".join(parts)


def extract_defined_terms(text):
    """Identify potential defined terms."""
    quoted_terms = re.findall(r'"([A-Z][^"]+)"', text)
    paren_terms = re.findall(r'\((?:the\s+)?"([A-Z][^"]+)"\)', text)
    return list(set(quoted_terms + paren_terms))


def process_table(table, start_id, section_tracker):
    """Process a table and return structured data."""
    table_data = {
        "type": "table",
        "id": f"tbl_{start_id}",
        "rows": [],
        "section_hierarchy": section_tracker.get_current_hierarchy()
    }

    para_id = start_id
    for row_idx, row in enumerate(table.rows):
        row_data = []
        for cell_idx, cell in enumerate(row.cells):
            cell_paragraphs = []
            for para in cell.paragraphs:
                para_id += 1
                text = para.text.strip()
                section_num, remaining, num_type = extract_section_number(text)
                caption = extract_caption(text)

                cell_paragraphs.append({
                    "id": f"p_{para_id}",
                    "text": text,
                    "section_number": section_num,
                    "caption": caption,
                    "style_info": get_paragraph_style_info(para),
                    "section_hierarchy": section_tracker.get_current_hierarchy()
                })
            row_data.append({
                "cell_id": f"cell_{row_idx}_{cell_idx}",
                "paragraphs": cell_paragraphs
            })
        table_data["rows"].append(row_data)

    return table_data, para_id


def iter_block_items(document):
    """Iterate through document body items in order."""
    parent = document.element.body
    for child in parent.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, document)
        elif child.tag == qn('w:tbl'):
            yield Table(child, document)


def parse_document(docx_path):
    """
    Parse a .docx file and extract structured content with section tracking.
    """
    doc = Document(docx_path)
    section_tracker = SectionTracker()

    result = {
        "source_file": str(docx_path),
        "metadata": {
            "core_properties": {}
        },
        "content": [],
        "defined_terms": [],
        "sections": [],
        "exhibits": []
    }

    # Extract core properties
    try:
        props = doc.core_properties
        result["metadata"]["core_properties"] = {
            "title": props.title or "",
            "author": props.author or "",
            "created": str(props.created) if props.created else "",
            "modified": str(props.modified) if props.modified else ""
        }
    except Exception:
        pass

    para_id = 0
    all_defined_terms = set()

    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            para_id += 1
            para_text = block.text.strip()
            style_info = get_paragraph_style_info(block)

            # Extract section number and caption
            section_num, remaining, num_type = extract_section_number(para_text)
            caption = extract_caption(para_text)

            # Update section tracker
            numbering_level = style_info["numbering"]["level"] if style_info["numbering"] else None
            numId = style_info["numbering"]["numId"] if style_info["numbering"] else None

            # Update tracker for any numbered paragraph or heading
            if numbering_level is not None or section_num or style_info["is_heading"]:
                section_tracker.update(numbering_level, section_num, caption, numId)

            para_data = {
                "type": "paragraph",
                "id": f"p_{para_id}",
                "text": para_text,
                "section_number": section_num,
                "section_ref": section_tracker.get_section_ref(),
                "caption": caption,
                "style_info": style_info,
                "section_hierarchy": section_tracker.get_current_hierarchy()
            }

            # Track sections based on headings or numbered sections
            if style_info["is_heading"] or (section_num and num_type in ['article', 'section', 'top']):
                result["sections"].append({
                    "id": f"sec_{para_id}",
                    "number": section_num,
                    "title": caption or para_text[:50],
                    "para_id": f"p_{para_id}",
                    "hierarchy": section_tracker.get_current_hierarchy()
                })

            # Detect exhibits
            if re.match(r'^EXHIBIT\s+[A-Z0-9]', para_text, re.IGNORECASE):
                result["exhibits"].append({
                    "id": f"ex_{para_id}",
                    "title": para_text,
                    "start_para_id": f"p_{para_id}"
                })

            # Extract defined terms
            terms = extract_defined_terms(para_text)
            all_defined_terms.update(terms)

            result["content"].append(para_data)

        elif isinstance(block, Table):
            table_data, para_id = process_table(block, para_id, section_tracker)
            result["content"].append(table_data)

    result["defined_terms"] = sorted(list(all_defined_terms))

    return result


def detect_contract_exhibits(content):
    """Detect exhibits that contain standalone contract language."""
    contract_indicators = [
        r'\bWHEREAS\b',
        r'\bNOW,?\s*THEREFORE\b',
        r'\bIN WITNESS WHEREOF\b',
        r'\bparties?\s+(?:hereto|agree)\b',
        r'\bThis\s+Agreement\b',
        r'\beffective\s+(?:as\s+of\s+)?(?:the\s+)?date\b',
    ]

    exhibits_with_contracts = []
    in_exhibit = False
    current_exhibit = None
    exhibit_text = []

    for item in content:
        if item["type"] == "paragraph":
            text = item["text"]
            if re.match(r'^EXHIBIT\s+[A-Z0-9]', text, re.IGNORECASE):
                if current_exhibit and exhibit_text:
                    full_text = " ".join(exhibit_text)
                    for pattern in contract_indicators:
                        if re.search(pattern, full_text, re.IGNORECASE):
                            exhibits_with_contracts.append(current_exhibit)
                            break
                current_exhibit = text
                exhibit_text = []
                in_exhibit = True
            elif in_exhibit:
                exhibit_text.append(text)

    if current_exhibit and exhibit_text:
        full_text = " ".join(exhibit_text)
        for pattern in contract_indicators:
            if re.search(pattern, full_text, re.IGNORECASE):
                exhibits_with_contracts.append(current_exhibit)
                break

    return exhibits_with_contracts


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_docx.py <input.docx> [output.json]")
        sys.exit(1)

    input_path = Path(sys.argv[1])

    if not input_path.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    if len(sys.argv) >= 3:
        output_path = Path(sys.argv[2])
    else:
        output_path = input_path.with_suffix('.parsed.json')

    print(f"Parsing: {input_path}")
    result = parse_document(input_path)

    contract_exhibits = detect_contract_exhibits(result["content"])
    if contract_exhibits:
        result["exhibits_with_contracts"] = contract_exhibits

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Output written to: {output_path}")
    print(f"Paragraphs extracted: {len([c for c in result['content'] if c['type'] == 'paragraph'])}")
    print(f"Tables found: {len([c for c in result['content'] if c['type'] == 'table'])}")
    print(f"Defined terms found: {len(result['defined_terms'])}")
    print(f"Sections found: {len(result['sections'])}")
    print(f"Exhibits found: {len(result['exhibits'])}")

    if contract_exhibits:
        print(f"\n*** EXHIBITS WITH CONTRACT LANGUAGE DETECTED ***")
        for ex in contract_exhibits:
            print(f"  - {ex}")


if __name__ == "__main__":
    main()
