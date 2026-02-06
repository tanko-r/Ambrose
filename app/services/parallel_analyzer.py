#!/usr/bin/env python3
"""
Forked Parallel Analyzer for Batch Document Analysis (v3 - Category Framework)

Performs parallel batch analysis using Gemini with condensed context from initial analysis.
Each batch receives:
- Paragraph context (obligations, rights, conditions, party info)
- Risk categories implicated in the batch
- Cross-referenced paragraphs
- Full defined term text

Architecture:
- Initial analysis (Plan 02) uses Gemini 3 Pro Preview for category-based framework
- This class creates N parallel Gemini 3 Flash Preview calls for granular risk finding
- Each call includes condensed context + specific paragraphs to analyze
- Results are aggregated into unified risk list

Part of Phase 6: Analysis Acceleration
"""

import asyncio
import json
import os
import re
import time
import random
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable, Set

# Try to import required packages
try:
    from aiolimiter import AsyncLimiter
    HAS_AIOLIMITER = True
except ImportError:
    HAS_AIOLIMITER = False

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

# Import shared utilities from initial_analyzer
from app.services.initial_analyzer import normalize_contract_type, get_gemini_api_key


class ForkedParallelAnalyzer:
    """
    Performs parallel batch analysis using Gemini with condensed context (v3).

    v3 Changes:
    - Batch prompts include paragraph context (obligations, rights, conditions)
    - Shows which risk categories are implicated in the batch
    - Includes cross-referenced paragraphs
    - Full defined term text (no truncation)
    - Requests granular risks within category framework
    """

    def __init__(
        self,
        api_key: str = None,
        requests_per_minute: int = 1000,  # Gemini has higher limits
        max_concurrent: int = 30          # 30 parallel batches
    ):
        """
        Initialize the parallel analyzer with Gemini.

        Args:
            api_key: Gemini API key (optional, will try to load from env)
            requests_per_minute: Rate limit for API calls (default 1000 RPM)
            max_concurrent: Maximum concurrent API calls (default 30)
        """
        if not HAS_GEMINI:
            raise RuntimeError("Gemini SDK not installed. Run: pip install google-genai")
        if not HAS_AIOLIMITER:
            raise RuntimeError("aiolimiter not installed. Run: pip install aiolimiter")

        # Get API key
        self.api_key = api_key or get_gemini_api_key()
        if not self.api_key:
            raise RuntimeError("Gemini API key not found. Set GEMINI_API_KEY environment variable")

        self.client = genai.Client(api_key=self.api_key)
        self.rate_limiter = AsyncLimiter(requests_per_minute, 60)
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.progress_lock = asyncio.Lock()
        self.progress = {'completed': 0, 'total': 0, 'risks_found': 0}

        # Models to try (with fallback)
        self.primary_model = "gemini-3-flash-preview"
        self.fallback_model = "gemini-3-pro-preview"

    def build_batch_prompt_v3(
        self,
        batch: List[Dict],
        all_paragraphs: List[Dict],
        batch_num: int,
        total_batches: int,
        initial_context: Dict,
        representation: str,
        contract_type: str
    ) -> str:
        """
        Build the v3 batch prompt with condensed context.

        Args:
            batch: List of paragraph dicts to analyze
            all_paragraphs: All paragraphs in document (for cross-ref lookup)
            batch_num: Current batch number (1-indexed)
            total_batches: Total number of batches
            initial_context: Context from initial analysis (paragraph_map, risk_category_map, defined_terms)
            representation: Who we represent
            contract_type: Type of contract

        Returns:
            Formatted prompt string for this batch
        """
        # Normalize contract type to full name
        contract_type_full = normalize_contract_type(contract_type)

        paragraph_map = initial_context.get('paragraph_map', {})
        risk_category_map = initial_context.get('risk_category_map', {})
        defined_terms = initial_context.get('defined_terms', [])

        batch_para_ids = set(p.get('id') for p in batch)

        # Find cross-referenced paragraphs
        cross_ref_ids: Set[str] = set()
        for para_id in batch_para_ids:
            para_info = paragraph_map.get(para_id, {})
            cross_refs = para_info.get('cross_refs', [])
            cross_ref_ids.update(cross_refs)
        cross_ref_ids -= batch_para_ids

        # Get cross-referenced paragraph objects
        para_lookup = {p.get('id'): p for p in all_paragraphs}
        cross_ref_paragraphs = [para_lookup[pid] for pid in cross_ref_ids if pid in para_lookup]

        # Find which risk categories are implicated in this batch
        relevant_categories = {}
        for cat_name, cat_info in risk_category_map.items():
            cat_para_ids = set(cat_info.get('para_ids', []))
            if cat_para_ids & batch_para_ids:
                relevant_categories[cat_name] = cat_info

        # Find relevant defined terms (full text)
        batch_text = " ".join([p.get('text', '') for p in batch]).lower()
        relevant_terms = [
            t for t in defined_terms
            if t.get('term', '').lower() in batch_text
        ]

        # Build the prompt
        paragraphs_text = "\n\n".join([
            f"[{p.get('id', f'para_{i}')}] {p.get('text', '')}"
            for i, p in enumerate(batch)
        ])

        # Paragraph context from map
        para_context_text = ""
        for para_id in batch_para_ids:
            info = paragraph_map.get(para_id, {})
            if info:
                para_context_text += f"\n[{para_id}] {info.get('caption', 'No caption')}\n"
                if info.get('obligations'):
                    para_context_text += f"  Obligations: {', '.join(info['obligations'][:3])}\n"
                if info.get('rights'):
                    para_context_text += f"  Rights: {', '.join(info['rights'][:3])}\n"
                if info.get('party_bound'):
                    para_context_text += f"  Binds: {info['party_bound']}, Benefits: {info.get('party_benefits', 'N/A')}\n"

        # Cross-referenced paragraphs
        cross_ref_text = ""
        if cross_ref_paragraphs:
            cross_ref_text = "\n═══════════════════════════════════════════════════════════════════════════════\nCROSS-REFERENCED PARAGRAPHS\n═══════════════════════════════════════════════════════════════════════════════\n"
            for p in cross_ref_paragraphs[:8]:
                info = paragraph_map.get(p.get('id'), {})
                text = p.get('text', '')
                cross_ref_text += f"\n[{p.get('id')}] ({info.get('caption', 'No caption')})\n{text[:500]}{'...' if len(text) > 500 else ''}\n"

        # Risk categories implicated
        risk_cats_text = ""
        if relevant_categories:
            risk_cats_text = "\n═══════════════════════════════════════════════════════════════════════════════\nRISK CATEGORIES IMPLICATED IN THIS BATCH\n═══════════════════════════════════════════════════════════════════════════════\n"
            for cat_name, cat_info in relevant_categories.items():
                risk_cats_text += f"\n• {cat_name} [{cat_info.get('exposure', 'medium')} exposure]\n"
                risk_cats_text += f"  {cat_info.get('note', '')}\n"

        # Defined terms (full text)
        terms_text = ""
        if relevant_terms:
            terms_text = "\n".join([
                f"• \"{t.get('term')}\": {t.get('definition', 'N/A')}"
                for t in relevant_terms[:15]
            ])
        else:
            terms_text = "(No defined terms found in this batch)"

        return f"""You are analyzing batch {batch_num} of {total_batches} for a {contract_type_full} review.

REPRESENTATION: {representation}

═══════════════════════════════════════════════════════════════════════════════
PARAGRAPH CONTEXT FROM INITIAL ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
{para_context_text}
{risk_cats_text}
═══════════════════════════════════════════════════════════════════════════════
DEFINED TERMS (FULL TEXT)
═══════════════════════════════════════════════════════════════════════════════
{terms_text}

═══════════════════════════════════════════════════════════════════════════════
PARAGRAPHS TO ANALYZE (Batch {batch_num}/{total_batches})
═══════════════════════════════════════════════════════════════════════════════
{paragraphs_text}
{cross_ref_text}
═══════════════════════════════════════════════════════════════════════════════
TASK: GRANULAR RISK ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
For each paragraph, identify SPECIFIC risks within the categories noted above.
Focus on provisions that need CONTRACT CHANGES to protect the {representation}.

For each risk found:
1. Identify the exact problematic language
2. Explain why it's a problem for {representation}
3. Provide specific revision language

Return as JSON:
{{
  "batch_analysis": [
    {{
      "para_id": "...",
      "risks": [
        {{
          "risk_id": "B{batch_num}_R1",
          "category": "One of the risk categories above",
          "severity": "high|medium|low",
          "title": "Brief title",
          "description": "Why this is problematic for {representation}",
          "affected_text": "Exact problematic language",
          "recommendation": "Specific revision: 'Change X to Y'"
        }}
      ],
      "review_flags": [
        {{
          "flag_id": "B{batch_num}_F1",
          "title": "...",
          "action": "What to verify (no contract change needed)"
        }}
      ],
      "observations": "Other notes"
    }}
  ]
}}"""

    async def analyze_batch_fork(
        self,
        batch: List[Dict],
        all_paragraphs: List[Dict],
        batch_num: int,
        total_batches: int,
        initial_context: Dict,
        representation: str = "Seller",
        contract_type: str = "Purchase and Sale Agreement"
    ) -> Dict[str, Any]:
        """
        Analyze a batch using Gemini with v3 condensed context.

        Args:
            batch: List of paragraph dicts to analyze
            all_paragraphs: All paragraphs (for cross-ref lookup)
            batch_num: Current batch number (1-indexed)
            total_batches: Total number of batches
            initial_context: Context from initial analysis
            representation: Who we represent
            contract_type: Type of contract

        Returns:
            Dict with success status, batch_num, response or error, paragraph_ids
        """
        async with self.semaphore:
            async with self.rate_limiter:
                try:
                    # Build the v3 prompt with condensed context
                    full_prompt = self.build_batch_prompt_v3(
                        batch=batch,
                        all_paragraphs=all_paragraphs,
                        batch_num=batch_num,
                        total_batches=total_batches,
                        initial_context=initial_context,
                        representation=representation,
                        contract_type=contract_type
                    )

                    # Configure Gemini generation
                    config = types.GenerateContentConfig(
                        system_instruction="You are a contract risk analyst specializing in identifying specific risks and providing actionable revision recommendations.",
                        candidate_count=1,
                        max_output_tokens=8000,
                        temperature=0.1,
                        safety_settings=[
                            types.SafetySetting(category='HARM_CATEGORY_HATE_SPEECH', threshold='BLOCK_NONE'),
                            types.SafetySetting(category='HARM_CATEGORY_HARASSMENT', threshold='BLOCK_NONE'),
                            types.SafetySetting(category='HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold='BLOCK_NONE'),
                            types.SafetySetting(category='HARM_CATEGORY_DANGEROUS_CONTENT', threshold='BLOCK_NONE'),
                        ]
                    )

                    # Log prompt summary
                    para_ids = [p.get('id', f'para_{i}') for i, p in enumerate(batch)]
                    prompt_summary = {
                        "stage": "batch_analysis",
                        "api": "gemini",
                        "model": self.primary_model,
                        "version": "v3_condensed_context",
                        "batch": f"{batch_num}/{total_batches}",
                        "paragraphs": para_ids,
                        "prompt_chars": len(full_prompt),
                        "prompt_tokens": len(full_prompt) // 4
                    }
                    print(f"[GEMINI API] {json.dumps(prompt_summary)}", flush=True)
                    response = await self._call_gemini_with_retry(full_prompt, config)
                    print(f"[Batch {batch_num}/{total_batches}] Completed successfully", flush=True)

                    return {
                        'success': True,
                        'batch_num': batch_num,
                        'response': response,
                        'paragraph_ids': [p.get('id') for p in batch]
                    }

                except Exception as e:
                    print(f"[Batch {batch_num}/{total_batches}] FAILED: {str(e)}", flush=True)
                    return {
                        'success': False,
                        'batch_num': batch_num,
                        'error': str(e),
                        'paragraph_ids': [p.get('id') for p in batch]
                    }

    async def _call_gemini_with_retry(
        self,
        prompt: str,
        config: types.GenerateContentConfig,
        max_retries: int = 3
    ):
        """
        Call Gemini API with exponential backoff retry.

        Args:
            prompt: The prompt to send
            config: Generation config
            max_retries: Maximum retry attempts

        Returns:
            Gemini response object
        """
        initial_delay = 2
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                # Gemini SDK is sync, so run in executor
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.client.models.generate_content(
                        model=self.primary_model,
                        contents=prompt,
                        config=config
                    )
                )
                return response

            except Exception as e:
                last_error = e
                err_str = str(e).lower()

                # Check if rate limit error
                if "429" in err_str or "quota" in err_str or "rate_limit" in err_str:
                    if attempt < max_retries:
                        delay = initial_delay * (2 ** attempt) + random.uniform(0, 1)
                        print(f"[Batch] Rate limited, retrying in {delay:.1f}s (attempt {attempt + 1})")
                        await asyncio.sleep(delay)
                        continue

                # Try fallback model on last attempt
                if attempt == max_retries - 1:
                    try:
                        loop = asyncio.get_event_loop()
                        response = await loop.run_in_executor(
                            None,
                            lambda: self.client.models.generate_content(
                                model=self.fallback_model,
                                contents=prompt,
                                config=config
                            )
                        )
                        return response
                    except Exception:
                        pass

                raise e

        raise last_error

    async def analyze_all_batches(
        self,
        batches: List[List[Dict]],
        all_paragraphs: List[Dict],
        initial_context: Dict,
        representation: str = "Seller",
        contract_type: str = "Purchase and Sale Agreement",
        on_batch_complete: Optional[Callable] = None
    ) -> List[Dict]:
        """
        Analyze all batches in parallel with v3 condensed context.

        Args:
            batches: List of paragraph batches (each batch is ~5 paragraphs)
            all_paragraphs: All document paragraphs (for cross-ref lookup)
            initial_context: From initial analysis (paragraph_map, risk_category_map, defined_terms)
            representation: Who we represent
            contract_type: Type of contract
            on_batch_complete: Optional async callback for progress updates

        Returns:
            List of batch result dicts
        """
        self.progress['total'] = len(batches)
        self.progress['completed'] = 0
        self.progress['risks_found'] = 0

        start_summary = {
            "stage": "parallel_analysis_start",
            "api": "gemini",
            "model": self.primary_model,
            "version": "v3_condensed_context",
            "total_batches": len(batches),
            "max_concurrent": self.semaphore._value,
            "total_paragraphs": sum(len(b) for b in batches)
        }
        print(f"[GEMINI API] Starting parallel batches: {json.dumps(start_summary)}", flush=True)

        async def process_batch(batch_idx: int, batch: List[Dict]):
            result = await self.analyze_batch_fork(
                batch=batch,
                all_paragraphs=all_paragraphs,
                batch_num=batch_idx + 1,
                total_batches=len(batches),
                initial_context=initial_context,
                representation=representation,
                contract_type=contract_type
            )

            async with self.progress_lock:
                self.progress['completed'] += 1
                if result['success']:
                    # Parse and count risks
                    risks = self._parse_batch_response(result['response'])
                    result['risks'] = risks
                    self.progress['risks_found'] += len(risks)

                if on_batch_complete:
                    # Check if callback is async or sync
                    callback_result = on_batch_complete(self.progress.copy(), result)
                    if asyncio.iscoroutine(callback_result):
                        await callback_result

            return result

        # Create all tasks
        tasks = [
            process_batch(i, batch)
            for i, batch in enumerate(batches)
        ]

        # Run all in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions that weren't caught
        processed_results = []
        successful = 0
        failed = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    'success': False,
                    'batch_num': i + 1,
                    'error': str(result),
                    'risks': []
                })
                failed += 1
            else:
                processed_results.append(result)
                if result.get('success'):
                    successful += 1
                else:
                    failed += 1

        print(f"\n[Parallel Analysis] Complete: {successful} successful, {failed} failed, {self.progress['risks_found']} risks found", flush=True)

        return processed_results

    def _parse_batch_response(self, response) -> List[Dict]:
        """
        Parse risks from a v3 batch response.

        Args:
            response: Gemini API response object

        Returns:
            List of risk dicts extracted from the response
        """
        try:
            # Gemini response has .text property directly
            text = response.text if hasattr(response, 'text') else str(response)

            # Try to extract JSON from code block
            json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(1))
            else:
                # Try direct JSON parse
                data = json.loads(text)

            # v3 format: batch_analysis array with per-paragraph results
            batch_analysis = data.get('batch_analysis', [])

            normalized_risks = []
            for para_result in batch_analysis:
                para_id = para_result.get('para_id', '')
                risks = para_result.get('risks', [])
                review_flags = para_result.get('review_flags', [])
                observations = para_result.get('observations', '')

                # Process risks
                for risk in risks:
                    normalized_risks.append({
                        'risk_id': risk.get('risk_id', ''),
                        'para_id': para_id,
                        'severity': risk.get('severity', 'medium'),
                        'type': risk.get('category', risk.get('type', 'general')),
                        'title': risk.get('title', 'Risk Identified'),
                        'description': risk.get('description', ''),
                        'problematic_text': risk.get('affected_text', risk.get('problematic_text', '')),
                        'user_recommendation': risk.get('recommendation', risk.get('user_recommendation', '')),
                        'model_instructions': risk.get('model_instructions', ''),
                        'related_para_ids': risk.get('related_para_id', ''),
                        'mitigated_by': risk.get('mitigated_by', []),
                        'amplified_by': risk.get('amplified_by', []),
                        'triggers': risk.get('triggers', [])
                    })

                # Process review flags as informational risks
                for flag in review_flags:
                    normalized_risks.append({
                        'risk_id': flag.get('flag_id', ''),
                        'para_id': para_id,
                        'severity': 'info',
                        'type': 'review_flag',
                        'title': flag.get('title', 'Review Flag'),
                        'description': flag.get('action', ''),
                        'problematic_text': '',
                        'user_recommendation': flag.get('action', ''),
                        'model_instructions': '',
                        'related_para_ids': '',
                        'mitigated_by': [],
                        'amplified_by': [],
                        'triggers': []
                    })

            return normalized_risks

        except (json.JSONDecodeError, AttributeError, IndexError) as e:
            print(f"Failed to parse batch response: {e}")
            return []


def run_forked_parallel_analysis(
    api_key: str = None,
    paragraphs: List[Dict] = None,
    initial_context: Dict = None,
    representation: str = "Seller",
    contract_type: str = "Purchase and Sale Agreement",
    batch_size: int = 5,
    on_progress: Optional[Callable] = None
) -> Dict:
    """
    Synchronous wrapper for forked parallel analysis using Gemini (v3).

    Args:
        api_key: Gemini API key (optional, will try to load from env)
        paragraphs: List of paragraph dicts to analyze
        initial_context: Context from initial analysis (must include
            paragraph_map, risk_category_map, defined_terms)
        representation: Who we represent
        contract_type: Type of contract
        batch_size: Number of paragraphs per batch (default 5)
        on_progress: Optional callback for progress updates (progress_dict, batch_result)

    Returns:
        Dict with:
        - risks: List of all risks from all batches
        - batch_results: List of individual batch results
        - stats: Summary statistics
    """
    if paragraphs is None:
        paragraphs = []
    if initial_context is None:
        initial_context = {}

    # Create batches
    batches = [
        paragraphs[i:i + batch_size]
        for i in range(0, len(paragraphs), batch_size)
    ]

    analyzer = ForkedParallelAnalyzer(api_key)

    # Run async
    results = asyncio.run(
        analyzer.analyze_all_batches(
            batches=batches,
            all_paragraphs=paragraphs,
            initial_context=initial_context,
            representation=representation,
            contract_type=contract_type,
            on_batch_complete=on_progress
        )
    )

    # Aggregate results
    all_risks = []
    successful = 0
    failed = 0

    for result in results:
        if result.get('success'):
            all_risks.extend(result.get('risks', []))
            successful += 1
        else:
            failed += 1

    return {
        'risks': all_risks,
        'batch_results': results,
        'stats': {
            'total_batches': len(batches),
            'successful_batches': successful,
            'failed_batches': failed,
            'total_risks': len(all_risks)
        }
    }
