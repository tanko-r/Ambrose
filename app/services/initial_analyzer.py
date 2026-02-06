#!/usr/bin/env python3
"""
Initial Document Analyzer for Full-Document Analysis (v3 - Category Framework)

Performs initial full-document analysis using Gemini 3 Pro Preview, extracting:
- Paragraph map with obligations, rights, conditions, party info
- Defined terms with FULL definitions (no truncation)
- Category-based risk framework (not granular risks)
- Review flags for attorney diligence

This establishes context that parallel batch analyses can inherit,
eliminating the need for batches to "rediscover" document structure.

Part of Phase 6: Analysis Acceleration
"""

import asyncio
import json
import os
import re
import random
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable

# Try to import Gemini SDK
try:
    from google import genai
    from google.genai import types
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# Contract type name mapping (short code -> full name)
CONTRACT_TYPE_NAMES = {
    'psa': 'Purchase and Sale Agreement',
    'lease': 'Lease',
    'development': 'Development Agreement',
    'easement': 'Easement',
    'loan': 'Loan Agreement',
    'general': 'General Contract'
}


def normalize_contract_type(contract_type: str) -> str:
    """Convert short contract type codes to full names."""
    return CONTRACT_TYPE_NAMES.get(contract_type.lower(), contract_type)


def get_gemini_api_key() -> Optional[str]:
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


# Risk categories by contract type
RISK_CATEGORIES = {
    "Purchase and Sale Agreement": [
        "Buyer Closing Escapes (conditions allowing Buyer to terminate)",
        "Deposit at Risk (circumstances where Seller keeps deposit)",
        "Title/Survey Cure Obligations (Seller's duty to clear issues)",
        "Representation Exposure (Seller's warranty liability)",
        "Indemnification Scope (post-closing liability)",
        "Closing Timeline Risk (delays, extensions)",
        "Financing Contingency (Buyer's loan failure)",
        "Due Diligence Termination Rights",
        "Casualty/Condemnation Risk Allocation",
        "Prorations and Adjustments",
        "Assignment Rights (Buyer transferring contract)",
        "Default Remedies (liquidated damages vs specific performance)",
    ],
    "Lease": [
        "Rent Accrual During Vacancy",
        "Landlord Control of Property",
        "Tenant Default Remedies",
        "Assignment/Subletting Restrictions",
        "Operating Expense Passthrough",
        "Renewal/Extension Options",
        "Early Termination Rights",
        "Maintenance and Repair Obligations",
        "Insurance Requirements",
        "Casualty/Condemnation",
        "Holdover Provisions",
        "Security Deposit",
    ],
    "Development Agreement": [
        "Performance Timeline Risk",
        "Cost Overrun Allocation",
        "Change Order Approval",
        "Completion Standards",
        "Warranty Scope",
        "Indemnification Obligations",
        "Insurance Requirements",
        "Default and Cure Rights",
        "Termination Triggers",
        "Assignment Restrictions",
    ],
    "Easement": [
        "Scope of Use Rights",
        "Maintenance Obligations",
        "Liability Allocation",
        "Duration and Termination",
        "Transferability",
        "Interference Rights",
        "Modification Requirements",
        "Insurance and Indemnity",
    ],
}


class InitialDocumentAnalyzer:
    """
    Performs initial full-document analysis using Gemini 3 Pro Preview.

    v3 Changes:
    - Paragraph map includes obligations, rights, conditions, party_bound, party_benefits
    - Defined terms include FULL definition text (no truncation)
    - Risk analysis is CATEGORY-BASED, not granular
    - Review flags separated for attorney diligence items
    - Uses Gemini 3 Pro Preview for initial mapping (quality + cost balance)
    """

    def __init__(self, api_key: str = None):
        """
        Initialize the analyzer with Gemini API credentials.

        Args:
            api_key: Gemini API key (optional, will try to load from env)
        """
        if not HAS_GEMINI:
            raise RuntimeError("Gemini SDK not installed. Run: pip install google-genai")

        self.api_key = api_key or get_gemini_api_key()
        if not self.api_key:
            raise RuntimeError("Gemini API key not found. Set GEMINI_API_KEY environment variable")

        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-3-pro-preview"
        self.fallback_model = "gemini-3-flash-preview"

    def build_initial_analysis_prompt(
        self,
        document_text: str,
        contract_type: str,
        representation: str
    ) -> tuple:
        """
        Build prompts for initial full-document analysis (v3 - Category Framework).

        Args:
            document_text: Full document text with paragraph IDs
            contract_type: Type of contract (psa, lease, etc.)
            representation: Who we represent (seller, buyer, etc.)

        Returns:
            Tuple of (system_prompt, user_prompt)
        """
        # Normalize contract type to full name
        contract_type_full = normalize_contract_type(contract_type)

        # Get risk categories for this contract type
        risk_cats = RISK_CATEGORIES.get(contract_type_full, RISK_CATEGORIES["Purchase and Sale Agreement"])
        risk_cats_text = "\n".join([f"   - {cat}" for cat in risk_cats])

        system_prompt = f"""You are a senior attorney performing comprehensive initial analysis of a contract.

Your task is to extract structured intelligence that will GUIDE paragraph-by-paragraph risk analysis in subsequent batches.

Representation: {representation}
Contract Type: {contract_type_full}

IMPORTANT: Your role is to create a FRAMEWORK for understanding this document, NOT to do granular risk analysis.
The granular analysis happens in batch processing. Your job is to:
1. Map the document structure with enough detail for batches to understand context
2. Extract ALL defined terms with FULL definitions
3. Identify which RISK CATEGORIES are present and where they appear

Return a DETAILED analysis in JSON format:

1. PARAGRAPH_MAP: For EVERY substantive paragraph, provide:
   - caption: Brief identifying description (5-15 words)
   - section: What section this belongs to
   - obligations: List of obligations created (if any), with format: "Party must do X"
   - rights: List of rights granted (if any), with format: "Party may do X"
   - conditions: List of conditions (if any), with format: "If X, then Y"
   - party_bound: Which party is bound by obligations here (Seller/Buyer/Both/Neither)
   - party_benefits: Which party benefits from this provision (Seller/Buyer/Both/Neither)
   - cross_refs: Paragraph IDs this relates to
   - defined_terms_used: Defined terms referenced here

2. DEFINED_TERMS: Complete list with FULL definition text (DO NOT TRUNCATE):
   - term: The defined term
   - definition: THE COMPLETE DEFINITION TEXT - include every word
   - para_id: Where defined
   - related_terms: Other defined terms referenced in this definition

3. RISK_CATEGORY_MAP: For this {contract_type_full}, map where each risk category appears.
   DO NOT analyze specific risks - just identify WHERE each category is implicated.

   Risk categories for {contract_type_full}:
{risk_cats_text}

   For each category, identify:
   - Which paragraphs implicate this category
   - Brief note on how it appears (1 sentence)
   - Severity indicator (high/medium/low exposure for {representation})

4. REVIEW_FLAGS: Attorney diligence items that don't require redlines:
   - Blanks to fill in
   - Items to verify
   - Standard due diligence checks

Return as JSON with these top-level keys:
- document_summary (type, parties, effective_date_para, closing_date_para, total_substantive_paragraphs)
- paragraph_map (keyed by paragraph ID)
- defined_terms (array of term objects)
- risk_category_map (keyed by category name)
- review_flags (array of flag objects)

Remember:
- FULL definition text for every defined term
- Obligations/rights/conditions with party identification for each paragraph
- Risk categories map WHERE risks appear, not specific risks"""

        user_prompt = f"""Analyze this complete {contract_type_full} document where we represent the {representation}:

{document_text}

Return the comprehensive JSON analysis with:
1. paragraph_map (with obligations, rights, conditions, party_bound, party_benefits)
2. defined_terms (COMPLETE definition text - NO TRUNCATION)
3. risk_category_map (categories and where they appear, NOT specific risks)
4. review_flags (diligence items)"""

        return system_prompt, user_prompt

    async def _call_gemini_with_retry(
        self,
        prompt: str,
        config: Any,
        max_retries: int = 3
    ) -> Any:
        """
        Call Gemini API with retry logic and model fallback.

        Args:
            prompt: The user prompt to send
            config: GenerateContentConfig for the call
            max_retries: Max retry attempts per model

        Returns:
            Gemini API response object
        """
        last_error = None

        for model_name in [self.model, self.fallback_model]:
            for attempt in range(max_retries):
                try:
                    response = await asyncio.to_thread(
                        self.client.models.generate_content,
                        model=model_name,
                        contents=prompt,
                        config=config,
                    )

                    if response and response.text:
                        return response, model_name

                    last_error = RuntimeError(f"Empty response from {model_name}")

                except Exception as e:
                    last_error = e
                    error_str = str(e)

                    # Retry on rate limits
                    if '429' in error_str or 'rate' in error_str.lower() or 'quota' in error_str.lower():
                        wait_time = (2 ** attempt) * 2 + random.random() * 2
                        print(f"[GEMINI API] Rate limited on {model_name}, waiting {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})", flush=True)
                        await asyncio.sleep(wait_time)
                        continue

                    # Retry on transient server errors
                    if '500' in error_str or '503' in error_str:
                        wait_time = (2 ** attempt) + random.random()
                        print(f"[GEMINI API] Server error on {model_name}, retrying in {wait_time:.1f}s", flush=True)
                        await asyncio.sleep(wait_time)
                        continue

                    # Non-retryable error, try fallback model
                    print(f"[GEMINI API] Error on {model_name}: {e}", flush=True)
                    break

            # If primary model exhausted retries, try fallback
            if model_name == self.model:
                print(f"[GEMINI API] Falling back from {self.model} to {self.fallback_model}", flush=True)

        raise RuntimeError(f"All Gemini API attempts failed. Last error: {last_error}")

    async def analyze(
        self,
        paragraphs: List[Dict],
        contract_type: str,
        representation: str,
        on_progress: Optional[Callable] = None
    ) -> Dict:
        """
        Perform initial full-document analysis using Gemini 3 Pro Preview.

        Args:
            paragraphs: List of paragraph dicts with 'id', 'text', etc.
            contract_type: Type of contract
            representation: Who we represent
            on_progress: Optional async callback for progress updates

        Returns:
            Dict with:
            - paragraph_map: Paragraph-level context (obligations, rights, etc.)
            - defined_terms: List of term definitions (full text)
            - risk_category_map: Category-based risk framework
            - review_flags: Attorney diligence items
            - model_used: Which Gemini model was used
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
                'message': 'Sending full document for initial analysis (v3 category framework)...'
            })

        # Log prompt summary
        prompt_summary = {
            "stage": "initial_analysis",
            "api": "gemini",
            "model": self.model,
            "version": "v3_category_framework",
            "content": "full_document",
            "paragraphs": len(paragraphs),
            "doc_chars": len(document_text),
            "contract_type": contract_type,
            "representation": representation
        }
        print(f"[GEMINI API] {json.dumps(prompt_summary)}", flush=True)

        # Configure Gemini for initial analysis
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            candidate_count=1,
            max_output_tokens=65536,
            temperature=0.1,
            response_mime_type="application/json",
        )

        # Call Gemini with retry and fallback
        response, model_used = await self._call_gemini_with_retry(user_prompt, config)

        response_text = response.text
        print(f"[Initial Analysis] Completed via {model_used}. Response length: {len(response_text)} chars", flush=True)

        if on_progress:
            await on_progress({
                'stage': 'initial_analysis',
                'status': 'parsing_response',
                'message': 'Parsing initial analysis response...'
            })

        # Parse response
        result = self._parse_initial_response_text(response_text)
        result['model_used'] = model_used

        return result

    def _parse_initial_response_text(self, text_content: str) -> Dict:
        """
        Parse the initial analysis response from text (v3 format).

        Args:
            text_content: The text content from the API response

        Returns:
            Dict with paragraph_map, defined_terms, risk_category_map, review_flags, document_summary
        """
        # Try to extract JSON
        try:
            # With response_mime_type="application/json", should be pure JSON
            return json.loads(text_content)

        except json.JSONDecodeError:
            pass

        # Fallback: look for JSON in code blocks
        try:
            json_match = re.search(r'```json\s*(.*?)\s*```', text_content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))

            # Try to find JSON object without code blocks
            json_match = re.search(r'\{[\s\S]*"paragraph_map"[\s\S]*\}', text_content)
            if json_match:
                return json.loads(json_match.group(0))

        except json.JSONDecodeError:
            pass

        # Final fallback: return raw text for manual parsing
        return {
            'document_summary': {},
            'paragraph_map': {},
            'defined_terms': [],
            'risk_category_map': {},
            'review_flags': [],
            'raw_response': text_content,
            'parse_error': 'Could not extract JSON from response'
        }


def run_initial_analysis(
    paragraphs: List[Dict],
    contract_type: str,
    representation: str,
    api_key: str = None
) -> Dict:
    """
    Synchronous wrapper for initial analysis.

    Args:
        paragraphs: List of paragraph dicts
        contract_type: Type of contract
        representation: Who we represent
        api_key: Gemini API key (optional, will try to load from env)

    Returns:
        Dict with analysis results
    """
    analyzer = InitialDocumentAnalyzer(api_key)
    return asyncio.run(analyzer.analyze(paragraphs, contract_type, representation))
