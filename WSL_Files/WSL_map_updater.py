# app/services/map_updater.py
"""
Detect concept changes in revisions and update maps accordingly.

When a user accepts a revision, this service:
1. Detects what legal concepts were added/modified/removed
2. Updates the concept map with new provisions
3. Updates the risk map to reflect changed relationships
4. Returns affected paragraph IDs for potential re-analysis
"""

import re
from typing import Dict, List, Any, Tuple
from datetime import datetime

# Patterns to detect concept changes in legal text
CONCEPT_PATTERNS = {
    'basket': [
        r'exceed(?:ing|s)?\s+\$?([\d,]+)',
        r'aggregate.*\$?([\d,]+)',
        r'basket.*\$?([\d,]+)',
        r'threshold.*\$?([\d,]+)',
        r'deductible.*\$?([\d,]+)'
    ],
    'cap': [
        r'(?:cap|maximum|limit).*\$?([\d,]+)',
        r'not.*exceed.*\$?([\d,]+)',
        r'liability.*limited.*\$?([\d,]+)',
        r'in\s+no\s+event.*exceed.*\$?([\d,]+)'
    ],
    'survival': [
        r'surviv(?:e|al).*?(\d+)\s*(?:month|year)',
        r'(\d+)\s*(?:month|year).*surviv',
        r'(?:period|term).*?(\d+)\s*(?:month|year).*(?:after|following)',
    ],
    'cure_period': [
        r'(\d+)\s*(?:day|business day)s?.*(?:to\s+)?(?:cure|remedy)',
        r'cure.*?(\d+)\s*(?:day|business day)',
        r'notice.*?(\d+)\s*(?:day|business day)',
        r'(\d+)\s*(?:day|business day)s?\s+(?:notice|period)'
    ],
    'termination': [
        r'terminat(?:e|ion)',
        r'cancel(?:lation)?',
        r'rescind',
        r'right\s+to\s+(?:terminate|cancel)'
    ],
    'knowledge': [
        r"(?:to\s+)?(?:\w+['s]*\s+)?knowledge",
        r'actual\s+knowledge',
        r'knowledge.*(?:of|means)',
        r'constructive\s+knowledge'
    ]
}


def detect_concept_changes(original: str, revised: str) -> List[Dict[str, Any]]:
    """
    Detect what concepts were added/modified/removed in a revision.

    Args:
        original: The original clause text
        revised: The revised clause text

    Returns:
        List of change dictionaries with:
        - type: concept type (basket, cap, survival, etc.)
        - action: 'added', 'modified', or 'removed'
        - value: the matched value (for added/removed)
        - old_value/new_value: for modifications
    """
    changes = []
    seen_types = set()  # Track which types we've already added to avoid duplicates

    for concept_type, patterns in CONCEPT_PATTERNS.items():
        for pattern in patterns:
            revised_matches = re.findall(pattern, revised, re.IGNORECASE)
            original_matches = re.findall(pattern, original, re.IGNORECASE)

            # Deduplicate and normalize matches
            revised_set = set(str(m).strip() for m in revised_matches if m)
            original_set = set(str(m).strip() for m in original_matches if m)

            # Concept added (in revised but not in original)
            if revised_set and not original_set:
                if concept_type not in seen_types:
                    value = list(revised_set)[0] if revised_set else ''
                    changes.append({
                        'type': concept_type,
                        'action': 'added',
                        'value': value
                    })
                    seen_types.add(concept_type)

            # Concept modified (in both but different values)
            elif revised_set and original_set and revised_set != original_set:
                if concept_type not in seen_types:
                    changes.append({
                        'type': concept_type,
                        'action': 'modified',
                        'old_value': list(original_set)[0],
                        'new_value': list(revised_set)[0]
                    })
                    seen_types.add(concept_type)

            # Concept removed (in original but not in revised)
            elif original_set and not revised_set:
                if concept_type not in seen_types:
                    changes.append({
                        'type': concept_type,
                        'action': 'removed',
                        'value': list(original_set)[0]
                    })
                    seen_types.add(concept_type)

    return changes


def update_maps_on_revision(
    concept_map: Dict[str, Any],
    risk_map: Dict[str, Any],
    changes: List[Dict[str, Any]],
    para_id: str,
    section_ref: str
) -> Tuple[Dict, Dict, List[str]]:
    """
    Update concept map and risk map based on detected changes.

    Args:
        concept_map: Current concept map dictionary
        risk_map: Current risk map dictionary
        changes: List of detected changes from detect_concept_changes
        para_id: Paragraph ID where revision was accepted
        section_ref: Section reference (e.g., '5.3')

    Returns:
        Tuple of (updated_concept_map, updated_risk_map, affected_para_ids)
    """
    from app.models import ConceptMap, RiskMap

    # Convert dictionaries to model instances
    cm = ConceptMap.from_dict(concept_map)
    rm = RiskMap.from_dict(risk_map)
    affected_para_ids = []

    # Map concept types to categories
    type_to_category = {
        'basket': 'liability_limitations',
        'cap': 'liability_limitations',
        'survival': 'liability_limitations',
        'cure_period': 'default_remedies',
        'termination': 'termination_triggers',
        'knowledge': 'knowledge_standards'
    }

    for change in changes:
        concept_type = change['type']
        category = type_to_category.get(concept_type, 'other')

        if change['action'] == 'added':
            cm.add_provision(
                category=category,
                key=concept_type,
                value=change.get('value', ''),
                section=section_ref
            )
        elif change['action'] == 'modified':
            cm.add_provision(
                category=category,
                key=concept_type,
                value=change.get('new_value', ''),
                section=section_ref
            )
        elif change['action'] == 'removed':
            # Mark provision as removed rather than deleting
            if category in cm.concepts and concept_type in cm.concepts[category]:
                cm.concepts[category][concept_type]['removed'] = True

        # Find risks affected by this provision change
        provision_ref = f"{section_ref}:{concept_type}"
        affected_risks = rm.get_affected_risks(provision_ref)
        for risk in affected_risks:
            if risk.para_id not in affected_para_ids:
                affected_para_ids.append(risk.para_id)

    # Recalculate risk severities after changes
    rm.recalculate_all_severities()

    # Record change in history
    rm.change_history.append({
        'change_id': f"chg_{len(rm.change_history)+1}",
        'timestamp': datetime.now().isoformat(),
        'para_id': para_id,
        'section': section_ref,
        'changes': changes,
        'affected_para_ids': affected_para_ids
    })

    return cm.to_dict(), rm.to_dict(), affected_para_ids


def get_change_summary(changes: List[Dict[str, Any]]) -> str:
    """
    Generate a human-readable summary of concept changes.

    Args:
        changes: List of change dictionaries

    Returns:
        String summary of changes
    """
    if not changes:
        return "No concept changes detected."

    summaries = []
    for change in changes:
        concept_type = change['type'].replace('_', ' ').title()
        action = change['action']

        if action == 'added':
            value = change.get('value', '')
            summaries.append(f"Added {concept_type}: {value}" if value else f"Added {concept_type}")
        elif action == 'modified':
            old_val = change.get('old_value', '?')
            new_val = change.get('new_value', '?')
            summaries.append(f"Modified {concept_type}: {old_val} -> {new_val}")
        elif action == 'removed':
            value = change.get('value', '')
            summaries.append(f"Removed {concept_type}: {value}" if value else f"Removed {concept_type}")

    return "; ".join(summaries)
