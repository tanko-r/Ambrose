#!/usr/bin/env python3
"""
Initial Document Analyzer for Full-Document Analysis

Performs initial full-document analysis using Claude Opus 4.5, extracting:
- Comprehensive concept map (document structure)
- Defined terms with their definitions
- Cross-reference map (which sections reference which)
- Document type and key characteristics

This establishes context that parallel batch analyses can inherit,
eliminating the need for batches to "rediscover" document structure.

Part of Phase 6: Analysis Acceleration
"""

import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Callable

# Try to import Anthropic SDK
try:
    import anthropic
    from anthropic import AsyncAnthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


class InitialDocumentAnalyzer:
    """
    Performs initial full-document analysis to establish context for batch forking.

    This sends the ENTIRE document to Claude Opus 4.5 in one request, extracting:
    - Comprehensive concept map (document structure)
    - Defined terms with their definitions
    - Cross-reference map (which sections reference which)
    - Document type and key characteristics

    The conversation ID from this request is used to "fork" parallel batch
    analyses that inherit this full-document understanding.
    """

    def __init__(self, api_key: str):
        """
        Initialize the analyzer with API credentials.

        Args:
            api_key: Anthropic API key
        """
        if not HAS_ANTHROPIC:
            raise RuntimeError("Anthropic SDK not installed. Run: pip install anthropic")

        self.client = anthropic.Anthropic(api_key=api_key)
        self.async_client = AsyncAnthropic(api_key=api_key)

    def build_initial_analysis_prompt(
        self,
        document_text: str,
        contract_type: str,
        representation: str
    ) -> tuple:
        """
        Build prompts for initial full-document analysis.

        Args:
            document_text: Full document text with paragraph IDs
            contract_type: Type of contract (psa, lease, etc.)
            representation: Who we represent (seller, buyer, etc.)

        Returns:
            Tuple of (system_prompt, user_prompt)
        """
        system_prompt = f"""You are a senior attorney performing an initial review of a contract.

Your task is to create a comprehensive analysis of this document's structure that will guide detailed paragraph-by-paragraph review.

Extract and return:
1. CONCEPT_MAP: Hierarchical structure of the document (sections, subsections, their purposes)
2. DEFINED_TERMS: All defined terms with their exact definitions
3. CROSS_REFERENCES: Which sections reference other sections
4. DOCUMENT_PROFILE: Contract type, parties, key dates, critical provisions

Representation: {representation}
Contract Type: {contract_type}

Return as structured JSON with these exact keys:
- concept_map: nested object of sections with structure like:
  {{"section_id": {{"title": "...", "purpose": "...", "subsections": [...]}}}}
- defined_terms: array of {{"term": "...", "definition": "...", "location": "para_id"}}
- cross_references: array of {{"from_section": "para_id", "to_section": "para_id", "reference_type": "definition|obligation|condition|etc"}}
- document_profile: object with:
  - type: contract type identified
  - parties: array of {{"role": "...", "name": "..."}}
  - effective_date: if found
  - key_provisions: array of important section references
  - critical_dates: array of {{"description": "...", "date_or_period": "...", "section": "..."}}

Be thorough - this analysis will guide all subsequent risk assessment."""

        user_prompt = f"""Analyze this complete contract document:

{document_text}

Return the structured analysis as JSON. Wrap your response in ```json``` code blocks."""

        return system_prompt, user_prompt

    async def analyze(
        self,
        paragraphs: List[Dict],
        contract_type: str,
        representation: str,
        on_progress: Optional[Callable] = None
    ) -> Dict:
        """
        Perform initial full-document analysis.

        Args:
            paragraphs: List of paragraph dicts with 'id', 'text', etc.
            contract_type: Type of contract
            representation: Who we represent
            on_progress: Optional async callback for progress updates

        Returns:
            Dict with:
            - concept_map: Hierarchical document structure
            - defined_terms: List of term definitions
            - cross_references: Section relationship map
            - document_profile: Key document characteristics
            - conversation_messages: Messages for forking
            - initial_response_id: Message ID for reference
            - system_prompt: System prompt used (for forking)
        """
        # Build full document text with paragraph IDs for reference
        document_text = "\n\n".join([
            f"[{p.get('id', 'unknown')}] {p.get('text', '')}"
            for p in paragraphs
        ])

        system_prompt, user_prompt = self.build_initial_analysis_prompt(
            document_text, contract_type, representation
        )

        if on_progress:
            await on_progress({
                'stage': 'initial_analysis',
                'status': 'sending_full_document',
                'message': 'Sending full document for initial analysis...'
            })

        # Use extended thinking for thorough comprehension
        response = await self.async_client.messages.create(
            model="claude-opus-4-5-20251101",
            max_tokens=32000,
            thinking={
                "type": "enabled",
                "budget_tokens": 10000  # Allow thinking for complex doc analysis
            },
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )

        if on_progress:
            await on_progress({
                'stage': 'initial_analysis',
                'status': 'parsing_response',
                'message': 'Parsing initial analysis response...'
            })

        # Parse response
        result = self._parse_initial_response(response)

        # Extract the text content for conversation history
        text_content = ""
        for block in response.content:
            if hasattr(block, 'text'):
                text_content = block.text
                break

        # Store conversation context for forking
        result['conversation_messages'] = [
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": text_content}
        ]
        result['initial_response_id'] = response.id
        result['system_prompt'] = system_prompt

        return result

    def _parse_initial_response(self, response) -> Dict:
        """
        Parse the initial analysis response.

        Args:
            response: Anthropic API response object

        Returns:
            Dict with concept_map, defined_terms, cross_references, document_profile
        """
        # Handle thinking blocks - find the text content
        text_content = ""
        for block in response.content:
            if hasattr(block, 'text'):
                text_content = block.text
                break

        # Try to extract JSON
        try:
            # Look for JSON in code blocks
            json_match = re.search(r'```json\s*(.*?)\s*```', text_content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))

            # Try to find JSON object without code blocks
            json_match = re.search(r'\{[\s\S]*"concept_map"[\s\S]*\}', text_content)
            if json_match:
                return json.loads(json_match.group(0))

            # Try direct parse
            return json.loads(text_content)

        except json.JSONDecodeError:
            # Fallback: return raw text for manual parsing
            return {
                'concept_map': {},
                'defined_terms': [],
                'cross_references': [],
                'document_profile': {},
                'raw_response': text_content,
                'parse_error': 'Could not extract JSON from response'
            }


def run_initial_analysis(
    api_key: str,
    paragraphs: List[Dict],
    contract_type: str,
    representation: str
) -> Dict:
    """
    Synchronous wrapper for initial analysis.

    Args:
        api_key: Anthropic API key
        paragraphs: List of paragraph dicts
        contract_type: Type of contract
        representation: Who we represent

    Returns:
        Dict with analysis results and conversation context
    """
    analyzer = InitialDocumentAnalyzer(api_key)
    return asyncio.run(analyzer.analyze(paragraphs, contract_type, representation))
