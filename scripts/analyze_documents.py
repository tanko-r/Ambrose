#!/usr/bin/env python3
"""
Phase 1: Document Analysis & Mapping

Analyzes both target and template documents to extract:
- Defined terms with full definitions and mappings
- Section structure and correspondence
- Comprehensive risk inventory
- Gap analysis for missing protective concepts
- Document-specific judgment framework preparation

This script prepares the data structure; the LLM uses this data
to generate the document-specific judgment framework during the
redline.md command execution.
"""

import json
import sys
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple, Any


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class DefinedTermExtractor:
    """
    Extracts defined terms and their full definitions from parsed documents.

    Looks for patterns like:
    - "Term" means ...
    - "Term" shall mean ...
    - (the "Term")
    - (hereinafter referred to as the "Term")
    - "Term" or "Alternative Term"
    - "Term" (the "Abbreviated")
    """

    def __init__(self, parsed_doc):
        self.doc = parsed_doc
        self.terms: Dict[str, Dict[str, Any]] = {}  # term -> {definition, location, para_id, context}
        self.term_aliases: Dict[str, str] = {}  # alias -> canonical term

    def extract_all(self):
        """Extract all defined terms with their definitions."""
        for item in self.doc.get('content', []):
            if item.get('type') == 'paragraph':
                self._extract_from_paragraph(item)
            elif item.get('type') == 'table':
                self._extract_from_table(item)

        # Also check for standalone definitions section
        self._find_definitions_section()

        return self.terms

    def _extract_from_paragraph(self, para):
        """Extract defined terms from a single paragraph."""
        text = para.get('text', '')
        para_id = para.get('id', '')
        section_ref = para.get('section_ref', '')

        # Pattern 1: "Term" means/shall mean
        pattern1 = r'"([A-Z][^"]+)"\s+(?:means|shall mean|is defined as|refers to)\s+([^.]+(?:\.[^"]*)?)'
        for match in re.finditer(pattern1, text, re.IGNORECASE):
            term = match.group(1).strip()
            definition = match.group(2).strip()
            # Clean up definition - take first sentence or reasonable chunk
            definition = self._clean_definition(definition)
            if term not in self.terms or len(definition) > len(self.terms[term].get('definition', '')):
                self.terms[term] = {
                    'term': term,
                    'definition': definition,
                    'location': section_ref or para_id,
                    'para_id': para_id
                }

        # Pattern 2: (the "Term") or (hereinafter "Term")
        pattern2 = r'\((?:the\s+|hereinafter\s+(?:referred\s+to\s+as\s+)?)?["\']([A-Z][^"\']+)["\']\)'
        for match in re.finditer(pattern2, text):
            term = match.group(1).strip()
            if term not in self.terms:
                # For inline definitions, extract context before the parenthetical
                context_start = max(0, match.start() - 200)
                context = text[context_start:match.start()]
                # Try to find the subject being defined
                definition = self._extract_inline_context(context)
                self.terms[term] = {
                    'term': term,
                    'definition': definition if definition else f"[Defined inline at {section_ref or para_id}]",
                    'location': section_ref or para_id,
                    'para_id': para_id
                }

    def _extract_from_table(self, table):
        """Extract defined terms from table cells."""
        for row in table.get('rows', []):
            for cell in row:
                for para in cell.get('paragraphs', []):
                    self._extract_from_paragraph(para)

    def _find_definitions_section(self):
        """Look for a dedicated definitions section."""
        in_definitions = False
        for item in self.doc.get('content', []):
            if item.get('type') != 'paragraph':
                continue

            text = item.get('text', '')
            caption = item.get('caption', '') or ''

            # Check if we're entering a definitions section
            if re.search(r'\b(definitions?|defined terms)\b', caption, re.IGNORECASE):
                in_definitions = True
                continue

            # Check if we're leaving definitions (new major section)
            if in_definitions:
                hierarchy = item.get('section_hierarchy', [])
                if hierarchy and hierarchy[0].get('level', 0) == 0:
                    section_caption = hierarchy[0].get('caption', '')
                    if section_caption and 'definition' not in section_caption.lower():
                        in_definitions = False
                        continue

            # If in definitions section, try to extract
            if in_definitions:
                self._extract_from_paragraph(item)

    def _clean_definition(self, text):
        """Clean up extracted definition text."""
        # Remove trailing punctuation artifacts
        text = text.strip()
        # Take first sentence or first 300 chars
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if sentences:
            first = sentences[0]
            if len(first) > 300:
                first = first[:300] + '...'
            return first
        return text[:300] if len(text) > 300 else text

    def _extract_inline_context(self, context):
        """Extract meaningful context for inline definitions."""
        # Look for the last sentence or phrase
        sentences = re.split(r'(?<=[.!?])\s+', context)
        if sentences:
            last = sentences[-1].strip()
            if len(last) > 20:  # Meaningful content
                return last[:200]
        return None


class SectionMapper:
    """
    Maps sections between target and template documents.

    Uses section headers, captions, and content keywords to align sections.
    """

    # Common section name variations
    SECTION_ALIASES = {
        'representations': ['representations', 'reps', 'warranties', 'representations and warranties'],
        'default': ['default', 'remedies', 'breach', 'default and remedies'],
        'closing': ['closing', 'settlement', 'consummation'],
        'due_diligence': ['due diligence', 'inspection', 'review period', 'feasibility'],
        'purchase_price': ['purchase price', 'consideration', 'price'],
        'deposit': ['deposit', 'earnest money', 'escrow'],
        'title': ['title', 'survey', 'title and survey'],
        'conditions': ['conditions', 'conditions precedent', 'conditions to closing'],
        'indemnification': ['indemnification', 'indemnity', 'hold harmless'],
        'termination': ['termination', 'termination rights'],
        'assignment': ['assignment', 'transfer'],
        'notices': ['notices', 'notice'],
        'miscellaneous': ['miscellaneous', 'general provisions', 'general'],
        'prorations': ['prorations', 'adjustments', 'prorations and adjustments'],
        'casualty': ['casualty', 'condemnation', 'damage', 'casualty and condemnation'],
        'brokers': ['brokers', 'brokerage', 'commission'],
        'confidentiality': ['confidentiality', 'confidential', 'non-disclosure'],
    }

    def __init__(self, target_doc, template_doc):
        self.target = target_doc
        self.template = template_doc
        self.target_sections = self._extract_sections(target_doc)
        self.template_sections = self._extract_sections(template_doc)

    def _extract_sections(self, doc):
        """Extract sections with their content."""
        sections = []
        current_section = None

        for item in doc.get('content', []):
            if item.get('type') != 'paragraph':
                continue

            hierarchy = item.get('section_hierarchy', [])
            if not hierarchy:
                continue

            # Check if this is a top-level section start
            if hierarchy[0].get('level', 0) == 0:
                section_num = hierarchy[0].get('number', '')
                section_caption = hierarchy[0].get('caption', '')

                if current_section:
                    sections.append(current_section)

                current_section = {
                    'number': section_num,
                    'caption': section_caption,
                    'normalized_name': self._normalize_section_name(section_caption),
                    'paragraphs': [],
                    'subsections': [],
                    'content_keywords': set()
                }

            if current_section:
                current_section['paragraphs'].append(item.get('id'))
                # Extract keywords from content
                text = item.get('text', '').lower()
                for keyword in self._extract_keywords(text):
                    current_section['content_keywords'].add(keyword)

                # Track subsections
                if len(hierarchy) > 1:
                    subsec = {
                        'number': hierarchy[1].get('number', ''),
                        'caption': hierarchy[1].get('caption', '')
                    }
                    if subsec not in current_section['subsections']:
                        current_section['subsections'].append(subsec)

        if current_section:
            sections.append(current_section)

        # Convert sets to lists for JSON serialization
        for section in sections:
            section['content_keywords'] = list(section['content_keywords'])

        return sections

    def _normalize_section_name(self, caption):
        """Normalize section name for matching."""
        if not caption:
            return ''
        caption = caption.lower().strip()
        for key, aliases in self.SECTION_ALIASES.items():
            for alias in aliases:
                if alias in caption:
                    return key
        return caption

    def _extract_keywords(self, text):
        """Extract relevant keywords from text."""
        keywords = []
        # Legal/contract keywords
        legal_terms = [
            'indemnif', 'represent', 'warrant', 'covenant', 'default',
            'terminat', 'assign', 'closing', 'deposit', 'escrow',
            'title', 'survey', 'due diligence', 'inspection', 'casualty',
            'condemn', 'broker', 'confidential', 'notice', 'proration',
            'survival', 'liability', 'cap', 'basket', 'knowledge'
        ]
        for term in legal_terms:
            if term in text:
                keywords.append(term)
        return keywords

    def create_mapping(self):
        """Create a mapping between target and template sections."""
        mapping = []

        for target_sec in self.target_sections:
            match = self._find_best_match(target_sec)
            mapping.append({
                'target_section': {
                    'number': target_sec['number'],
                    'caption': target_sec['caption'],
                    'paragraphs': target_sec['paragraphs'],
                    'subsections': target_sec['subsections']
                },
                'template_section': match,
                'confidence': self._calculate_confidence(target_sec, match) if match else 0
            })

        return mapping

    def _find_best_match(self, target_sec):
        """Find the best matching template section."""
        best_match = None
        best_score = 0

        target_name = target_sec['normalized_name']
        target_keywords = set(target_sec.get('content_keywords', []))

        for template_sec in self.template_sections:
            score = 0

            # Name match
            template_name = template_sec['normalized_name']
            if target_name == template_name:
                score += 50
            elif target_name and template_name and (target_name in template_name or template_name in target_name):
                score += 30

            # Keyword overlap
            template_keywords = set(template_sec.get('content_keywords', []))
            overlap = len(target_keywords & template_keywords)
            score += overlap * 5

            if score > best_score:
                best_score = score
                best_match = {
                    'number': template_sec['number'],
                    'caption': template_sec['caption'],
                    'paragraphs': template_sec['paragraphs'],
                    'subsections': template_sec['subsections']
                }

        return best_match

    def _calculate_confidence(self, target_sec, match):
        """Calculate confidence score for a match."""
        if not match:
            return 0

        score = 0
        if target_sec['normalized_name'] == self._normalize_section_name(match.get('caption', '')):
            score += 0.5

        # Subsection overlap
        target_subs = {s.get('caption', '').lower() for s in target_sec.get('subsections', [])}
        match_subs = {s.get('caption', '').lower() for s in match.get('subsections', [])}
        if target_subs and match_subs:
            overlap = len(target_subs & match_subs) / max(len(target_subs), len(match_subs))
            score += overlap * 0.5

        return round(score, 2)


class RiskPatternDetector:
    """
    Detects common risk patterns in the target document.

    These patterns are used to guide the LLM's document-specific
    judgment framework generation.
    """

    # Risk patterns to detect
    RISK_PATTERNS = {
        'uncapped_liability': {
            'patterns': [
                r'indemnif[y|ies|ication].*?(?!shall not exceed|maximum|cap)',
                r'liable for.*?damages(?!.*(?:shall not exceed|cap|maximum))',
                r'hold\s+harmless(?!.*(?:shall not exceed|cap|maximum))'
            ],
            'exclude_if': ['cap', 'maximum', 'shall not exceed', 'limited to', 'basket'],
            'severity': 'high',
            'category': 'liability'
        },
        'unqualified_rep': {
            'patterns': [
                r'(?:seller|landlord|grantor)\s+(?:represents?|warrants?)\s+that(?!.*(?:to\s+(?:seller|landlord|grantor)[\'s]*\s+knowledge|in\s+all\s+material\s+respects))',
            ],
            'exclude_if': ["to seller's knowledge", "to landlord's knowledge", "material respects"],
            'severity': 'high',
            'category': 'representations'
        },
        'absolute_obligation': {
            'patterns': [
                r'(?:seller|landlord)\s+shall\s+(?:deliver|provide|cause|obtain|procure)(?!.*(?:commercially\s+reasonable|reasonable\s+efforts|best\s+efforts))',
            ],
            'exclude_if': ['commercially reasonable', 'reasonable efforts', 'best efforts'],
            'severity': 'medium',
            'category': 'obligations'
        },
        'unlimited_survival': {
            'patterns': [
                r'survive\s+(?:closing|termination)(?!.*(?:for\s+a\s+period|months?|years?|days?))',
            ],
            'exclude_if': ['for a period', 'months', 'years', 'days'],
            'severity': 'high',
            'category': 'survival'
        },
        'default_trap': {
            'patterns': [
                r'(?:any|each)\s+(?:breach|default|failure).*?(?:shall\s+constitute|constitutes).*?(?:material\s+)?default',
                r'time\s+is\s+of\s+the\s+essence',
            ],
            'exclude_if': ['material breach', 'cure period', 'notice and opportunity'],
            'severity': 'high',
            'category': 'default'
        },
        'no_cure_period': {
            'patterns': [
                r'(?:breach|default).*?(?:terminate|remedies?)(?!.*(?:cure|notice\s+and\s+opportunity|right\s+to\s+cure))',
            ],
            'exclude_if': ['cure', 'notice and opportunity', 'right to cure'],
            'severity': 'high',
            'category': 'default'
        },
        'broad_indemnity': {
            'patterns': [
                r'indemnif[y|ies].*?(?:any\s+and\s+all|all\s+claims|any\s+loss)',
            ],
            'exclude_if': ['arising out of', 'solely caused by', 'limited to'],
            'severity': 'medium',
            'category': 'indemnification'
        },
        'unilateral_termination': {
            'patterns': [
                r'(?:purchaser|buyer|tenant)\s+(?:may|shall\s+have\s+the\s+right\s+to)\s+terminate.*?(?:sole\s+discretion|any\s+reason|for\s+convenience)',
            ],
            'exclude_if': [],
            'severity': 'medium',
            'category': 'termination'
        },
    }

    def __init__(self, target_doc):
        self.doc = target_doc

    def detect_all(self):
        """Detect all risk patterns in the document."""
        risks = []
        risk_id = 0

        for item in self.doc.get('content', []):
            if item.get('type') != 'paragraph':
                continue

            text = item.get('text', '')
            text_lower = text.lower()
            para_id = item.get('id', '')
            section_ref = item.get('section_ref', '')
            hierarchy = item.get('section_hierarchy', [])

            for risk_type, config in self.RISK_PATTERNS.items():
                # Check exclusions first
                excluded = any(excl in text_lower for excl in config['exclude_if'])
                if excluded:
                    continue

                # Check patterns
                for pattern in config['patterns']:
                    if re.search(pattern, text_lower):
                        risk_id += 1
                        risks.append({
                            'risk_id': f'R{risk_id}',
                            'type': risk_type,
                            'category': config['category'],
                            'severity': config['severity'],
                            'location': section_ref or para_id,
                            'para_id': para_id,
                            'section_hierarchy': hierarchy,
                            'excerpt': text[:200] + ('...' if len(text) > 200 else ''),
                            'description': self._get_risk_description(risk_type)
                        })
                        break  # Only record once per pattern type per paragraph

        return risks

    def _get_risk_description(self, risk_type):
        """Get human-readable description of risk type."""
        descriptions = {
            'uncapped_liability': 'Uncapped liability or indemnification exposure',
            'unqualified_rep': 'Unqualified representation that should have knowledge/materiality qualifier',
            'absolute_obligation': 'Absolute obligation that should be reasonable efforts',
            'unlimited_survival': 'Unlimited or unstated survival period',
            'default_trap': 'Default provision that could be triggered by minor/technical breach',
            'no_cure_period': 'No cure period before default remedies trigger',
            'broad_indemnity': 'Overly broad indemnification scope',
            'unilateral_termination': 'Unilateral termination right for counterparty',
        }
        return descriptions.get(risk_type, risk_type)


class GapAnalyzer:
    """
    Identifies concepts in template that are missing from target.
    """

    # Concepts to look for
    PROTECTIVE_CONCEPTS = {
        'knowledge_definition': {
            'search_terms': ['designated.*representative', 'actual knowledge', "seller's knowledge.*means"],
            'description': "Definition of Seller's Knowledge limiting to actual knowledge of designated representative"
        },
        'anti_sandbagging': {
            'search_terms': ['sandbagging', 'knowledge.*prior.*closing.*waive', 'knew.*breach.*proceed'],
            'description': 'Anti-sandbagging provision preventing claims for known issues'
        },
        'as_is': {
            'search_terms': ['as-is', 'where-is', 'as is', 'where is', 'expressly disclaim'],
            'description': 'As-Is/Where-Is acknowledgment with disclaimer of warranties'
        },
        'purchaser_release': {
            'search_terms': ['release.*seller', 'waive.*claim.*condition', 'release.*property condition'],
            'description': 'Purchaser release of claims for property condition'
        },
        'liability_cap': {
            'search_terms': ['liability.*cap', 'aggregate.*shall not exceed', 'maximum.*liability', 'cap.*\\$'],
            'description': 'Aggregate liability cap for Seller'
        },
        'survival_limit': {
            'search_terms': ['survive.*months', 'survival period', 'survive.*closing.*(?:9|nine|12|twelve)'],
            'description': 'Limited survival period for representations'
        },
        'no_consequential': {
            'search_terms': ['consequential.*damages', 'punitive.*damages', 'speculative.*damages'],
            'description': 'Exclusion of consequential/punitive damages'
        },
        'no_recourse': {
            'search_terms': ['no recourse', 'look solely', 'recourse.*limited'],
            'description': 'No recourse to individuals, only to entity'
        },
        'basket_deductible': {
            'search_terms': ['basket', 'deductible', 'aggregate.*exceed.*before', 'threshold'],
            'description': 'Basket/deductible before claims accrue'
        },
        'commercially_reasonable': {
            'search_terms': ['commercially reasonable efforts', 'reasonable efforts'],
            'description': 'Commercially reasonable efforts standard for obligations'
        },
        'materiality_qualifier': {
            'search_terms': ['material respects', 'materially breach', 'material compliance'],
            'description': 'Materiality qualifiers on compliance/breach standards'
        },
        'notice_and_cure': {
            'search_terms': ['notice.*cure', 'opportunity to cure', 'cure period', 'right to cure'],
            'description': 'Notice and cure period before default'
        },
    }

    def __init__(self, target_doc, template_doc):
        self.target = target_doc
        self.template = template_doc

    def analyze(self):
        """Find concepts in template missing from target."""
        target_text = self._get_full_text(self.target)
        template_text = self._get_full_text(self.template)

        gaps = []

        for concept, config in self.PROTECTIVE_CONCEPTS.items():
            in_target = self._concept_exists(target_text, config['search_terms'])
            in_template = self._concept_exists(template_text, config['search_terms'])

            if in_template and not in_target:
                # Find where it is in template
                location = self._find_concept_location(self.template, config['search_terms'])
                gaps.append({
                    'concept': concept,
                    'description': config['description'],
                    'template_location': location,
                    'recommended_insertion': self._recommend_insertion_point(concept)
                })

        return gaps

    def _get_full_text(self, doc):
        """Get all text from document as single string."""
        texts = []
        for item in doc.get('content', []):
            if item.get('type') == 'paragraph':
                texts.append(item.get('text', ''))
            elif item.get('type') == 'table':
                for row in item.get('rows', []):
                    for cell in row:
                        for para in cell.get('paragraphs', []):
                            texts.append(para.get('text', ''))
        return ' '.join(texts).lower()

    def _concept_exists(self, text, search_terms):
        """Check if any search term exists in text."""
        for term in search_terms:
            if re.search(term, text, re.IGNORECASE):
                return True
        return False

    def _find_concept_location(self, doc, search_terms):
        """Find the section where a concept appears."""
        for item in doc.get('content', []):
            if item.get('type') != 'paragraph':
                continue
            text = item.get('text', '').lower()
            for term in search_terms:
                if re.search(term, text, re.IGNORECASE):
                    hierarchy = item.get('section_hierarchy', [])
                    if hierarchy:
                        return f"{hierarchy[0].get('number', '')} {hierarchy[0].get('caption', '')}"
                    return item.get('section_ref', item.get('id', ''))
        return 'Unknown'

    def _recommend_insertion_point(self, concept):
        """Recommend where to insert a missing concept."""
        recommendations = {
            'knowledge_definition': 'After Seller Representations section',
            'anti_sandbagging': 'After Seller Representations section',
            'as_is': 'After Seller Representations section',
            'purchaser_release': 'After Seller Representations section',
            'liability_cap': 'After Survival provision in Representations',
            'survival_limit': 'At end of Seller Representations section',
            'no_consequential': 'In Default/Remedies section',
            'no_recourse': 'After Seller Representations section',
            'basket_deductible': 'With liability cap provision',
            'commercially_reasonable': 'Throughout obligations sections',
            'materiality_qualifier': 'Throughout representations',
            'notice_and_cure': 'In Default section',
        }
        return recommendations.get(concept, 'Appropriate section')


def identify_parties(target_doc, user_context):
    """
    Identify parties in the document and their roles.
    """
    text = ' '.join(
        item.get('text', '')
        for item in target_doc.get('content', [])
        if item.get('type') == 'paragraph'
    )[:5000]  # First 5000 chars should contain party definitions

    parties = {
        'client': user_context.get('representation', 'seller'),
        'counterparty': None,
        'detected_parties': []
    }

    # Common party pairs
    party_pairs = {
        'seller': 'purchaser',
        'purchaser': 'seller',
        'buyer': 'seller',
        'landlord': 'tenant',
        'tenant': 'landlord',
        'lender': 'borrower',
        'borrower': 'lender',
        'grantor': 'grantee',
        'grantee': 'grantor',
    }

    client = parties['client'].lower()
    if client in party_pairs:
        parties['counterparty'] = party_pairs[client]

    # Detect party names from document
    party_patterns = [
        r'"([A-Z][^"]+)"\s*\(["\'](?:Seller|Purchaser|Buyer|Landlord|Tenant|Lender|Borrower|Grantor|Grantee)["\']',
        r'(?:Seller|Purchaser|Buyer|Landlord|Tenant|Lender|Borrower|Grantor|Grantee)["\']?\s*means\s+([A-Za-z][^,.\n]+)',
    ]

    for pattern in party_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            party_name = match.group(1).strip()
            if party_name and party_name not in parties['detected_parties']:
                parties['detected_parties'].append(party_name)

    return parties


def build_section_content_map(target_doc):
    """
    Build a map of sections to their full content.
    Used for Phase 3 section-by-section processing.
    """
    sections = {}
    current_section = None
    current_content = []

    for item in target_doc.get('content', []):
        if item.get('type') != 'paragraph':
            continue

        hierarchy = item.get('section_hierarchy', [])
        if not hierarchy:
            continue

        # Check if this is a new top-level section
        top_level = hierarchy[0] if hierarchy else {}
        section_key = f"{top_level.get('number', '')}_{top_level.get('caption', '')}".strip('_')

        if section_key != current_section:
            # Save previous section
            if current_section and current_content:
                sections[current_section] = current_content

            # Start new section
            current_section = section_key
            current_content = []

        current_content.append({
            'id': item.get('id'),
            'text': item.get('text'),
            'section_hierarchy': hierarchy,
            'section_ref': item.get('section_ref')
        })

    # Don't forget last section
    if current_section and current_content:
        sections[current_section] = current_content

    return sections


def main():
    """
    Main entry point for document analysis.

    Usage:
        python analyze_documents.py <target_parsed.json> <template_parsed.json> <output_dir> [--representation seller]
    """
    if len(sys.argv) < 4:
        print("Usage: python analyze_documents.py <target.json> <template.json> <output_dir> [--representation seller]")
        sys.exit(1)

    target_path = Path(sys.argv[1])
    template_path = Path(sys.argv[2])
    output_dir = Path(sys.argv[3])

    # Parse optional arguments
    representation = 'seller'
    for i, arg in enumerate(sys.argv):
        if arg == '--representation' and i + 1 < len(sys.argv):
            representation = sys.argv[i + 1]

    # Load documents
    print(f"Loading target: {target_path}")
    target = load_json(target_path)
    print(f"Loading template: {template_path}")
    template = load_json(template_path)

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # User context
    user_context = {
        'representation': representation
    }

    print("\n=== Phase 1: Document Analysis ===\n")

    # 1. Extract defined terms
    print("Extracting defined terms from target...")
    target_terms = DefinedTermExtractor(target).extract_all()
    print(f"  Found {len(target_terms)} defined terms in target")

    print("Extracting defined terms from template...")
    template_terms = DefinedTermExtractor(template).extract_all()
    print(f"  Found {len(template_terms)} defined terms in template")

    # 2. Map sections
    print("\nMapping sections between documents...")
    mapper = SectionMapper(target, template)
    section_map = mapper.create_mapping()
    print(f"  Mapped {len(section_map)} sections")

    # 3. Detect risks
    print("\nDetecting risk patterns in target...")
    detector = RiskPatternDetector(target)
    risks = detector.detect_all()
    print(f"  Found {len(risks)} potential risks")

    # 4. Analyze gaps
    print("\nAnalyzing protective concept gaps...")
    gap_analyzer = GapAnalyzer(target, template)
    gaps = gap_analyzer.analyze()
    print(f"  Found {len(gaps)} missing protective concepts")

    # 5. Identify parties
    print("\nIdentifying parties...")
    parties = identify_parties(target, user_context)
    print(f"  Client: {parties['client']}")
    print(f"  Counterparty: {parties['counterparty']}")

    # 6. Build section content map
    print("\nBuilding section content map...")
    section_content = build_section_content_map(target)
    template_section_content = build_section_content_map(template)
    print(f"  Target sections: {len(section_content)}")
    print(f"  Template sections: {len(template_section_content)}")

    # Create term mappings
    term_mappings = []
    for target_term, target_data in target_terms.items():
        template_match = template_terms.get(target_term)
        if template_match:
            differences = 'none' if target_data['definition'] == template_match['definition'] else 'definition differs'
        else:
            # Look for similar terms
            template_match = None
            for tmpl_term in template_terms:
                if target_term.lower() in tmpl_term.lower() or tmpl_term.lower() in target_term.lower():
                    template_match = template_terms[tmpl_term]
                    differences = f'named "{tmpl_term}" in template'
                    break
            if not template_match:
                differences = 'not in template'

        term_mappings.append({
            'target_term': target_term,
            'template_term': template_match['term'] if template_match else None,
            'differences': differences
        })

    # Build analysis output
    analysis = {
        'analysis_date': datetime.now().isoformat(),
        'source_files': {
            'target': str(target_path),
            'template': str(template_path)
        },
        'parties': parties,
        'defined_terms': {
            'target': list(target_terms.values()),
            'template': list(template_terms.values()),
            'mappings': term_mappings
        },
        'section_map': section_map,
        'risk_inventory': risks,
        'missing_from_target': gaps,
        # Placeholder for LLM-generated judgment framework
        'judgment_framework': {
            'always_change': [
                'Uncapped liability or indemnification',
                'Default traps (harsh consequences for minor breaches)',
                'Open-ended terms (indefinite obligations, unlimited survival)'
            ],
            'preserve': [
                'Strictly mechanical and party-neutral terms',
                'Standard boilerplate without substantive risk allocation'
            ],
            'document_specific_categories': [],  # To be populated by LLM
            'note': 'Document-specific categories should be generated by LLM analysis'
        },
        'section_content': {
            'target': section_content,
            'template': template_section_content
        }
    }

    # Save analysis
    output_path = output_dir / 'analysis.json'
    save_json(analysis, output_path)
    print(f"\n=== Analysis Complete ===")
    print(f"Output saved to: {output_path}")

    # Print summary
    print("\n--- Summary ---")
    print(f"Defined terms: {len(target_terms)} (target), {len(template_terms)} (template)")
    print(f"Section mappings: {len(section_map)}")
    print(f"Risks detected: {len(risks)}")
    print(f"  High severity: {len([r for r in risks if r['severity'] == 'high'])}")
    print(f"  Medium severity: {len([r for r in risks if r['severity'] == 'medium'])}")
    print(f"Missing protective concepts: {len(gaps)}")
    for gap in gaps:
        print(f"  - {gap['concept']}: {gap['description']}")

    return analysis


if __name__ == "__main__":
    main()
