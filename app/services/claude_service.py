#!/usr/bin/env python3
"""
Claude Service for Intelligent Risk Analysis

Uses Claude Opus 4.5 (thinking model) to perform deep contract analysis,
identifying risks, opportunities, and providing nuanced legal insights.
"""

import os
import json
import re
import time
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from app.services.content_filter import ContentFilter
from app.services.initial_analyzer import run_initial_analysis
from app.services.parallel_analyzer import run_forked_parallel_analysis

# Global progress tracker for analysis jobs
# Key: session_id, Value: progress dict
analysis_progress = {}
progress_lock = threading.Lock()

# Global partial results tracker for incremental risk display
# Key: session_id, Value: list of risks found so far
partial_results = {}
partial_results_lock = threading.Lock()


def update_progress(session_id: str, data: Dict):
    """Update progress for a session."""
    with progress_lock:
        if session_id not in analysis_progress:
            analysis_progress[session_id] = {}
        analysis_progress[session_id].update(data)
        analysis_progress[session_id]['updated_at'] = time.time()


def get_progress(session_id: str) -> Optional[Dict]:
    """Get progress for a session."""
    with progress_lock:
        return analysis_progress.get(session_id, {}).copy()


def clear_progress(session_id: str):
    """Clear progress for a session."""
    with progress_lock:
        if session_id in analysis_progress:
            del analysis_progress[session_id]


def add_partial_risks(session_id: str, risks: List[Dict]):
    """Add risks from a completed batch to partial results."""
    with partial_results_lock:
        if session_id not in partial_results:
            partial_results[session_id] = []
        partial_results[session_id].extend(risks)


def get_partial_risks(session_id: str) -> List[Dict]:
    """Get all risks found so far for a session."""
    with partial_results_lock:
        return partial_results.get(session_id, []).copy()


def clear_partial_risks(session_id: str):
    """Clear partial risks for a session."""
    with partial_results_lock:
        if session_id in partial_results:
            del partial_results[session_id]

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Try to import Anthropic SDK
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


def get_anthropic_api_key() -> Optional[str]:
    """Get Anthropic API key from various sources."""
    # Try environment variables
    key = os.getenv("ANTHROPIC_API_KEY")
    if key:
        return key

    # Try key files
    key_paths = [
        Path(__file__).parent.parent.parent / 'anthropic_api.txt',
        Path(__file__).parent.parent.parent / '.env',
        Path.home() / '.anthropic_api_key'
    ]

    for path in key_paths:
        if path.exists():
            content = path.read_text().strip()
            if path.suffix == '.txt':
                return content
            # Parse .env format
            for line in content.split('\n'):
                if line.startswith('ANTHROPIC_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"\'')

    return None


def build_risk_analysis_prompt(
    contract_type: str,
    representation: str,
    aggressiveness: int
) -> str:
    """Build the system prompt for risk analysis."""

    party_context = {
        'seller': 'You represent the SELLER. Identify risks that could harm the seller, such as broad representations, unlimited liability, vague conditions that benefit the buyer, etc, as well as opportunities to strengthen the seller position.',
        'buyer': 'You represent the BUYER/PURCHASER. Identify risks that could harm the buyer, such as weak warranties, limited remedies, seller-favorable termination rights, etc., as well as opportunities to strengthen the buyer position generally.',
        'landlord': 'You represent the LANDLORD. Identify risks such as tenant-favorable terms, broad use rights, weak default provisions, etc.',
        'tenant': 'You represent the TENANT. Identify risks such as excessive landlord rights, harsh default terms, rent increase exposure, etc.',
        'lender': 'You represent the LENDER. Identify risks to loan security, weak covenants, borrower-favorable cure periods, etc.',
        'borrower': 'You represent the BORROWER. Identify risks such as aggressive default triggers, cross-default provisions, excessive lender discretion, etc.',
        'grantor': 'You represent the GRANTOR (property owner granting an easement). Identify risks such as overly broad easement scope, expansion rights, insufficient compensation, etc.',
        'grantee': 'You represent the GRANTEE (easement holder). Identify risks such as narrow easement scope, revocation rights, excessive restrictions, etc.',
        'developer': 'You represent the DEVELOPER. Identify risks such as unrealistic deadlines, excessive bonding requirements, subjective approval standards, etc.'
    }.get(representation.lower(), f'You represent the {representation.upper()}.')

    contract_context = {
        'psa': 'This is a Purchase and Sale Agreement (PSA) for real estate. Key areas include: deposit terms, due diligence period, title/survey review, representations & warranties, closing conditions, default remedies, survival periods, and liability caps.',
        'lease': 'This is a Lease Agreement. Key areas include: rent terms, use restrictions, maintenance obligations, assignment/subletting, default/cure provisions, indemnification, insurance requirements, and termination rights.',
        'easement': 'This is an Easement Agreement. Key areas include: easement scope/purpose, duration, maintenance obligations, relocation rights, expansion limitations, and termination conditions.',
        'development': 'This is a Development Agreement. Key areas include: development timeline, approval standards, performance security, force majeure, phasing requirements, and completion obligations.',
        'loan': 'This is a Loan Agreement. Key areas include: interest rate, payment terms, covenants, default triggers, remedies, cross-default provisions, and prepayment terms.'
    }.get(contract_type, 'This is a legal contract.')

    aggressiveness_context = {
        1: 'Be conservative. Only flag clearly problematic provisions that pose significant risk. Assume market-standard terms are acceptable.',
        2: 'Be moderately conservative. Flag provisions that are materially unfavorable but accept reasonable market terms.',
        3: 'Be balanced. Flag provisions that could be improved while recognizing legitimate business terms.',
        4: 'Be thorough. Flag any provision that could be strengthened in your client\'s favor, even if currently market-standard.',
        5: 'Be aggressive. Flag every provision that is not maximally favorable to your client. Identify all opportunities to strengthen position.'
    }.get(aggressiveness, 'Be balanced in your analysis.')

    return f"""You are an expert real estate attorney performing a detailed risk analysis of contract language with the skill and judgment of a senior partner.

## Client Representation
{party_context}

## Contract Type
{contract_context}

## Analysis Approach (Aggressiveness: {aggressiveness}/5)
{aggressiveness_context}

## Your Task
For each clause provided, perform a thorough risk analysis:

1. **Identify Specific Risks**: Find language that could harm your client's interests
2. **Pinpoint Problematic Language**: Quote the exact words/phrases that create the risk
3. **Assess Severity**: Rate as "high", "medium", or "info" (informational/minor)
4. **Explain the Risk**: Describe WHY this language is problematic and what could go wrong
5. **Consider Context**: Think about how this clause interacts with other contract provisions

## Risk Categories to Consider
- **Liability Exposure**: Uncapped indemnities, broad representations, unlimited damages
- **Timing Risks**: Short deadlines, strict time-is-of-essence provisions unless favorable to your client, inflexible schedules
- **Discretionary Language**: "Sole discretion", "reasonable" without standards, subjective conditions
- **One-Sided Terms**: Asymmetric obligations, unilateral rights, non-mutual provisions
- **Missing Protections**: Lack of caps, no cure periods, missing knowledge qualifiers
- **Default Traps**: Hair-trigger defaults, cross-defaults, loss of deposit provisions
- **Survival Issues**: Unlimited or overly long survival periods for representations
- **Assignment/Transfer**: Restrictions or free transferability depending on client position

## Output Format
Return a JSON array of risk objects. For each risk found:
```json
{{
    "para_id": "the paragraph ID provided",
    "risk_type": "category of risk (e.g., 'uncapped_liability', 'short_deadline', 'broad_discretion')",
    "severity": "high|medium|info",
    "title": "Brief title for the risk (3-6 words)",
    "description": "Detailed explanation of the risk and its implications",
    "problematic_text": "The exact quoted text that creates this risk",
    "start_offset": approximate character position where problematic text starts (0-based),
    "end_offset": approximate character position where problematic text ends,
    "user_recommendation": "Brief suggestion for addressing this risk -- no more than 15 words",
    "model_instructions": "Much more thorough version of user_recommendation.  A detailed instructions to the AI model for how to correct this risk, either by surgically editing this language, deleting it altogether, or replacing it with more client-favorbale language."
    "related_para_id": "comma-separated list of para_ids that might also be implicated for later user and model review."
}}
```

If a clause has multiple distinct risks, return multiple objects.
If a clause has no significant risks for your client, return an empty array for that clause.

Be thorough but precise. Focus on substance over form.

## CONCEPT MAP EXTRACTION

As you analyze, extract document-wide provisions into these categories:

**LIABILITY LIMITATIONS:**
- Baskets (minimum thresholds before claims)
- Caps (maximum liability limits)
- Survival periods (how long claims can be made)
- Deductibles

**KNOWLEDGE STANDARDS:**
- How "knowledge" is defined
- Who the knowledge qualifier applies to

**TERMINATION TRIGGERS:**
- Events allowing termination
- Events requiring termination
- Automatic vs. elective termination

**DEFAULT REMEDIES:**
- Cure periods
- Notice requirements
- Automatic consequences vs. elective remedies

**KEY DEFINED TERMS:**
- Material Adverse Effect
- Permitted Exceptions
- Other terms affecting risk allocation

For each provision found, note: the value, section reference, and any limitations.

## RISK RELATIONSHIPS

For each risk identified, also determine:

**mitigated_by:** Provisions in the document that reduce this risk's severity.
Example: A $50K basket mitigates an unqualified rep because small claims won't trigger liability.

**amplified_by:** Provisions that increase exposure if this risk materializes.
Example: Automatic termination on breach amplifies an unqualified rep because a foot-fault could end the deal.

**triggers:** Obligations or consequences this risk activates.
Example: A rep breach triggers indemnification obligations under Section 8.

Include these in your JSON output as:
{{
  "risks": [...],
  "concept_map": {{
    "liability_limitations": {{}},
    "knowledge_standards": {{}},
    "termination_triggers": {{}},
    "default_remedies": {{}},
    "key_defined_terms": {{}}
  }}
}}

Each risk should include:
{{
  "risk_id": "R-5.3-1",
  "para_id": "para_23",
  "mitigated_by": [{{"ref": "8.3:basket", "effect": "..."}}],
  "amplified_by": [{{"ref": "10.4:auto_term", "effect": "..."}}],
  "triggers": ["8.1:indem"]
}}"""


def build_document_map(all_paragraphs: List[Dict]) -> str:
    """
    Build a condensed document map showing all paragraphs with their IDs.
    This allows the model to identify related paragraphs elsewhere in the document.
    """
    map_lines = []
    for para in all_paragraphs:
        para_id = para.get('id', '')
        section_ref = para.get('section_ref', '')
        text = para.get('text', '')
        # Truncate text for the map - show first 80 chars
        preview = text[:80].replace('\n', ' ').strip()
        if len(text) > 80:
            preview += "..."

        if section_ref:
            map_lines.append(f"- {para_id} [{section_ref}]: {preview}")
        else:
            map_lines.append(f"- {para_id}: {preview}")

    return "\n".join(map_lines)


def build_clause_batch_prompt(
    clauses: List[Dict],
    defined_terms: List[str],
    document_map: str = ""
) -> str:
    """Build the user prompt for analyzing a batch of clauses."""

    terms_context = ""
    if defined_terms:
        terms_context = f"\n\n## Defined Terms in This Document\n{', '.join(defined_terms[:50])}\n"

    doc_map_context = ""
    if document_map:
        doc_map_context = f"""

## Full Document Map (for identifying related clauses)
Use this map to identify other paragraphs that may be implicated by risks you find.
Reference these para_ids in the "related_para_id" field when clauses are interconnected.

{document_map}
"""

    clauses_text = "\n\n---\n\n".join([
        f"**Paragraph ID: {c['id']}**\n**Section: {c.get('section_ref', 'N/A')}**\n\n{c['text']}"
        for c in clauses
    ])

    return f"""Analyze the following contract clauses for risks to our client.
{terms_context}{doc_map_context}
## Clauses to Analyze

{clauses_text}

---

Return your analysis as a JSON array containing all risks found across all clauses.
Include the para_id for each risk so we can map it back to the correct clause.
If you find no risks in a clause, simply don't include any objects for that para_id.

IMPORTANT: When a risk in one clause is connected to or affected by language in other clauses
(e.g., definitions, cross-references, related obligations), include those para_ids in the
"related_para_id" field as a comma-separated list."""


def analyze_clauses_with_claude(
    clauses: List[Dict],
    contract_type: str,
    representation: str,
    aggressiveness: int,
    defined_terms: List[str] = None,
    document_map: str = ""
) -> Dict:
    """
    Use Claude Opus 4.5 to analyze clauses for risks.

    Args:
        clauses: List of clause dicts with 'id', 'text', 'section_ref'
        contract_type: Type of contract (psa, lease, etc.)
        representation: Who we represent (seller, buyer, etc.)
        aggressiveness: 1-5 scale
        defined_terms: List of defined terms in the document
        document_map: Condensed map of all document paragraphs for cross-referencing

    Returns:
        Dict with 'risks' list and 'concept_map' dict
    """
    if not HAS_ANTHROPIC:
        raise RuntimeError("Anthropic SDK not installed. Run: pip install anthropic")

    api_key = get_anthropic_api_key()
    if not api_key:
        raise RuntimeError("Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable or create anthropic_api.txt")

    client = anthropic.Anthropic(api_key=api_key)

    # Build prompts
    system_prompt = build_risk_analysis_prompt(contract_type, representation, aggressiveness)
    user_prompt = build_clause_batch_prompt(clauses, defined_terms or [], document_map)

    # Call Claude for analysis (standard mode)
    try:
        response = client.messages.create(
            model="claude-opus-4-5-20251101",
            max_tokens=16000,
            messages=[
                {"role": "user", "content": user_prompt}
            ],
            system=system_prompt
        )

        # Extract the text response
        response_text = response.content[0].text if response.content else ""

        # Parse JSON from response - returns dict with 'risks' and 'concept_map'
        result = parse_risk_response(response_text)

        # Include prompts in result for debugging/review
        result['prompts'] = {
            'system': system_prompt,
            'user': user_prompt
        }

        return result

    except anthropic.APIError as e:
        raise RuntimeError(f"Claude API error: {str(e)}")


def parse_risk_response(response_text: str) -> Dict:
    """
    Parse the risk analysis response from Claude.

    Returns a dict with structure:
    {
        'risks': [
            {
                'risk_id': str,
                'para_id': str,
                'type': str,
                'severity': str,
                'title': str,
                'description': str,
                'problematic_text': str,
                'user_recommendation': str,
                'model_instructions': str,
                'related_para_ids': str,
                'mitigated_by': List[Dict],  # [{"ref": "8.3:basket", "effect": "..."}]
                'amplified_by': List[Dict],  # [{"ref": "10.4:auto_term", "effect": "..."}]
                'triggers': List[str]        # ["8.1:indem"]
            },
            ...
        ],
        'concept_map': Dict  # the entire concept_map from response
    }
    """
    # Try to extract JSON from the response
    text = response_text.strip()

    # Handle markdown code blocks
    json_match = re.search(r'```(?:json)?\s*([\[\{].*?[\]\}])\s*```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    # Initialize result structure
    result = {
        'risks': [],
        'concept_map': {}
    }

    try:
        parsed = json.loads(text)

        # Handle new format: object with 'risks' and 'concept_map' keys
        if isinstance(parsed, dict):
            risks_list = parsed.get('risks', [])
            result['concept_map'] = parsed.get('concept_map', {})
        # Handle legacy format: direct array of risks
        elif isinstance(parsed, list):
            risks_list = parsed
        else:
            return result

        # Validate and normalize each risk
        for i, risk in enumerate(risks_list):
            if isinstance(risk, dict) and 'para_id' in risk:
                result['risks'].append({
                    'risk_id': risk.get('risk_id', f'R{i+1}'),
                    'para_id': risk.get('para_id', ''),
                    'type': risk.get('risk_type', 'general'),
                    'severity': risk.get('severity', 'medium'),
                    'title': risk.get('title', 'Risk Identified'),
                    'description': risk.get('description', ''),
                    'problematic_text': risk.get('problematic_text', ''),
                    'start_offset': risk.get('start_offset', 0),
                    'end_offset': risk.get('end_offset', 0),
                    'user_recommendation': risk.get('user_recommendation', ''),
                    'model_instructions': risk.get('model_instructions', ''),
                    'related_para_ids': risk.get('related_para_id', ''),
                    'category': categorize_risk(risk.get('risk_type', '')),
                    # NEW fields for risk relationships
                    'mitigated_by': risk.get('mitigated_by', []),
                    'amplified_by': risk.get('amplified_by', []),
                    'triggers': risk.get('triggers', [])
                })

    except json.JSONDecodeError:
        pass

    return result


def categorize_risk(risk_type: str) -> str:
    """Categorize a risk type into a broader category."""
    risk_type_lower = risk_type.lower()

    if any(term in risk_type_lower for term in ['liability', 'indemnif', 'damage']):
        return 'liability'
    elif any(term in risk_type_lower for term in ['time', 'deadline', 'period', 'schedule']):
        return 'timing'
    elif any(term in risk_type_lower for term in ['discretion', 'reasonable', 'subjective']):
        return 'discretionary'
    elif any(term in risk_type_lower for term in ['represent', 'warrant', 'certif']):
        return 'representations'
    elif any(term in risk_type_lower for term in ['default', 'breach', 'cure', 'termination']):
        return 'default'
    elif any(term in risk_type_lower for term in ['assign', 'transfer']):
        return 'assignment'
    elif any(term in risk_type_lower for term in ['surviv']):
        return 'survival'
    else:
        return 'general'


def analyze_document_with_llm(
    parsed_doc: Dict,
    contract_type: str,
    representation: str,
    aggressiveness: int,
    batch_size: int = 5,
    session_id: str = None,
    include_exhibits: bool = False,
    use_forking: bool = True
) -> Dict:
    """
    Perform comprehensive LLM-based document analysis.

    Processes document in batches to manage context and cost.
    Uses ContentFilter to pre-filter non-substantive content before LLM analysis.
    When use_forking=True, performs initial full-document analysis first to establish
    context that batches can inherit.

    Args:
        parsed_doc: Parsed document dict with content array
        contract_type: Type of contract
        representation: Who we represent
        aggressiveness: 1-5 scale
        batch_size: Number of clauses to analyze per API call
        session_id: Session ID for progress tracking
        include_exhibits: Whether to analyze exhibit content (default False)
        use_forking: Whether to use initial full-document analysis (default True)

    Returns:
        Analysis dict with risks, opportunities, and summary
    """
    start_time = time.time()

    # Use ContentFilter to pre-filter non-substantive content
    content_filter = ContentFilter(include_exhibits=include_exhibits)

    # Extract all paragraphs first
    all_paragraphs = [
        item for item in parsed_doc.get('content', [])
        if item.get('type') == 'paragraph'
    ]

    # Apply content filtering to skip blank, signature blocks, notice addresses, etc.
    paragraphs, skip_stats = content_filter.filter_content(all_paragraphs)

    defined_terms = parsed_doc.get('defined_terms', [])

    # Build document map for cross-referencing related clauses
    document_map = build_document_map(paragraphs)

    total_batches = (len(paragraphs) + batch_size - 1) // batch_size
    all_risks = []
    aggregated_concept_map = {}  # Aggregate concept_map from all batches
    all_prompts = []  # Store all prompts for debugging/review

    # Initialize progress with skip stats
    if session_id:
        update_progress(session_id, {
            'status': 'analyzing',
            'total_paragraphs': len(paragraphs),
            'total_batches': total_batches,
            'current_batch': 0,
            'paragraphs_processed': 0,
            'risks_found': 0,
            'percent': 0,
            'started_at': start_time,
            'elapsed_seconds': 0,
            'estimated_remaining_seconds': None,
            'current_action': 'Building document map...',
            'skip_stats': skip_stats,
            'total_skipped': sum(skip_stats.values()),
            'total_before_filter': len(all_paragraphs)
        })

    # Perform initial full-document analysis if forking enabled
    initial_context = None
    if use_forking:
        if session_id:
            update_progress(session_id, {
                'status': 'analyzing',
                'current_action': 'Performing initial document analysis (this establishes context for parallel batch processing)...',
                'stage': 'initial_analysis',
                'percent': 5
            })

        try:
            api_key = get_anthropic_api_key()
            initial_context = run_initial_analysis(
                api_key=api_key,
                paragraphs=paragraphs,
                contract_type=contract_type,
                representation=representation
            )

            # Use extracted defined terms from initial analysis if richer than parsed_doc
            initial_defined_terms = initial_context.get('defined_terms', [])
            if initial_defined_terms and len(initial_defined_terms) > len(defined_terms):
                defined_terms = [t['term'] for t in initial_defined_terms if isinstance(t, dict) and 'term' in t]

            # Use concept map from initial analysis as starting point
            initial_concept_map = initial_context.get('concept_map', {})
            if initial_concept_map:
                aggregated_concept_map = initial_concept_map

            if session_id:
                update_progress(session_id, {
                    'initial_analysis_complete': True,
                    'defined_terms_count': len(defined_terms),
                    'current_action': 'Initial analysis complete. Starting batch analysis...',
                    'percent': 15
                })

                # Store conversation context for parallel batch forking (Plan 03)
                update_progress(session_id, {
                    'initial_context': initial_context
                })

        except Exception as e:
            print(f"Initial analysis failed, falling back to sequential: {e}")
            initial_context = None
            if session_id:
                update_progress(session_id, {
                    'initial_analysis_error': str(e),
                    'current_action': 'Initial analysis failed, using sequential analysis...'
                })

    # TODO (Phase 7): Add analysis_mode parameter to toggle between:
    # - 'fast': use_forking=True, ~$6/doc, ~90 seconds
    # - 'economical': use_forking=False, ~$2/doc, ~15 minutes
    # Expose this choice in intake form

    # Track batch stats for summary
    batch_stats = None

    if use_forking and initial_context:
        # ===== FORKED PARALLEL PATH (fast, ~$6/doc, ~90 seconds) =====
        if session_id:
            update_progress(session_id, {
                'current_action': f'Running {total_batches} parallel batch analyses (forked from initial context)...',
                'stage': 'parallel_batches',
                'percent': 20
            })

        def progress_callback(progress_data, batch_result=None):
            if session_id:
                completed = progress_data['completed']
                total = progress_data['total']
                pct = 20 + int(completed / total * 75)  # 20-95%

                update_progress(session_id, {
                    'current_batch': completed,
                    'total_batches': total,
                    'risks_found': progress_data['risks_found'],
                    'percent': pct,
                    'current_action': f'Completed batch {completed}/{total} ({progress_data["risks_found"]} risks found so far)'
                })

                # Add partial risks from completed batch for incremental display
                if batch_result and batch_result.get('success') and batch_result.get('risks'):
                    add_partial_risks(session_id, batch_result['risks'])

        # Run forked parallel analysis
        api_key = get_anthropic_api_key()
        parallel_result = run_forked_parallel_analysis(
            api_key=api_key,
            paragraphs=paragraphs,
            initial_context=initial_context,
            batch_size=batch_size,
            on_progress=progress_callback
        )

        all_risks = parallel_result['risks']

        # Store batch stats for summary
        batch_stats = parallel_result['stats']

    else:
        # ===== SEQUENTIAL PATH (economical, ~$2/doc, ~15 minutes) =====
        # Keep existing sequential batch processing code as fallback
        # This becomes the fallback when use_forking=False or initial_context failed

        for i in range(0, len(paragraphs), batch_size):
            batch = paragraphs[i:i + batch_size]
            batch_num = i // batch_size + 1
            paragraphs_processed = min(i + batch_size, len(paragraphs))

            # Update progress before processing
            if session_id:
                elapsed = time.time() - start_time
                # Estimate remaining time based on average time per batch
                if batch_num > 1:
                    avg_time_per_batch = elapsed / (batch_num - 1)
                    remaining_batches = total_batches - batch_num + 1
                    est_remaining = avg_time_per_batch * remaining_batches
                else:
                    est_remaining = None

                update_progress(session_id, {
                    'current_batch': batch_num,
                    'paragraphs_processed': i,
                    'percent': int((batch_num - 1) / total_batches * 100),
                    'elapsed_seconds': int(elapsed),
                    'estimated_remaining_seconds': int(est_remaining) if est_remaining else None,
                    'current_action': f'Analyzing batch {batch_num} of {total_batches}...',
                    'current_clause_preview': batch[0].get('text', '')[:100] + '...' if batch else ''
                })

            try:
                batch_result = analyze_clauses_with_claude(
                    clauses=batch,
                    contract_type=contract_type,
                    representation=representation,
                    aggressiveness=aggressiveness,
                    defined_terms=defined_terms,
                    document_map=document_map
                )
                all_risks.extend(batch_result.get('risks', []))

                # Store prompts for this batch
                if batch_result.get('prompts'):
                    all_prompts.append({
                        'batch': batch_num,
                        'clause_ids': [c['id'] for c in batch],
                        'system': batch_result['prompts'].get('system', ''),
                        'user': batch_result['prompts'].get('user', '')
                    })

                # Merge concept_map from this batch (later batches may override earlier)
                batch_concept_map = batch_result.get('concept_map', {})
                for category, provisions in batch_concept_map.items():
                    if category not in aggregated_concept_map:
                        aggregated_concept_map[category] = {}
                    if isinstance(provisions, dict):
                        aggregated_concept_map[category].update(provisions)

                # Update progress after processing
                if session_id:
                    update_progress(session_id, {
                        'risks_found': len(all_risks),
                        'paragraphs_processed': paragraphs_processed
                    })
                    # Add partial risks from completed batch for incremental display
                    batch_risks = batch_result.get('risks', [])
                    if batch_risks:
                        add_partial_risks(session_id, batch_risks)

            except Exception as e:
                # Log error but continue with other batches
                print(f"Error analyzing batch {batch_num}: {e}")
                if session_id:
                    update_progress(session_id, {
                        'last_error': str(e),
                        'current_action': f'Error in batch {batch_num}, continuing...'
                    })
                continue

    # Mark as complete
    if session_id:
        update_progress(session_id, {
            'status': 'complete',
            'stage': 'complete',
            'percent': 100,
            'current_action': 'Analysis complete!',
            'elapsed_seconds': int(time.time() - start_time)
        })
        # Clear partial results since analysis is complete
        clear_partial_risks(session_id)

    # Renumber risks sequentially
    for i, risk in enumerate(all_risks):
        risk['risk_id'] = f'R{i+1}'

    # Build risk map by paragraph
    risk_by_para = {}
    for risk in all_risks:
        para_id = risk.get('para_id', '')
        if para_id not in risk_by_para:
            risk_by_para[para_id] = []
        risk_by_para[para_id].append(risk)

    # Count by severity
    severity_counts = {'high': 0, 'medium': 0, 'info': 0}
    for risk in all_risks:
        sev = risk.get('severity', 'medium')
        if sev in severity_counts:
            severity_counts[sev] += 1

    elapsed_seconds = int(time.time() - start_time)

    return {
        'analysis_date': datetime.now().isoformat(),
        'analysis_method': 'llm',
        'model': 'claude-opus-4-5-20251101',
        'contract_type': contract_type,
        'representation': representation,
        'aggressiveness': aggressiveness,
        'risk_inventory': all_risks,
        'risk_by_paragraph': risk_by_para,
        'concept_map': aggregated_concept_map,  # Document-wide provisions by category
        'opportunities': [],  # Will be populated by separate analysis if needed
        'prompts': all_prompts,  # All prompts used for debugging/review
        'summary': {
            'total_risks': len(all_risks),
            'high_severity': severity_counts['high'],
            'medium_severity': severity_counts['medium'],
            'info_items': severity_counts['info'],
            'paragraphs_analyzed': len(paragraphs),
            'paragraphs_skipped': sum(skip_stats.values()),
            'skip_breakdown': skip_stats,
            'total_batches': total_batches,
            'elapsed_seconds': elapsed_seconds,
            'analysis_method': 'Claude Opus 4.5',
            'analysis_mode': 'forked_parallel' if (use_forking and initial_context) else 'sequential',
            'parallel_stats': batch_stats if (use_forking and initial_context) else None,
            'estimated_cost': '$6' if (use_forking and initial_context) else '$2',
            'used_forking': use_forking and initial_context is not None,
            'initial_defined_terms': len(defined_terms) if initial_context else 0
        }
    }


def analyze_single_paragraph(
    paragraph: Dict,
    document_map: Dict,
    representation: str,
    approach: str,
    aggressiveness: int,
    revised_related: List[Dict] = None
) -> List[Dict]:
    """
    Re-analyze a single paragraph, optionally with context from revised related clauses.

    Args:
        paragraph: The paragraph dict with 'id', 'text', 'section_ref'
        document_map: The document map for cross-referencing
        representation: Who we represent
        approach: Review approach (quick-sale, competitive-bid, etc.)
        aggressiveness: 1-5 scale
        revised_related: List of related clauses that have been revised

    Returns:
        List of risk dicts for this paragraph
    """
    if not HAS_ANTHROPIC:
        raise RuntimeError("Anthropic SDK not installed. Run: pip install anthropic")

    api_key = get_anthropic_api_key()
    if not api_key:
        raise RuntimeError("Anthropic API key not found")

    client = anthropic.Anthropic(api_key=api_key)

    # Build context about revised related clauses
    revised_context = ""
    if revised_related:
        revised_context = "\n\n## Context: Related Clauses Have Been Revised\n"
        revised_context += "The following related clauses have been revised. Consider how these changes may affect your analysis:\n\n"
        for rel in revised_related:
            revised_context += f"### {rel.get('section_ref', rel.get('id'))}\n"
            revised_context += f"Original: {rel.get('original', '')[:200]}...\n"
            revised_context += f"Revised to: {rel.get('revised', '')[:200]}...\n\n"

    # Build the analysis prompt
    system_prompt = f"""You are a legal expert analyzing contract clauses for a {representation}.

Aggressiveness level: {aggressiveness}/5
Review approach: {approach}

Analyze the provided clause for risks. For each risk identified, provide:
- risk_id: Unique identifier (e.g., "risk_1")
- para_id: The paragraph ID
- type: Category of risk
- title: Short descriptive title
- severity: "high", "medium", or "info"
- description: Detailed explanation
- problematic_text: The specific text causing concern
- user_recommendation: Suggested action for the attorney
- related_para_id: Comma-separated IDs of related clauses (if any)

{revised_context}

Respond with a JSON array of risk objects. If no risks are found, respond with an empty array []."""

    user_prompt = f"""## Clause to Analyze

**ID:** {paragraph.get('id')}
**Section:** {paragraph.get('section_ref', 'N/A')}

**Text:**
{paragraph.get('text', '')}

## Document Structure for Reference
{json.dumps(document_map, indent=2) if isinstance(document_map, dict) else str(document_map)[:2000]}

Analyze this clause and return a JSON array of risks."""

    try:
        response = client.messages.create(
            model="claude-opus-4-5-20251101",
            max_tokens=4000,
            messages=[
                {"role": "user", "content": user_prompt}
            ],
            system=system_prompt
        )

        response_text = response.content[0].text if response.content else "[]"
        risks = parse_risk_response(response_text)

        # Ensure para_id is set correctly
        for risk in risks:
            risk['para_id'] = paragraph.get('id')
            if not risk.get('risk_id'):
                risk['risk_id'] = f"risk_{paragraph.get('id')}_{risks.index(risk)}"

        return risks

    except anthropic.APIError as e:
        raise RuntimeError(f"Claude API error: {str(e)}")
