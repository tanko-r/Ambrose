#!/usr/bin/env python3
"""
Analysis Service for Risk/Opportunity Detection

Provides comprehensive contract analysis including:
- Risk inventory per clause
- Opportunity mapping
- Conceptual document mapping
- Contract-type specific analysis (PSA, Lease, Easement, etc.)
"""

import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from collections import defaultdict
from datetime import datetime


# =============================================================================
# Contract Type Skills - Pre-baked risks/opportunities by contract type
# =============================================================================

CONTRACT_SKILLS = {
    'psa': {
        'name': 'Purchase and Sale Agreement',
        'risks': [
            {
                'pattern': r'(?:purchaser|buyer)\s+may\s+terminate.*?(?:sole\s+discretion|any\s+reason)',
                'type': 'unilateral_termination',
                'severity': 'high',
                'description': 'Buyer has broad termination right without clear conditions'
            },
            {
                'pattern': r'closing.*?(?:shall\s+occur|take\s+place).*?(?:within|no\s+later\s+than)',
                'type': 'closing_timeline',
                'severity': 'medium',
                'description': 'Closing deadline may be inflexible - consider extension rights'
            },
            {
                'pattern': r'deposit.*?(?:non-?refundable|forfeited?|liquidated\s+damages)',
                'type': 'deposit_at_risk',
                'severity': 'high',
                'description': 'Deposit becomes non-refundable - verify conditions are acceptable'
            },
            {
                'pattern': r'title\s+(?:objection|defect).*?(?:\d+)\s+(?:days?|business\s+days?)',
                'type': 'short_title_period',
                'severity': 'medium',
                'description': 'Short title review period may be insufficient'
            },
            {
                'pattern': r'due\s+diligence.*?(?:waive|terminate).*?(?:\d+)\s+(?:days?)',
                'type': 'due_diligence_deadline',
                'severity': 'medium',
                'description': 'Due diligence period may be too short for thorough review'
            },
            {
                'pattern': r'representations?.*?survive.*?(?:closing|settlement)',
                'exclude': r'(?:for\s+a\s+period|months?|years?|\d+\s+days?)',
                'type': 'unlimited_survival',
                'severity': 'high',
                'description': 'Representations may survive indefinitely without time limit'
            },
            {
                'pattern': r'(?:seller|vendor)\s+(?:represents?|warrants?).*?environmental',
                'exclude': r"to\s+(?:seller|vendor)'?s?\s+knowledge",
                'type': 'unqualified_environmental_rep',
                'severity': 'high',
                'description': 'Environmental representation lacks knowledge qualifier'
            },
            {
                'pattern': r'as-?is|where-?is',
                'type': 'as_is_present',
                'severity': 'info',
                'is_opportunity': True,
                'description': 'As-is clause present - good for seller protection'
            }
        ],
        'opportunities': [
            {
                'check': 'missing_as_is',
                'description': 'Add as-is/where-is acknowledgment',
                'recommendation': 'Insert as-is clause with express disclaimer of warranties'
            },
            {
                'check': 'missing_knowledge_definition',
                'description': 'Define Seller\'s Knowledge',
                'recommendation': 'Add definition limiting knowledge to designated representative'
            },
            {
                'check': 'missing_liability_cap',
                'description': 'Add liability cap',
                'recommendation': 'Cap aggregate liability at purchase price or lesser amount'
            },
            {
                'check': 'missing_survival_limit',
                'description': 'Add survival period limit',
                'recommendation': 'Limit representation survival to 9-12 months post-closing'
            },
            {
                'check': 'missing_anti_sandbagging',
                'description': 'Add anti-sandbagging provision',
                'recommendation': 'Prevent claims for matters known pre-closing'
            }
        ]
    },
    'lease': {
        'name': 'Lease Agreement',
        'risks': [
            {
                'pattern': r'(?:landlord|lessor)\s+may\s+terminate.*?(?:immediately|without\s+notice)',
                'type': 'immediate_termination',
                'severity': 'high',
                'description': 'Landlord has immediate termination right without cure period'
            },
            {
                'pattern': r'rent.*?(?:increase|adjustment).*?(?:sole\s+discretion|market)',
                'type': 'rent_increase_exposure',
                'severity': 'medium',
                'description': 'Rent increase provisions may be uncapped or discretionary'
            },
            {
                'pattern': r'(?:tenant|lessee).*?(?:indemnif|hold\s+harmless).*?(?:all|any\s+and\s+all)',
                'exclude': r'(?:solely\s+caused|gross\s+negligence|willful)',
                'type': 'broad_tenant_indemnity',
                'severity': 'high',
                'description': 'Tenant indemnity is overly broad'
            },
            {
                'pattern': r'assignment.*?(?:consent|approval).*?(?:sole\s+discretion|unreasonably)',
                'type': 'assignment_restriction',
                'severity': 'medium',
                'description': 'Assignment restrictions may be too broad'
            },
            {
                'pattern': r'(?:landlord|lessor).*?(?:enter|access).*?(?:any\s+time|without\s+notice)',
                'type': 'unlimited_access',
                'severity': 'medium',
                'description': 'Landlord access rights may be too broad'
            }
        ],
        'opportunities': [
            {
                'check': 'missing_quiet_enjoyment',
                'description': 'Ensure quiet enjoyment covenant',
                'recommendation': 'Add express covenant of quiet enjoyment'
            },
            {
                'check': 'missing_landlord_maintenance',
                'description': 'Define landlord maintenance obligations',
                'recommendation': 'Clarify landlord responsibility for structural/building systems'
            }
        ]
    },
    'easement': {
        'name': 'Easement Agreement',
        'risks': [
            {
                'pattern': r'easement.*?(?:perpetual|forever|permanent)',
                'type': 'perpetual_easement',
                'severity': 'info',
                'description': 'Easement is perpetual - verify this is intended'
            },
            {
                'pattern': r'(?:grantor|owner).*?(?:shall\s+not|may\s+not).*?(?:use|build|construct)',
                'type': 'use_restriction',
                'severity': 'medium',
                'description': 'Restrictions on grantor use of property'
            },
            {
                'pattern': r'(?:grantee|holder).*?expand|enlarge|increase',
                'type': 'expansion_rights',
                'severity': 'medium',
                'description': 'Easement holder may have expansion rights'
            }
        ],
        'opportunities': [
            {
                'check': 'missing_relocation_right',
                'description': 'Add relocation right for grantor',
                'recommendation': 'Allow grantor to relocate easement at grantor expense'
            }
        ]
    },
    'development': {
        'name': 'Development Agreement',
        'risks': [
            {
                'pattern': r'(?:developer|owner).*?(?:complete|finish).*?(?:by|no\s+later\s+than)',
                'type': 'completion_deadline',
                'severity': 'high',
                'description': 'Hard completion deadline without force majeure'
            },
            {
                'pattern': r'(?:performance\s+)?(?:bond|guaranty).*?(?:\d+%|percent)',
                'type': 'performance_security',
                'severity': 'medium',
                'description': 'Performance bond or security requirement'
            },
            {
                'pattern': r'(?:approve|approval).*?(?:sole\s+discretion|unreasonably)',
                'type': 'approval_discretion',
                'severity': 'medium',
                'description': 'Approval standards may be subjective'
            }
        ],
        'opportunities': [
            {
                'check': 'missing_force_majeure',
                'description': 'Add force majeure protection',
                'recommendation': 'Include force majeure extension for delays beyond control'
            }
        ]
    },
    'general': {
        'name': 'General Contract',
        'risks': [],
        'opportunities': []
    }
}

# =============================================================================
# Universal Risk Patterns (apply to all contracts)
# =============================================================================

UNIVERSAL_RISKS = [
    {
        'pattern': r'indemnif[y|ies|ication]',
        'exclude': r'(?:shall\s+not\s+exceed|maximum|cap|limited\s+to|basket)',
        'type': 'uncapped_indemnity',
        'category': 'liability',
        'severity': 'high',
        'description': 'Indemnification without cap or limit'
    },
    {
        'pattern': r'(?:represents?|warrants?)\s+that',
        'exclude': r"(?:to\s+.+(?:knowledge|belief)|in\s+all\s+material\s+respects)",
        'type': 'unqualified_representation',
        'category': 'representations',
        'severity': 'high',
        'description': 'Representation without knowledge or materiality qualifier'
    },
    {
        'pattern': r'(?:shall|must)\s+(?:deliver|provide|cause|obtain)',
        'exclude': r'(?:commercially\s+reasonable|reasonable\s+efforts|best\s+efforts)',
        'type': 'absolute_obligation',
        'category': 'obligations',
        'severity': 'medium',
        'description': 'Absolute obligation without efforts qualifier'
    },
    {
        'pattern': r'(?:default|breach).*?(?:terminate|remedies)',
        'exclude': r'(?:cure|notice\s+and\s+opportunity|right\s+to\s+cure)',
        'type': 'no_cure_period',
        'category': 'default',
        'severity': 'high',
        'description': 'Default remedy without cure period'
    },
    {
        'pattern': r'time\s+is\s+of\s+the\s+essence',
        'type': 'time_essence',
        'category': 'timing',
        'severity': 'high',
        'description': 'Time is of the essence - makes all deadlines strict'
    },
    {
        'pattern': r'(?:waive|waiver).*?(?:all|any\s+and\s+all)\s+(?:rights|claims|defenses)',
        'type': 'broad_waiver',
        'category': 'waivers',
        'severity': 'high',
        'description': 'Broad waiver of rights'
    },
    {
        'pattern': r'(?:assign|transfer).*?(?:without\s+consent|freely)',
        'type': 'free_assignment',
        'category': 'assignment',
        'severity': 'medium',
        'description': 'Counterparty may assign without consent'
    },
    {
        'pattern': r'(?:modify|amend|change).*?(?:sole\s+discretion|unilaterally)',
        'type': 'unilateral_modification',
        'category': 'modifications',
        'severity': 'high',
        'description': 'Counterparty may modify terms unilaterally'
    },
    {
        'pattern': r'(?:attorney|legal)\s+fees?',
        'exclude': r'(?:prevailing\s+party|each\s+party)',
        'type': 'one_sided_attorneys_fees',
        'category': 'dispute',
        'severity': 'medium',
        'description': 'Attorney fees provision may be one-sided'
    },
    {
        'pattern': r'(?:arbitrat|mediat)',
        'type': 'dispute_resolution',
        'category': 'dispute',
        'severity': 'info',
        'description': 'Alternative dispute resolution clause'
    },
    {
        'pattern': r'(?:govern|choice\s+of)\s+law',
        'type': 'governing_law',
        'category': 'dispute',
        'severity': 'info',
        'description': 'Governing law provision - verify favorable jurisdiction'
    },
    {
        'pattern': r'jury\s+(?:trial\s+)?waiver',
        'type': 'jury_waiver',
        'category': 'dispute',
        'severity': 'info',
        'description': 'Jury trial waiver present'
    }
]


def detect_risks(
    parsed_doc: Dict,
    contract_type: str,
    representation: str
) -> List[Dict]:
    """
    Detect all risks in the document.

    Returns list of risk objects with location and severity.
    """
    risks = []
    risk_id = 0

    # Get contract-specific patterns
    skill = CONTRACT_SKILLS.get(contract_type, CONTRACT_SKILLS['general'])
    type_risks = skill.get('risks', [])

    # Combine with universal risks
    all_patterns = UNIVERSAL_RISKS + type_risks

    # Determine which party terms to look for based on representation
    party_terms = get_party_terms(representation)

    for item in parsed_doc.get('content', []):
        if item.get('type') != 'paragraph':
            continue

        text = item.get('text', '')
        text_lower = text.lower()
        para_id = item.get('id', '')
        section_ref = item.get('section_ref', '')
        hierarchy = item.get('section_hierarchy', [])

        for pattern_config in all_patterns:
            pattern = pattern_config['pattern']
            exclude = pattern_config.get('exclude')

            # Check exclusion first
            if exclude and re.search(exclude, text_lower, re.IGNORECASE):
                continue

            # Check pattern match
            if re.search(pattern, text_lower, re.IGNORECASE):
                risk_id += 1

                # Determine if this affects our client
                affects_client = check_affects_client(text_lower, party_terms, representation)

                risks.append({
                    'risk_id': f'R{risk_id}',
                    'type': pattern_config['type'],
                    'category': pattern_config.get('category', 'general'),
                    'severity': pattern_config['severity'],
                    'description': pattern_config['description'],
                    'location': section_ref or para_id,
                    'para_id': para_id,
                    'section_hierarchy': hierarchy,
                    'excerpt': text[:200] + ('...' if len(text) > 200 else ''),
                    'affects_client': affects_client,
                    'is_opportunity': pattern_config.get('is_opportunity', False)
                })

    return risks


def get_party_terms(representation: str) -> Dict[str, List[str]]:
    """Get party terms based on representation."""
    party_map = {
        'seller': {'client': ['seller', 'grantor', 'vendor'], 'counterparty': ['buyer', 'purchaser', 'grantee']},
        'buyer': {'client': ['buyer', 'purchaser', 'grantee'], 'counterparty': ['seller', 'grantor', 'vendor']},
        'landlord': {'client': ['landlord', 'lessor', 'owner'], 'counterparty': ['tenant', 'lessee']},
        'tenant': {'client': ['tenant', 'lessee'], 'counterparty': ['landlord', 'lessor', 'owner']},
        'lender': {'client': ['lender', 'bank', 'holder'], 'counterparty': ['borrower', 'debtor']},
        'borrower': {'client': ['borrower', 'debtor'], 'counterparty': ['lender', 'bank', 'holder']},
        'grantor': {'client': ['grantor', 'owner'], 'counterparty': ['grantee', 'holder']},
        'grantee': {'client': ['grantee', 'holder'], 'counterparty': ['grantor', 'owner']},
        'developer': {'client': ['developer', 'owner'], 'counterparty': ['municipality', 'city', 'county']}
    }
    return party_map.get(representation.lower(), {'client': [], 'counterparty': []})


def check_affects_client(text: str, party_terms: Dict, representation: str) -> bool:
    """Check if a risk affects the client (vs counterparty)."""
    # Look for client party terms in context that suggests obligation/liability
    for term in party_terms.get('client', []):
        if re.search(rf'{term}\s+(?:shall|must|will|agrees?\s+to)', text, re.IGNORECASE):
            return True
        if re.search(rf'{term}[\'s]*\s+(?:liability|indemnif|obligation)', text, re.IGNORECASE):
            return True
    return False


def detect_opportunities(
    parsed_doc: Dict,
    contract_type: str,
    representation: str
) -> List[Dict]:
    """
    Detect opportunities to strengthen client position.

    Checks for missing protective concepts.
    """
    opportunities = []
    full_text = ' '.join([
        item.get('text', '') for item in parsed_doc.get('content', [])
        if item.get('type') == 'paragraph'
    ]).lower()

    # Get contract-specific opportunities
    skill = CONTRACT_SKILLS.get(contract_type, CONTRACT_SKILLS['general'])
    type_opportunities = skill.get('opportunities', [])

    # Protective concepts to check for
    protective_concepts = {
        'missing_as_is': {
            'search': r'as-?is|where-?is',
            'applies_to': ['seller', 'landlord', 'grantor'],
            'description': 'As-is/where-is clause not found',
            'recommendation': 'Add as-is acknowledgment with disclaimer of warranties'
        },
        'missing_knowledge_definition': {
            'search': r"(?:seller|landlord|grantor)'?s?\s+knowledge.*?(?:means|defined|shall\s+mean)",
            'applies_to': ['seller', 'landlord', 'grantor'],
            'description': 'Knowledge definition not found',
            'recommendation': 'Define knowledge as actual knowledge of designated representative'
        },
        'missing_liability_cap': {
            'search': r'(?:liability|aggregate).*?(?:shall\s+not\s+exceed|cap|maximum|limited\s+to)',
            'applies_to': ['seller', 'landlord', 'grantor', 'developer'],
            'description': 'Liability cap not found',
            'recommendation': 'Add aggregate liability cap'
        },
        'missing_survival_limit': {
            'search': r'survive.*?(?:\d+\s*(?:month|year|day)|\(.*?months?\))',
            'applies_to': ['seller', 'landlord', 'grantor'],
            'description': 'Survival period limit not found',
            'recommendation': 'Limit survival of representations to 9-12 months'
        },
        'missing_anti_sandbagging': {
            'search': r'sandbagging|knowledge.*?prior.*?closing.*?waive|knew.*?breach.*?proceed',
            'applies_to': ['seller', 'landlord', 'grantor'],
            'description': 'Anti-sandbagging provision not found',
            'recommendation': 'Add provision preventing claims for matters known pre-closing'
        },
        'missing_no_consequential': {
            'search': r'consequential\s+damages|punitive\s+damages|speculative\s+damages',
            'applies_to': ['seller', 'landlord', 'grantor', 'developer', 'borrower'],
            'description': 'Consequential damages exclusion not found',
            'recommendation': 'Exclude consequential, punitive, and speculative damages'
        },
        'missing_no_recourse': {
            'search': r'no\s+recourse|look\s+solely|recourse.*?limited',
            'applies_to': ['seller', 'landlord', 'grantor', 'developer'],
            'description': 'No recourse provision not found',
            'recommendation': 'Limit recourse to entity, no personal liability'
        },
        'missing_cure_period': {
            'search': r'(?:cure|notice\s+and\s+opportunity|right\s+to\s+cure).*?(?:default|breach)',
            'applies_to': ['seller', 'landlord', 'grantor', 'tenant', 'developer', 'borrower'],
            'description': 'Cure period for defaults not found',
            'recommendation': 'Add notice and cure period before default remedies'
        }
    }

    opp_id = 0
    for concept_key, config in protective_concepts.items():
        # Check if this applies to client's representation
        if representation.lower() not in config['applies_to']:
            continue

        # Check if concept exists
        if not re.search(config['search'], full_text, re.IGNORECASE):
            opp_id += 1
            opportunities.append({
                'opportunity_id': f'O{opp_id}',
                'type': concept_key,
                'description': config['description'],
                'recommendation': config['recommendation'],
                'priority': 'high' if 'liability' in concept_key or 'survival' in concept_key else 'medium'
            })

    return opportunities


def build_conceptual_map(parsed_doc: Dict) -> Dict:
    """
    Build a conceptual map of the document structure.

    Groups content by topic and shows relationships.
    """
    sections_by_topic = defaultdict(list)
    defined_terms = {}
    cross_references = []

    for item in parsed_doc.get('content', []):
        if item.get('type') != 'paragraph':
            continue

        text = item.get('text', '')
        para_id = item.get('id', '')
        section_ref = item.get('section_ref', '')

        # Categorize by topic
        topic = categorize_paragraph(text)
        if topic:
            sections_by_topic[topic].append({
                'para_id': para_id,
                'section_ref': section_ref,
                'excerpt': text[:100]
            })

        # Extract defined terms
        terms = extract_defined_terms(text)
        for term in terms:
            if term not in defined_terms:
                defined_terms[term] = {
                    'term': term,
                    'first_location': para_id,
                    'section_ref': section_ref
                }

        # Find cross-references
        refs = find_cross_references(text)
        for ref in refs:
            cross_references.append({
                'from_para': para_id,
                'reference': ref
            })

    return {
        'sections_by_topic': dict(sections_by_topic),
        'defined_terms': list(defined_terms.values()),
        'cross_references': cross_references
    }


def categorize_paragraph(text: str) -> Optional[str]:
    """Categorize a paragraph by its topic."""
    text_lower = text.lower()

    topics = {
        'representations': r'represent|warrant|certif',
        'indemnification': r'indemnif|hold\s+harmless',
        'default': r'default|breach|cure|remedies',
        'closing': r'closing|settlement|consummat',
        'price': r'purchase\s+price|consideration|payment',
        'due_diligence': r'due\s+diligence|inspection|feasibility',
        'title': r'title|survey|encumbrance',
        'conditions': r'condition\s+precedent|contingenc',
        'termination': r'terminat|cancel',
        'confidentiality': r'confidential|non-?disclosure',
        'notices': r'notice|notification',
        'assignment': r'assign|transfer',
        'miscellaneous': r'governing\s+law|jurisdiction|waiver|entire\s+agreement'
    }

    for topic, pattern in topics.items():
        if re.search(pattern, text_lower):
            return topic

    return None


def extract_defined_terms(text: str) -> List[str]:
    """Extract defined terms from text."""
    # Quoted terms that start with capital
    quoted = re.findall(r'"([A-Z][^"]+)"', text)
    # Terms in parentheses
    paren = re.findall(r'\((?:the\s+)?"([A-Z][^"]+)"\)', text)
    return list(set(quoted + paren))


def find_cross_references(text: str) -> List[str]:
    """Find cross-references to other sections."""
    refs = []
    # Section X.X references
    refs.extend(re.findall(r'Section\s+\d+(?:\.\d+)*', text, re.IGNORECASE))
    # Article references
    refs.extend(re.findall(r'Article\s+[IVXLCDM\d]+', text, re.IGNORECASE))
    # Exhibit references
    refs.extend(re.findall(r'Exhibit\s+[A-Z0-9]+', text, re.IGNORECASE))
    return refs


def analyze_document(
    parsed_doc: Dict,
    parsed_precedent: Optional[Dict],
    contract_type: str,
    representation: str,
    aggressiveness: int
) -> Dict:
    """
    Perform comprehensive document analysis.

    Returns full analysis including risks, opportunities, and conceptual map.
    """
    # Detect risks
    risks = detect_risks(parsed_doc, contract_type, representation)

    # Detect opportunities
    opportunities = detect_opportunities(parsed_doc, contract_type, representation)

    # Build conceptual map
    conceptual_map = build_conceptual_map(parsed_doc)

    # Build risk map keyed by paragraph
    risk_by_para = defaultdict(list)
    for risk in risks:
        risk_by_para[risk['para_id']].append(risk)

    # Count by severity
    severity_counts = defaultdict(int)
    for risk in risks:
        severity_counts[risk['severity']] += 1

    return {
        'analysis_date': datetime.now().isoformat(),
        'contract_type': contract_type,
        'contract_type_name': CONTRACT_SKILLS.get(contract_type, {}).get('name', 'Unknown'),
        'representation': representation,
        'aggressiveness': aggressiveness,
        'risk_inventory': risks,
        'risk_by_paragraph': dict(risk_by_para),
        'opportunities': opportunities,
        'conceptual_map': conceptual_map,
        'summary': {
            'total_risks': len(risks),
            'high_severity': severity_counts['high'],
            'medium_severity': severity_counts['medium'],
            'info_items': severity_counts['info'],
            'opportunities_count': len(opportunities),
            'sections_analyzed': len(parsed_doc.get('sections', [])),
            'paragraphs_analyzed': len([c for c in parsed_doc.get('content', []) if c.get('type') == 'paragraph'])
        }
    }


def generate_suggestions(
    revisions: Dict[str, Dict],
    flags: List[Dict],
    contract_type: str
) -> List[Dict]:
    """
    Generate improvement suggestions based on usage patterns.

    Analyzes user corrections and patterns to suggest improvements.
    """
    suggestions = []

    # Analyze revision patterns
    rejection_count = len([r for r in revisions.values() if not r.get('accepted')])
    acceptance_count = len([r for r in revisions.values() if r.get('accepted')])

    if rejection_count > acceptance_count and acceptance_count > 0:
        suggestions.append({
            'suggestion_id': 'S1',
            'type': 'calibration',
            'description': 'High rejection rate detected',
            'recommendation': 'Consider lowering aggressiveness level for more surgical edits',
            'auto_implement': False
        })

    # Check for common flag patterns
    if flags:
        flag_notes = ' '.join([f.get('note', '') for f in flags]).lower()
        if 'unclear' in flag_notes or 'discuss' in flag_notes:
            suggestions.append({
                'suggestion_id': 'S2',
                'type': 'clarity',
                'description': 'Multiple items flagged for discussion',
                'recommendation': 'Add more context in revision rationales',
                'auto_implement': True
            })

    return suggestions


def implement_improvement(suggestion_id: str) -> Dict:
    """
    Implement an approved improvement.

    Updates patterns or prompts based on the suggestion.
    """
    # This would update learned_patterns.json or prompt templates
    # For now, just log the improvement
    improvement_log = Path(__file__).parent.parent / 'data' / 'improvements.json'

    improvements = []
    if improvement_log.exists():
        with open(improvement_log, 'r') as f:
            improvements = json.load(f)

    improvements.append({
        'suggestion_id': suggestion_id,
        'implemented_at': datetime.now().isoformat()
    })

    improvement_log.parent.mkdir(parents=True, exist_ok=True)
    with open(improvement_log, 'w') as f:
        json.dump(improvements, f, indent=2)

    return {'status': 'implemented', 'suggestion_id': suggestion_id}
