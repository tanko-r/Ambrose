#!/usr/bin/env python3
"""
Gemini Service for Redline Generation

Integrates with Google Gemini API to generate surgical redlines.
Adapted from semantic_redline_engine.py with chain-of-thought prompting.
"""

import os
import re
import math
import json
import time
import random
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import Counter

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Try to import Gemini SDK
try:
    from google import genai
    from google.genai import types
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

# API Key loading
def get_api_key() -> Optional[str]:
    """Get Gemini API key from various sources."""
    # Try environment variables
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key:
        return key

    # Try api.txt file in project root
    api_txt_paths = [
        Path(__file__).parent.parent.parent / 'api.txt',
        Path(__file__).parent.parent.parent / '.env',
        Path.home() / '.gemini_api_key'
    ]

    for path in api_txt_paths:
        if path.exists():
            content = path.read_text().strip()
            if path.suffix == '.txt':
                return content
            # Parse .env format
            for line in content.split('\n'):
                if line.startswith('GEMINI_API_KEY=') or line.startswith('GOOGLE_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"\'')

    return None


class SimpleRetriever:
    """Finds relevant clauses in precedent form based on topic and text similarity."""

    def __init__(self, precedent_content: List[Dict]):
        self.documents = []
        self.vocab = set()
        self.doc_freqs = Counter()

        for item in precedent_content:
            if item.get('type') != 'paragraph' or len(item.get('text', '')) < 20:
                continue

            tokens = self._tokenize(item['text'])
            if not tokens:
                continue

            self.documents.append({
                'id': item['id'],
                'text': item['text'],
                'tokens': Counter(tokens),
                'section_ref': item.get('section_ref', ''),
                'norm': 0
            })

            self.vocab.update(tokens)
            for token in set(tokens):
                self.doc_freqs[token] += 1

        self.num_docs = len(self.documents)
        self._calc_norms()

    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        text = re.sub(r'[^a-z0-9\s]', '', text)
        return [w for w in text.split() if len(w) > 3]

    def _get_idf(self, token: str) -> float:
        count = self.doc_freqs.get(token, 0)
        return math.log(1 + (self.num_docs / (1 + count)))

    def _calc_norms(self):
        for doc in self.documents:
            norm = 0
            for token, count in doc['tokens'].items():
                tfidf = count * self._get_idf(token)
                norm += tfidf ** 2
            doc['norm'] = math.sqrt(norm)

    def search(self, query_text: str, top_k: int = 1) -> List[Dict]:
        if not query_text or len(query_text) < 20:
            return []

        query_tokens = self._tokenize(query_text)
        if not query_tokens:
            return []

        q_vec = Counter(query_tokens)
        q_norm = 0
        for token, count in q_vec.items():
            tfidf = count * self._get_idf(token)
            q_norm += tfidf ** 2
        q_norm = math.sqrt(q_norm)

        if q_norm == 0:
            return []

        scores = []
        for doc in self.documents:
            dot_product = 0
            for token, count in q_vec.items():
                if token in doc['tokens']:
                    q_score = count * self._get_idf(token)
                    d_score = doc['tokens'][token] * self._get_idf(token)
                    dot_product += q_score * d_score

            if doc['norm'] > 0:
                similarity = dot_product / (q_norm * doc['norm'])
            else:
                similarity = 0

            if similarity > 0.15:
                scores.append((similarity, doc))

        scores.sort(key=lambda x: x[0], reverse=True)
        return [s[1] for s in scores[:top_k]]


def build_system_prompt(representation: str, aggressiveness: int) -> str:
    """Build system prompt for the redlining model."""
    return f"""You are an expert real estate attorney redlining a contract to protect your client's interests.

## Your Client
You represent the **{representation.upper()}**. All revisions should protect their interests.

## Aggressiveness Level: {aggressiveness}/5
{"Focus on clearly unreasonable provisions. Accept market-standard terms." if aggressiveness <= 2 else
 "Address all material concerns with reasonable protections." if aggressiveness == 3 else
 "Maximize client protection. Challenge unfavorable terms. Add knowledge qualifiers, materiality thresholds, caps, and cure periods liberally."}

## Core Principles
1. **Surgical Precision**: Prefer inserting specific qualifiers over wholesale rewrites
2. **Terminology Matching**: Use EXACT defined terms from the target document
3. **Style Preservation**: Match the target's numbering format and formality
4. **Protect Aggressively**: Your client's interests come first

## Common Patterns
- Add "to [Party]'s knowledge" for representations
- Add "material" or "materially" for breach standards
- Add "reasonable" for discretionary matters
- Add liability caps, survival limits, and cure periods
- Make one-sided obligations mutual where appropriate

## Output Format
Think through your analysis internally, then provide:
1. The revised text (preserving original structure)
2. A brief rationale for the changes

Return a JSON object with:
{{
  "revised_text": "The revised clause text here",
  "rationale": "Brief explanation of changes",
  "thinking": "Your internal analysis (optional, for transparency)"
}}
"""


def build_revision_prompt(
    original_text: str,
    section_ref: str,
    section_hierarchy: List[Dict],
    risks: List[Dict],
    precedent_clause: Optional[str],
    custom_instruction: str,
    deal_context: str,
    related_clauses: Optional[List[Dict]] = None,
    concept_map: Optional[Dict] = None,
    risk_map: Optional[Dict] = None
) -> str:
    """
    Build the user prompt for a specific revision request.

    Args:
        original_text: The clause text to revise
        section_ref: Section reference (e.g., "5.3")
        section_hierarchy: List of parent sections for context
        risks: List of risks identified for this clause
        precedent_clause: Optional precedent language to reference
        custom_instruction: User's specific instruction for this revision
        deal_context: Overall deal context
        related_clauses: Optional related clauses for consistency
        concept_map: Optional document-wide concept map with provisions
        risk_map: Optional risk map with dependency relationships

    Returns:
        Formatted prompt string for Gemini
    """
    from app.models import ConceptMap, RiskMap

    prompt_parts = []

    # Document Context - Concept Map
    if concept_map:
        cm = ConceptMap.from_dict(concept_map)
        concept_text = cm.to_prompt_format()
        if concept_text.strip():
            prompt_parts.append("## Document Context\n")
            prompt_parts.append(concept_text)
            prompt_parts.append("\n")

    # Risk Context - Matrix showing relationships
    if risk_map and risks:
        rm = RiskMap.from_dict(risk_map)
        risk_ids = [r.get('risk_id') for r in risks if r.get('risk_id')]
        if risk_ids:
            prompt_parts.append("## Risk Context\n")
            prompt_parts.append(rm.to_matrix_format(risk_ids))
            prompt_parts.append("\n\n")

    hierarchy_str = " > ".join([
        f"{h.get('number', '')} {h.get('caption', '')}"
        for h in section_hierarchy
    ]) if section_hierarchy else "Unknown Section"

    risks_str = ""
    if risks:
        risks_str = "\n\nIDENTIFIED RISKS:\n"
        for risk in risks:
            risk_type = risk.get('type') or risk.get('title', 'unknown')
            risks_str += f"- {risk_type}: {risk.get('description', '')}\n"

    precedent_str = ""
    if precedent_clause:
        precedent_str = f"\n\nPREFERRED PRECEDENT:\n\"{precedent_clause}\"\n"

    context_str = ""
    if deal_context:
        context_str = f"\n\nDEAL CONTEXT:\n{deal_context}\n"

    custom_str = ""
    if custom_instruction:
        custom_str = f"\n\nSPECIFIC INSTRUCTION:\n{custom_instruction}\n"

    # Build related clauses context
    related_str = ""
    related_ids_for_revision = []
    if related_clauses:
        related_str = "\n\nRELATED CLAUSES (consider for consistency and harmonization):\n"
        for i, rel in enumerate(related_clauses):
            rel_id = rel.get('id', f'related_{i}')
            related_ids_for_revision.append(rel_id)
            related_str += f"\n--- [{rel_id}] {rel.get('section_ref', '')} ---\n"
            related_str += f"FULL TEXT: {rel.get('text', '')}\n"
            if rel.get('revised_text'):
                related_str += f"(Already revised to: {rel.get('revised_text', '')})\n"
        related_str += "\nIMPORTANT: For each related clause that needs changes for consistency, include it in the 'related_revisions' array in your response.\n"

    related_revision_instruction = ""
    if related_clauses:
        related_revision_instruction = """
7. For EACH related clause that needs modification for consistency, add an entry to "related_revisions" array with:
   - "id": the clause ID (e.g., "p_5")
   - "revised_text": the modified text
   - "rationale": why this change is needed for consistency"""

    # Build context instructions if we have concept/risk maps
    context_instructions = ""
    if concept_map or risk_map:
        context_instructions = """
Consider the Document Context above:
- If a provision mitigates the risk (like a basket or cap), note this but still address remaining exposure
- If a provision amplifies the risk (like automatic termination), prioritize addressing it
- Reference specific provisions by section when relevant

"""

    # Combine all parts
    prompt_parts.append(f"""TARGET SECTION: {section_ref}
HIERARCHY: {hierarchy_str}

TARGET CLAUSE:
"{original_text}"
{precedent_str}{risks_str}{related_str}{context_str}{custom_str}

TASK: Revise the TARGET CLAUSE to protect the client's interests. Apply surgical edits that maintain the original sentence structure while addressing the identified risks.
{context_instructions}
Internal Chain of Thought (before outputting):
1. ANALYZE the risks in the target clause
2. DETERMINE surgical changes to address each risk
3. PREFER adding qualifiers over rewriting
4. ENSURE defined terms match the original
5. VERIFY the revision is grammatically correct
6. CHECK consistency with related clauses{related_revision_instruction}

Return your response as a JSON object with:
- "revised_text": the revised target clause
- "rationale": explanation of changes
- "thinking": (optional) your reasoning
- "related_revisions": (optional) array of revisions to related clauses for consistency
- "related_suggestions": (optional) array of suggestions for other clauses that should be revised for consistency

If you identify that other clauses in the document should also be revised for consistency with your changes, include a "related_suggestions" array:
{{
  "revised_text": "...",
  "rationale": "...",
  "related_suggestions": [
    {{
      "section": "8.3",
      "para_id": "para_45",
      "suggestion": "Add carve-out for the materiality qualifier added here",
      "priority": "recommended"
    }}
  ]
}}

Priority should be "recommended" (should do) or "optional" (nice to have).
""")

    return "".join(prompt_parts)


def extract_revision_from_response(response_text: str, original_text: str) -> Dict[str, Any]:
    """Extract the revision data from model response."""
    text = response_text.strip()

    # Try to parse as JSON
    try:
        # Handle markdown code blocks
        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
        if json_match:
            text = json_match.group(1)

        # Try parsing
        if text.startswith('{'):
            data = json.loads(text)
            return {
                'revised_text': data.get('revised_text', original_text),
                'rationale': data.get('rationale', 'AI revision'),
                'thinking': data.get('thinking', ''),
                'related_revisions': data.get('related_revisions', [])
            }
    except json.JSONDecodeError:
        pass

    # Fallback: extract from text patterns
    revised_match = re.search(r'"revised_text":\s*"(.*?)"(?:,|\})', text, re.DOTALL)
    if revised_match:
        revised = revised_match.group(1).replace('\\"', '"').replace('\\n', '\n')
    else:
        # Use the whole response if no JSON structure
        revised = text

    rationale_match = re.search(r'"rationale":\s*"(.*?)"(?:,|\})', text, re.DOTALL)
    rationale = rationale_match.group(1) if rationale_match else 'AI revision'

    thinking_match = re.search(r'"thinking":\s*"(.*?)"(?:,|\})', text, re.DOTALL)
    thinking = thinking_match.group(1) if thinking_match else ''

    return {
        'revised_text': revised,
        'rationale': rationale,
        'thinking': thinking,
        'related_revisions': []
    }


def generate_revision(
    original_text: str,
    section_ref: str,
    section_hierarchy: List[Dict],
    risks: List[Dict],
    representation: str,
    aggressiveness: int,
    deal_context: str,
    precedent_doc: Optional[Dict] = None,
    custom_instruction: str = "",
    related_clauses: Optional[List[Dict]] = None,
    concept_map: Optional[Dict] = None,
    risk_map: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Generate a revision for a specific clause using Gemini.

    Args:
        original_text: The clause text to revise
        section_ref: Section reference (e.g., "5.3")
        section_hierarchy: List of parent sections for context
        risks: List of risks identified for this clause
        representation: Who the client represents (e.g., "Seller")
        aggressiveness: Revision aggressiveness level (1-5)
        deal_context: Overall deal context
        precedent_doc: Optional precedent document for reference
        custom_instruction: User's specific instruction for this revision
        related_clauses: Optional related clauses for consistency
        concept_map: Optional document-wide concept map with provisions
        risk_map: Optional risk map with dependency relationships

    Returns:
        Dict with revised_text, rationale, thinking, diff_html, and related_suggestions.
    """
    from app.services.document_service import generate_inline_diff_html

    # Check if Gemini is available
    if not HAS_GEMINI:
        return {
            'revised_text': original_text,
            'rationale': 'Gemini SDK not available. Install with: pip install google-genai',
            'thinking': '',
            'diff_html': ''
        }

    api_key = get_api_key()
    if not api_key:
        return {
            'revised_text': original_text,
            'rationale': 'API key not found. Set GEMINI_API_KEY environment variable or create api.txt',
            'thinking': '',
            'diff_html': ''
        }

    # Initialize client
    client = genai.Client(api_key=api_key)

    # Find relevant precedent clause if available
    precedent_clause = None
    if precedent_doc and precedent_doc.get('content'):
        retriever = SimpleRetriever(precedent_doc['content'])
        matches = retriever.search(original_text, top_k=1)
        if matches:
            precedent_clause = matches[0]['text']

    # Build prompts
    system_prompt = build_system_prompt(representation, aggressiveness)
    user_prompt = build_revision_prompt(
        original_text=original_text,
        section_ref=section_ref,
        section_hierarchy=section_hierarchy,
        risks=risks,
        precedent_clause=precedent_clause,
        custom_instruction=custom_instruction,
        deal_context=deal_context,
        related_clauses=related_clauses,
        concept_map=concept_map,
        risk_map=risk_map
    )

    # Configure generation
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        candidate_count=1,
        max_output_tokens=4096,
        temperature=0.1,
        safety_settings=[
            types.SafetySetting(category='HARM_CATEGORY_HATE_SPEECH', threshold='BLOCK_NONE'),
            types.SafetySetting(category='HARM_CATEGORY_HARASSMENT', threshold='BLOCK_NONE'),
            types.SafetySetting(category='HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold='BLOCK_NONE'),
            types.SafetySetting(category='HARM_CATEGORY_DANGEROUS_CONTENT', threshold='BLOCK_NONE'),
        ]
    )

    # Call API with retry logic
    primary_model = "gemini-2.0-flash"
    fallback_model = "gemini-1.5-flash"

    def call_with_retry(model_name: str, max_retries: int = 3):
        initial_delay = 2
        for attempt in range(max_retries + 1):
            try:
                return client.models.generate_content(
                    model=model_name,
                    contents=user_prompt,
                    config=config
                )
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "rate_limit" in err_str:
                    if attempt < max_retries:
                        delay = initial_delay * (2 ** attempt) + random.uniform(0, 1)
                        time.sleep(delay)
                        continue
                raise e
        return None

    try:
        try:
            response = call_with_retry(primary_model)
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "rate_limit" in err_str:
                response = call_with_retry(fallback_model)
            else:
                raise e

        if not response or not response.text:
            return {
                'revised_text': original_text,
                'rationale': 'No response from model',
                'thinking': '',
                'diff_html': ''
            }

        # Extract revision from response
        result = extract_revision_from_response(response.text, original_text)

        # Generate diff HTML
        diff_html = generate_inline_diff_html(original_text, result['revised_text'])
        result['diff_html'] = diff_html

        # Include prompts for debugging/review
        result['prompts'] = {
            'system': system_prompt,
            'user': user_prompt
        }

        return result

    except Exception as e:
        return {
            'revised_text': original_text,
            'rationale': f'Error: {str(e)}',
            'thinking': '',
            'diff_html': ''
        }


def batch_revise(
    paragraphs: List[Dict],
    risks_by_para: Dict[str, List[Dict]],
    representation: str,
    aggressiveness: int,
    deal_context: str,
    precedent_doc: Optional[Dict] = None,
    max_workers: int = 3
) -> List[Dict]:
    """
    Generate revisions for multiple paragraphs in parallel.

    Returns list of revision results.
    """
    import concurrent.futures

    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_para = {}

        for para in paragraphs:
            para_id = para.get('id')
            if len(para.get('text', '')) < 50:
                continue

            risks = risks_by_para.get(para_id, [])

            future = executor.submit(
                generate_revision,
                original_text=para.get('text', ''),
                section_ref=para.get('section_ref', ''),
                section_hierarchy=para.get('section_hierarchy', []),
                risks=risks,
                representation=representation,
                aggressiveness=aggressiveness,
                deal_context=deal_context,
                precedent_doc=precedent_doc
            )
            future_to_para[future] = para

        for future in concurrent.futures.as_completed(future_to_para):
            para = future_to_para[future]
            try:
                result = future.result()
                if result['revised_text'] != para.get('text', ''):
                    result['para_id'] = para.get('id')
                    result['original'] = para.get('text', '')
                    results.append(result)
            except Exception as e:
                pass

    return results
