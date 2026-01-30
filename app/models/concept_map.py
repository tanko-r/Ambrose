"""
Concept Map: Document-wide provisions grouped by legal concept.

Categories:
- liability_limitations: baskets, caps, survival periods, deductibles
- knowledge_standards: knowledge definitions, who they apply to
- termination_triggers: events allowing/requiring termination
- default_remedies: cure periods, notice requirements, auto vs elective
- defined_terms: MAE, Permitted Exceptions, etc.
"""

from typing import Dict, Any, Optional


class ConceptMap:
    """Document-wide concept map with provisions grouped by category."""

    VALID_CATEGORIES = [
        'liability_limitations',
        'knowledge_standards',
        'termination_triggers',
        'default_remedies',
        'defined_terms'
    ]

    def __init__(self):
        self.concepts: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def add_provision(
        self,
        category: str,
        key: str,
        value: str,
        section: str,
        **kwargs
    ) -> None:
        """Add a provision to the concept map."""
        if category not in self.concepts:
            self.concepts[category] = {}

        self.concepts[category][key] = {
            'value': value,
            'section': section,
            **kwargs
        }

    def get_provision(self, category: str, key: str) -> Optional[Dict[str, Any]]:
        """Get a specific provision."""
        return self.concepts.get(category, {}).get(key)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary for JSON storage."""
        return {'concepts': self.concepts}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConceptMap':
        """Deserialize from dictionary."""
        cm = cls()
        cm.concepts = data.get('concepts', {})
        return cm

    def to_prompt_format(self) -> str:
        """Format concept map for inclusion in LLM prompt."""
        lines = []

        category_titles = {
            'liability_limitations': 'LIABILITY LIMITATIONS',
            'knowledge_standards': 'KNOWLEDGE STANDARDS',
            'termination_triggers': 'TERMINATION TRIGGERS',
            'default_remedies': 'DEFAULT REMEDIES',
            'defined_terms': 'KEY DEFINED TERMS'
        }

        for category, provisions in self.concepts.items():
            if not provisions:
                continue
            title = category_titles.get(category, category.upper())
            lines.append(f"{title}:")

            for key, details in provisions.items():
                section = details.get('section', '?')
                value = details.get('value', '')
                extras = []
                for k, v in details.items():
                    if k not in ('value', 'section') and v:
                        extras.append(f"{k}: {v}")
                extra_str = f" ({', '.join(extras)})" if extras else ""
                lines.append(f"  - {key}: {value} (Section {section}){extra_str}")

            lines.append("")

        return "\n".join(lines)
