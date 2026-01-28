#!/usr/bin/env python3
"""
Phase 2: Redline Planning

Takes the analysis from Phase 1 and generates a structured redline plan
for each section. The plan is presented to the user for review and approval
before Phase 3 execution begins.

This script structures the data; the actual plan generation is done by
the LLM via the redline.md command.
"""

import json
import sys
from pathlib import Path
from datetime import datetime


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def build_section_context(section_key, analysis):
    """
    Build context package for a section to assist LLM planning.
    """
    section_content = analysis['section_content']['target'].get(section_key, [])

    # Find corresponding template section
    template_section = None
    for mapping in analysis.get('section_map', []):
        target_sec = mapping.get('target_section', {})
        if f"{target_sec.get('number', '')}_{target_sec.get('caption', '')}".strip('_') == section_key:
            template_sec = mapping.get('template_section')
            if template_sec:
                tmpl_key = f"{template_sec.get('number', '')}_{template_sec.get('caption', '')}".strip('_')
                template_section = analysis['section_content']['template'].get(tmpl_key, [])
            break

    # Find risks in this section
    section_risks = []
    para_ids = {p['id'] for p in section_content}
    for risk in analysis.get('risk_inventory', []):
        if risk.get('para_id') in para_ids:
            section_risks.append(risk)

    # Find relevant defined terms
    relevant_terms = []
    section_text = ' '.join(p.get('text', '') for p in section_content).lower()
    for term_data in analysis['defined_terms']['target']:
        term = term_data.get('term', '')
        if term.lower() in section_text:
            relevant_terms.append(term_data)

    return {
        'section_key': section_key,
        'target_content': section_content,
        'template_content': template_section,
        'risks_in_section': section_risks,
        'relevant_defined_terms': relevant_terms,
        'paragraph_count': len(section_content)
    }


def categorize_sections(analysis):
    """
    Categorize sections by risk level and complexity.
    """
    section_categories = {
        'high_priority': [],     # Many risks, needs heavy revision
        'medium_priority': [],   # Some risks, needs targeted changes
        'low_priority': [],      # Few/no risks, mostly preserve
        'insertions': []         # New sections to add
    }

    section_content = analysis['section_content']['target']

    for section_key in section_content.keys():
        context = build_section_context(section_key, analysis)

        # Count risks by severity
        high_risks = len([r for r in context['risks_in_section'] if r['severity'] == 'high'])
        medium_risks = len([r for r in context['risks_in_section'] if r['severity'] == 'medium'])
        total_risks = high_risks + medium_risks

        # Categorize
        if high_risks >= 3 or total_risks >= 5:
            section_categories['high_priority'].append({
                'section_key': section_key,
                'risk_count': total_risks,
                'high_risk_count': high_risks,
                'strategy': 'heavy_revision',
                'context': context
            })
        elif high_risks >= 1 or total_risks >= 2:
            section_categories['medium_priority'].append({
                'section_key': section_key,
                'risk_count': total_risks,
                'high_risk_count': high_risks,
                'strategy': 'targeted_changes',
                'context': context
            })
        else:
            section_categories['low_priority'].append({
                'section_key': section_key,
                'risk_count': total_risks,
                'high_risk_count': high_risks,
                'strategy': 'preserve_mostly',
                'context': context
            })

    # Add insertions from gaps
    for gap in analysis.get('missing_from_target', []):
        section_categories['insertions'].append({
            'concept': gap['concept'],
            'description': gap['description'],
            'template_location': gap.get('template_location'),
            'recommended_insertion': gap.get('recommended_insertion')
        })

    return section_categories


def generate_plan_structure(analysis):
    """
    Generate the structure for the redline plan.

    The actual change specifications will be filled in by the LLM,
    but this provides the framework.
    """
    categories = categorize_sections(analysis)

    # Build section plans
    section_plans = []

    # Process all sections in document order
    all_sections = []
    for priority in ['high_priority', 'medium_priority', 'low_priority']:
        all_sections.extend(categories[priority])

    # Sort by section number (attempt to parse)
    def section_sort_key(item):
        key = item['section_key']
        # Extract leading number
        import re
        match = re.match(r'^(\d+)', key)
        if match:
            return int(match.group(1))
        return 999

    all_sections.sort(key=section_sort_key)

    for section_info in all_sections:
        section_key = section_info['section_key']
        context = section_info['context']

        # Parse section name
        parts = section_key.split('_', 1)
        section_number = parts[0] if parts else ''
        section_name = parts[1] if len(parts) > 1 else section_key

        plan = {
            'section_id': section_key,
            'section_number': section_number,
            'section_name': section_name,
            'strategy': section_info['strategy'],
            'risk_summary': {
                'total': section_info['risk_count'],
                'high': section_info['high_risk_count'],
                'details': [
                    {
                        'risk_id': r['risk_id'],
                        'type': r['type'],
                        'severity': r['severity'],
                        'description': r['description'],
                        'excerpt': r['excerpt'][:100] + '...' if len(r.get('excerpt', '')) > 100 else r.get('excerpt', '')
                    }
                    for r in context['risks_in_section']
                ]
            },
            'paragraph_ids': [p['id'] for p in context['target_content']],
            'has_template_match': context['template_content'] is not None,
            # Placeholder for LLM-generated changes
            'changes': [],
            'preserve': [],
            'dependencies': []
        }
        section_plans.append(plan)

    # Build insertion plans
    insertion_plans = []
    for insertion in categories['insertions']:
        insertion_plans.append({
            'concept': insertion['concept'],
            'description': insertion['description'],
            'template_source': insertion.get('template_location', 'Template'),
            'insert_location': insertion.get('recommended_insertion', 'Appropriate section'),
            'rationale': f"Missing protective concept: {insertion['description']}"
        })

    return {
        'sections': section_plans,
        'insertions': insertion_plans
    }


def format_plan_for_display(plan, analysis):
    """
    Format the plan as markdown for user review.
    """
    lines = [
        "# Redline Plan",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Summary",
        "",
        f"- **Total Sections**: {len(plan['sections'])}",
        f"- **High Priority**: {len([s for s in plan['sections'] if s['strategy'] == 'heavy_revision'])}",
        f"- **Medium Priority**: {len([s for s in plan['sections'] if s['strategy'] == 'targeted_changes'])}",
        f"- **Low Priority**: {len([s for s in plan['sections'] if s['strategy'] == 'preserve_mostly'])}",
        f"- **New Insertions**: {len(plan['insertions'])}",
        "",
        "---",
        "",
        "## Section-by-Section Plan",
        ""
    ]

    for section in plan['sections']:
        strategy_display = {
            'heavy_revision': '🔴 Heavy Revision',
            'targeted_changes': '🟡 Targeted Changes',
            'preserve_mostly': '🟢 Preserve Mostly'
        }.get(section['strategy'], section['strategy'])

        lines.append(f"### {section['section_number']} {section['section_name']}")
        lines.append("")
        lines.append(f"**Strategy**: {strategy_display}")
        lines.append(f"**Paragraphs**: {len(section['paragraph_ids'])}")
        lines.append(f"**Template Match**: {'Yes' if section['has_template_match'] else 'No'}")
        lines.append("")

        if section['risk_summary']['total'] > 0:
            lines.append("**Risks Identified:**")
            for risk in section['risk_summary']['details']:
                severity_icon = '⚠️' if risk['severity'] == 'high' else '⚡'
                lines.append(f"- {severity_icon} [{risk['risk_id']}] {risk['description']}")
            lines.append("")

        if section['changes']:
            lines.append("**Planned Changes:**")
            for change in section['changes']:
                lines.append(f"- {change.get('type', 'change')}: {change.get('description', 'TBD')}")
            lines.append("")

        if section['preserve']:
            lines.append("**Preserve:**")
            for preserve in section['preserve']:
                lines.append(f"- {preserve}")
            lines.append("")

        lines.append("---")
        lines.append("")

    if plan['insertions']:
        lines.append("## New Sections to Insert")
        lines.append("")
        for insertion in plan['insertions']:
            lines.append(f"### {insertion['concept']}")
            lines.append(f"**Description**: {insertion['description']}")
            lines.append(f"**Source**: {insertion['template_source']}")
            lines.append(f"**Insert At**: {insertion['insert_location']}")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Approval")
    lines.append("")
    lines.append("Please review this plan. You may:")
    lines.append("- **Approve** as-is")
    lines.append("- **Modify** specific planned changes")
    lines.append("- **Add** additional instructions")
    lines.append("- **Skip** certain changes entirely")
    lines.append("")

    return '\n'.join(lines)


def build_llm_prompt_context(analysis, plan):
    """
    Build context for LLM to generate detailed change specifications.

    This is used by the redline.md command to prompt the LLM.
    """
    context = {
        'parties': analysis.get('parties', {}),
        'judgment_framework': analysis.get('judgment_framework', {}),
        'total_risks': len(analysis.get('risk_inventory', [])),
        'risk_categories': {},
        'section_summaries': []
    }

    # Group risks by category
    for risk in analysis.get('risk_inventory', []):
        category = risk.get('category', 'other')
        if category not in context['risk_categories']:
            context['risk_categories'][category] = []
        context['risk_categories'][category].append(risk['risk_id'])

    # Section summaries
    for section in plan['sections']:
        context['section_summaries'].append({
            'id': section['section_id'],
            'name': section['section_name'],
            'strategy': section['strategy'],
            'risk_count': section['risk_summary']['total']
        })

    return context


def main():
    """
    Main entry point for plan generation.

    Usage:
        python generate_plan.py <analysis.json> <output_dir>
    """
    if len(sys.argv) < 3:
        print("Usage: python generate_plan.py <analysis.json> <output_dir>")
        sys.exit(1)

    analysis_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    # Load analysis
    print(f"Loading analysis: {analysis_path}")
    analysis = load_json(analysis_path)

    # Generate plan structure
    print("\n=== Phase 2: Generating Redline Plan ===\n")

    plan = generate_plan_structure(analysis)

    # Save plan JSON
    plan_output = {
        'plan_date': datetime.now().isoformat(),
        'source_analysis': str(analysis_path),
        'parties': analysis.get('parties', {}),
        'judgment_framework': analysis.get('judgment_framework', {}),
        **plan,
        'llm_context': build_llm_prompt_context(analysis, plan)
    }

    plan_path = output_dir / 'redline_plan.json'
    save_json(plan_output, plan_path)
    print(f"Plan JSON saved to: {plan_path}")

    # Generate markdown for review
    plan_md = format_plan_for_display(plan, analysis)
    plan_md_path = output_dir / 'redline_plan.md'
    with open(plan_md_path, 'w', encoding='utf-8') as f:
        f.write(plan_md)
    print(f"Plan markdown saved to: {plan_md_path}")

    # Print summary
    print("\n--- Plan Summary ---")
    high_count = len([s for s in plan['sections'] if s['strategy'] == 'heavy_revision'])
    medium_count = len([s for s in plan['sections'] if s['strategy'] == 'targeted_changes'])
    low_count = len([s for s in plan['sections'] if s['strategy'] == 'preserve_mostly'])

    print(f"Total sections: {len(plan['sections'])}")
    print(f"  High priority (heavy revision): {high_count}")
    print(f"  Medium priority (targeted): {medium_count}")
    print(f"  Low priority (preserve): {low_count}")
    print(f"New insertions planned: {len(plan['insertions'])}")

    print("\n=== Plan generated - awaiting user review ===")

    return plan_output


if __name__ == "__main__":
    main()
