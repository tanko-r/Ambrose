#!/usr/bin/env python3
"""
Phase 3: Section-by-Section Execution

Processes each section of the target document with full context awareness.
For each section, this script:
1. Builds the compacted context package
2. Prepares the target and precedent section text
3. Structures the output for revised content and deferred modifications

The actual LLM analysis is orchestrated by the redline.md command.
This script handles data preparation and result processing.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from copy import deepcopy


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class CompactedContextBuilder:
    """
    Builds the compacted context package for each section.

    The context includes:
    - Party identification
    - Relevant defined terms from both documents
    - Previous changes summary
    - Items already addressed elsewhere
    - Cross-references
    - Document-specific judgment framework
    """

    def __init__(self, analysis, plan):
        self.analysis = analysis
        self.plan = plan
        self.previous_changes = []  # Track changes made to previous sections
        self.addressed_items = set()  # Track concepts already addressed

    def build_for_section(self, section_id, section_plan):
        """
        Build compacted context for a specific section.
        """
        # Get section content
        section_content = self.analysis['section_content']['target'].get(section_id, [])
        section_text = ' '.join(p.get('text', '') for p in section_content).lower()

        # Find template section
        template_section_id = self._find_template_section(section_id)
        template_content = None
        if template_section_id:
            template_content = self.analysis['section_content']['template'].get(template_section_id, [])

        # Build context
        context = {
            'party_identification': self._build_party_context(),
            'defined_terms_target': self._get_relevant_terms(section_text, 'target'),
            'defined_terms_template': self._get_relevant_terms(section_text, 'template'),
            'other_relevant_terms': self._get_potentially_relevant_terms(section_id),
            'previous_changes_summary': self._summarize_previous_changes(),
            'items_already_addressed': list(self.addressed_items),
            'cross_references': self._find_cross_references(section_id),
            'judgment_framework': self.analysis.get('judgment_framework', {}),
            'section_risks': self._get_section_risks(section_id)
        }

        return context

    def _build_party_context(self):
        """Build party identification context."""
        parties = self.analysis.get('parties', {})
        client = parties.get('client', 'Seller')
        counterparty = parties.get('counterparty', 'Purchaser')

        return {
            'client': client,
            'counterparty': counterparty,
            'instruction': f"You represent {client.title()}. Protect {client.title()}'s interests. "
                          f"{counterparty.title()} is the counterparty."
        }

    def _get_relevant_terms(self, section_text, source):
        """Get defined terms that appear in or are relevant to this section."""
        terms = []
        term_list = self.analysis['defined_terms'].get(source, [])

        for term_data in term_list:
            term = term_data.get('term', '')
            if term.lower() in section_text:
                terms.append({
                    'term': term,
                    'definition': term_data.get('definition', ''),
                    'location': term_data.get('location', '')
                })

        return terms

    def _get_potentially_relevant_terms(self, section_id):
        """
        Get terms that might be relevant even if not directly mentioned.

        For example, if processing the Representations section, include
        terms like "Material Adverse Change", "Permitted Exceptions", etc.
        """
        potentially_relevant = []

        # Map sections to commonly relevant terms
        section_term_map = {
            'representation': ['Material Adverse', 'Permitted', 'Knowledge', 'Hazardous', 'Environmental'],
            'default': ['Default', 'Cure', 'Breach', 'Remedy', 'Termination'],
            'closing': ['Closing', 'Settlement', 'Escrow', 'Title', 'Deed'],
            'indemnif': ['Indemnif', 'Hold Harmless', 'Claim', 'Loss', 'Damage'],
        }

        section_lower = section_id.lower()
        relevant_keywords = []
        for key, terms in section_term_map.items():
            if key in section_lower:
                relevant_keywords.extend(terms)

        # Find matching terms
        for term_data in self.analysis['defined_terms'].get('target', []):
            term = term_data.get('term', '')
            if any(kw.lower() in term.lower() for kw in relevant_keywords):
                potentially_relevant.append({
                    'term': term,
                    'definition': term_data.get('definition', '')[:100] + '...'
                })

        return potentially_relevant[:10]  # Limit to avoid context bloat

    def _summarize_previous_changes(self):
        """
        Create narrative summary of changes made to previous sections.
        """
        if not self.previous_changes:
            return "No previous sections have been revised yet."

        summary_lines = []
        for change in self.previous_changes[-10:]:  # Last 10 changes
            summary_lines.append(
                f"- {change['section']}: {change['summary']}"
            )

        return '\n'.join(summary_lines)

    def _find_cross_references(self, section_id):
        """
        Find sections that reference or are referenced by this section.
        """
        cross_refs = {
            'referenced_by': [],
            'references': []
        }

        # Get section content
        section_content = self.analysis['section_content']['target'].get(section_id, [])
        section_text = ' '.join(p.get('text', '') for p in section_content)

        # Parse section number
        parts = section_id.split('_', 1)
        section_num = parts[0] if parts else ''

        # Check all other sections
        for other_id, other_content in self.analysis['section_content']['target'].items():
            if other_id == section_id:
                continue

            other_text = ' '.join(p.get('text', '') for p in other_content)
            other_parts = other_id.split('_', 1)
            other_num = other_parts[0] if other_parts else ''

            # Does this section reference the other?
            if other_num and f"Section {other_num}" in section_text:
                cross_refs['references'].append({
                    'section_id': other_id,
                    'section_num': other_num
                })

            # Does the other section reference this?
            if section_num and f"Section {section_num}" in other_text:
                cross_refs['referenced_by'].append({
                    'section_id': other_id,
                    'section_num': other_num
                })

        return cross_refs

    def _get_section_risks(self, section_id):
        """Get risks identified for this section."""
        section_content = self.analysis['section_content']['target'].get(section_id, [])
        para_ids = {p['id'] for p in section_content}

        risks = []
        for risk in self.analysis.get('risk_inventory', []):
            if risk.get('para_id') in para_ids:
                risks.append({
                    'risk_id': risk['risk_id'],
                    'type': risk['type'],
                    'severity': risk['severity'],
                    'description': risk['description']
                })

        return risks

    def _find_template_section(self, section_id):
        """Find the corresponding template section."""
        for mapping in self.analysis.get('section_map', []):
            target_sec = mapping.get('target_section', {})
            target_key = f"{target_sec.get('number', '')}_{target_sec.get('caption', '')}".strip('_')
            if target_key == section_id:
                template_sec = mapping.get('template_section')
                if template_sec:
                    return f"{template_sec.get('number', '')}_{template_sec.get('caption', '')}".strip('_')
        return None

    def record_change(self, section_id, change_summary, addressed_concepts=None):
        """Record a change made to a section."""
        self.previous_changes.append({
            'section': section_id,
            'summary': change_summary
        })

        if addressed_concepts:
            self.addressed_items.update(addressed_concepts)


class SectionProcessor:
    """
    Processes a single section for redlining.

    Prepares all data needed for LLM analysis.
    """

    def __init__(self, analysis, plan, context_builder):
        self.analysis = analysis
        self.plan = plan
        self.context_builder = context_builder

    def prepare_section(self, section_plan):
        """
        Prepare all data needed to process a section.

        Returns a structured package for LLM analysis.
        """
        section_id = section_plan['section_id']

        # Get full target section text
        target_content = self.analysis['section_content']['target'].get(section_id, [])
        target_text = self._format_section_text(target_content)

        # Get full template section text
        template_section_id = self._find_template_section(section_id)
        template_content = None
        template_text = None
        if template_section_id:
            template_content = self.analysis['section_content']['template'].get(template_section_id, [])
            template_text = self._format_section_text(template_content)

        # Build compacted context
        context = self.context_builder.build_for_section(section_id, section_plan)

        return {
            'section_id': section_id,
            'section_name': section_plan.get('section_name', section_id),
            'section_number': section_plan.get('section_number', ''),
            'strategy': section_plan.get('strategy', 'targeted_changes'),
            'target_section': {
                'paragraphs': target_content,
                'full_text': target_text
            },
            'template_section': {
                'section_id': template_section_id,
                'paragraphs': template_content,
                'full_text': template_text
            } if template_content else None,
            'compacted_context': context,
            'planned_changes': section_plan.get('changes', []),
            'risks': section_plan.get('risk_summary', {}).get('details', [])
        }

    def _format_section_text(self, paragraphs):
        """Format section paragraphs into readable text with IDs."""
        lines = []
        for para in paragraphs:
            para_id = para.get('id', '')
            text = para.get('text', '')
            if text:
                lines.append(f"[{para_id}] {text}")
        return '\n\n'.join(lines)

    def _find_template_section(self, section_id):
        """Find the corresponding template section."""
        for mapping in self.analysis.get('section_map', []):
            target_sec = mapping.get('target_section', {})
            target_key = f"{target_sec.get('number', '')}_{target_sec.get('caption', '')}".strip('_')
            if target_key == section_id:
                template_sec = mapping.get('template_section')
                if template_sec:
                    return f"{template_sec.get('number', '')}_{template_sec.get('caption', '')}".strip('_')
        return None


def build_llm_prompt_for_section(section_data):
    """
    Build the LLM prompt for processing a single section.

    This follows the analytical process:
    (a) Risk Analysis
    (b) Precedent Analysis
    (c) Surgical Incorporation
    (d) Independent Redlining
    (e) Generate Revised Text
    (f) Flag External Dependencies
    """
    prompt_parts = []

    # Header
    prompt_parts.append(f"""# Section Revision: {section_data['section_number']} {section_data['section_name']}

## Your Task

You are revising this section of a contract. Follow the analytical process below.

---

## Party Context

{section_data['compacted_context']['party_identification']['instruction']}

---

## Defined Terms

### From Target Document:
""")

    for term in section_data['compacted_context']['defined_terms_target'][:15]:
        prompt_parts.append(f"- **{term['term']}**: {term['definition'][:150]}...")

    prompt_parts.append("\n### From Template/Precedent Document:")
    for term in section_data['compacted_context']['defined_terms_template'][:15]:
        prompt_parts.append(f"- **{term['term']}**: {term['definition'][:150]}...")

    if section_data['compacted_context']['other_relevant_terms']:
        prompt_parts.append("\n### Other Potentially Relevant Terms:")
        for term in section_data['compacted_context']['other_relevant_terms']:
            prompt_parts.append(f"- **{term['term']}**: {term['definition']}")

    # Previous changes
    prompt_parts.append(f"""

---

## Previous Changes Summary

{section_data['compacted_context']['previous_changes_summary']}

---

## Items Already Addressed Elsewhere

Do NOT duplicate these concepts - they have already been addressed in other sections:
""")

    for item in section_data['compacted_context']['items_already_addressed']:
        prompt_parts.append(f"- {item}")

    # Cross-references
    if section_data['compacted_context']['cross_references']['referenced_by']:
        prompt_parts.append("\n## Cross-References\n\nThis section is referenced by:")
        for ref in section_data['compacted_context']['cross_references']['referenced_by']:
            prompt_parts.append(f"- Section {ref['section_num']}")

    if section_data['compacted_context']['cross_references']['references']:
        prompt_parts.append("\nThis section references:")
        for ref in section_data['compacted_context']['cross_references']['references']:
            prompt_parts.append(f"- Section {ref['section_num']}")

    # Judgment framework
    prompt_parts.append(f"""

---

## Judgment Framework

### Always Change:
""")
    for item in section_data['compacted_context']['judgment_framework'].get('always_change', []):
        prompt_parts.append(f"- {item}")

    prompt_parts.append("\n### Preserve:")
    for item in section_data['compacted_context']['judgment_framework'].get('preserve', []):
        prompt_parts.append(f"- {item}")

    # Identified risks
    if section_data['risks']:
        prompt_parts.append("\n---\n\n## Risks Identified in This Section\n")
        for risk in section_data['risks']:
            prompt_parts.append(f"- [{risk['risk_id']}] **{risk['type']}** ({risk['severity']}): {risk['description']}")

    # Target section text
    prompt_parts.append(f"""

---

## TARGET SECTION TEXT (to be revised)

```
{section_data['target_section']['full_text']}
```

---

""")

    # Template section text
    if section_data['template_section']:
        prompt_parts.append(f"""## TEMPLATE/PRECEDENT SECTION TEXT (reference)

```
{section_data['template_section']['full_text']}
```

---

""")

    # Instructions
    prompt_parts.append("""## Analytical Process

Follow these steps IN ORDER:

### (a) Risk Analysis
Analyze the target language for risks to the client party. Identify specific provisions, obligations, or omissions that expose the client to liability, loss, or disadvantage.

### (b) Precedent Analysis
Analyze the template/precedent language for how those identified risks are addressed. Note the specific protective mechanisms, qualifications, or limitations used.

### (c) Surgical Incorporation
Where precedent language addresses a risk, incorporate similar protective language into the target in a surgical fashion - preserving the target's structure and style while adding necessary protections.

### (d) Independent Redlining
Where risks are NOT addressed in precedent, implement appropriate client-protective redlines using sound legal judgment and standard protective drafting techniques.

### (e) Generate Revised Text
Produce the full revised text of the section. For each paragraph:
- If NO CHANGE, output: `[paragraph_id]: NO CHANGE`
- If CHANGED, output the full revised text with a brief rationale

### (f) Flag External Dependencies
If any changes require modifications OUTSIDE this section (new defined terms, cross-reference updates, conforming changes elsewhere), list them.

---

## Output Format

Structure your response as:

```json
{
  "section_id": "[section_id]",
  "analysis": {
    "risks_identified": ["list of risks found"],
    "precedent_solutions": ["how template addresses these"],
    "strategy_applied": "description of approach"
  },
  "revised_paragraphs": [
    {
      "paragraph_id": "p_XX",
      "status": "changed" | "no_change",
      "revised_text": "full revised text if changed",
      "changes_made": ["list of changes"],
      "rationale": "why this change"
    }
  ],
  "deferred_modifications": [
    {
      "target_location": "where change is needed",
      "type": "add_definition | conforming_change | cross_reference",
      "description": "what needs to change",
      "priority": "required | recommended"
    }
  ]
}
```

IMPORTANT:
- Preserve all language that is acceptable - do not change things unnecessarily
- Match the target document's drafting style
- Do not add concepts that exist elsewhere (see "Items Already Addressed")
- Do not remove helpful detail from the target
""")

    return '\n'.join(prompt_parts)


class DeferredModificationTracker:
    """
    Tracks modifications needed outside the current section.
    """

    def __init__(self):
        self.modifications = []

    def add(self, triggered_by, target_location, mod_type, description, priority='recommended'):
        """Add a deferred modification."""
        self.modifications.append({
            'triggered_by_section': triggered_by,
            'target_location': target_location,
            'type': mod_type,
            'description': description,
            'priority': priority
        })

    def get_all(self):
        """Get all deferred modifications."""
        return self.modifications

    def save(self, output_path):
        """Save deferred modifications to JSON."""
        data = {
            'generated': datetime.now().isoformat(),
            'modifications': self.modifications
        }
        save_json(data, output_path)


def process_all_sections(analysis, plan, output_dir):
    """
    Process all sections and generate execution packages.

    This prepares everything for the LLM to process each section.
    """
    context_builder = CompactedContextBuilder(analysis, plan)
    processor = SectionProcessor(analysis, plan, context_builder)
    deferred_tracker = DeferredModificationTracker()

    execution_packages = []

    for section_plan in plan.get('sections', []):
        section_id = section_plan['section_id']
        print(f"Preparing section: {section_id}")

        # Prepare section data
        section_data = processor.prepare_section(section_plan)

        # Build LLM prompt
        llm_prompt = build_llm_prompt_for_section(section_data)

        execution_packages.append({
            'section_id': section_id,
            'section_name': section_plan.get('section_name', ''),
            'strategy': section_plan.get('strategy', ''),
            'section_data': section_data,
            'llm_prompt': llm_prompt
        })

    return execution_packages, deferred_tracker


def main():
    """
    Main entry point for section processing.

    Usage:
        python redline_section.py <analysis.json> <redline_plan.json> <output_dir>

    Or for a single section:
        python redline_section.py <analysis.json> <redline_plan.json> <output_dir> --section "section_id"
    """
    if len(sys.argv) < 4:
        print("Usage: python redline_section.py <analysis.json> <redline_plan.json> <output_dir> [--section section_id]")
        sys.exit(1)

    analysis_path = Path(sys.argv[1])
    plan_path = Path(sys.argv[2])
    output_dir = Path(sys.argv[3])

    # Check for single section mode
    single_section = None
    if '--section' in sys.argv:
        idx = sys.argv.index('--section')
        if idx + 1 < len(sys.argv):
            single_section = sys.argv[idx + 1]

    # Load data
    print(f"Loading analysis: {analysis_path}")
    analysis = load_json(analysis_path)

    print(f"Loading plan: {plan_path}")
    plan = load_json(plan_path)

    output_dir.mkdir(parents=True, exist_ok=True)

    print("\n=== Phase 3: Section Execution Preparation ===\n")

    # Process sections
    execution_packages, deferred_tracker = process_all_sections(analysis, plan, output_dir)

    # Filter to single section if specified
    if single_section:
        execution_packages = [p for p in execution_packages if p['section_id'] == single_section]
        if not execution_packages:
            print(f"Section not found: {single_section}")
            sys.exit(1)

    # Save execution packages
    for package in execution_packages:
        section_id = package['section_id']
        safe_id = section_id.replace(' ', '_').replace('/', '_')

        # Save section data
        data_path = output_dir / f'section_{safe_id}_data.json'
        save_json(package['section_data'], data_path)

        # Save LLM prompt
        prompt_path = output_dir / f'section_{safe_id}_prompt.md'
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(package['llm_prompt'])

        print(f"Prepared: {section_id}")
        print(f"  Data: {data_path}")
        print(f"  Prompt: {prompt_path}")

    # Save master execution list
    execution_list = {
        'generated': datetime.now().isoformat(),
        'total_sections': len(execution_packages),
        'sections': [
            {
                'section_id': p['section_id'],
                'section_name': p['section_name'],
                'strategy': p['strategy'],
                'data_file': f"section_{p['section_id'].replace(' ', '_').replace('/', '_')}_data.json",
                'prompt_file': f"section_{p['section_id'].replace(' ', '_').replace('/', '_')}_prompt.md"
            }
            for p in execution_packages
        ]
    }
    save_json(execution_list, output_dir / 'execution_list.json')

    print(f"\n=== Preparation Complete ===")
    print(f"Total sections prepared: {len(execution_packages)}")
    print(f"Execution list: {output_dir / 'execution_list.json'}")

    return execution_packages


if __name__ == "__main__":
    main()
