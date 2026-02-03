#!/usr/bin/env python3
"""
Forked Parallel Analyzer for Batch Document Analysis

Performs parallel batch analysis by forking from an initial conversation.
Each batch inherits full document context from the initial analysis,
enabling true parallelism with shared understanding.

Architecture:
- Initial analysis (Plan 02) creates first conversation with full document
- This class creates N parallel "forks" of that conversation
- Each fork inherits full document context but analyzes specific paragraphs
- Results are aggregated into unified risk list

Cost/Speed tradeoff:
- ~$6/document, ~90 seconds total (fast mode)
- Phase 7 will add 'economical' mode: ~$2/doc, ~15 minutes

Part of Phase 6: Analysis Acceleration
"""

import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Callable

# Try to import required packages
try:
    from aiolimiter import AsyncLimiter
    HAS_AIOLIMITER = True
except ImportError:
    HAS_AIOLIMITER = False

try:
    from anthropic import AsyncAnthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


class ForkedParallelAnalyzer:
    """
    Performs parallel batch analysis by forking from an initial conversation.

    Architecture:
    - Initial analysis (Plan 02) creates first conversation with full document
    - This class creates N parallel "forks" of that conversation
    - Each fork inherits full document context but analyzes specific paragraphs
    - Results are aggregated into unified risk list

    Cost/Speed tradeoff:
    - ~$6/document, ~90 seconds total
    - Phase 7 will add 'economical' mode: ~$2/doc, ~15 minutes
    """

    def __init__(
        self,
        api_key: str,
        requests_per_minute: int = 150,  # Higher limit for Opus
        max_concurrent: int = 30         # 30 parallel forks
    ):
        """
        Initialize the parallel analyzer.

        Args:
            api_key: Anthropic API key
            requests_per_minute: Rate limit for API calls (default 150 RPM)
            max_concurrent: Maximum concurrent API calls (default 30)
        """
        if not HAS_ANTHROPIC:
            raise RuntimeError("Anthropic SDK not installed. Run: pip install anthropic")
        if not HAS_AIOLIMITER:
            raise RuntimeError("aiolimiter not installed. Run: pip install aiolimiter")

        self.client = AsyncAnthropic(api_key=api_key)
        self.rate_limiter = AsyncLimiter(requests_per_minute, 60)
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.progress_lock = asyncio.Lock()
        self.progress = {'completed': 0, 'total': 0, 'risks_found': 0}

    def build_batch_fork_prompt(
        self,
        batch: List[Dict],
        batch_num: int,
        total_batches: int
    ) -> str:
        """
        Build the fork prompt for analyzing a specific batch of paragraphs.

        Args:
            batch: List of paragraph dicts with 'id' and 'text'
            batch_num: Current batch number (1-indexed)
            total_batches: Total number of batches

        Returns:
            Formatted prompt string for this batch
        """
        paragraphs_text = "\n\n".join([
            f"[{p.get('id', f'para_{i}')}] {p.get('text', '')}"
            for i, p in enumerate(batch)
        ])

        return f"""Based on your comprehensive understanding of this document from the initial analysis, now perform detailed risk/opportunity analysis on these specific paragraphs (batch {batch_num} of {total_batches}):

{paragraphs_text}

For each paragraph, identify:
1. RISKS: Provisions that could harm our client's interests
2. OPPORTUNITIES: Ways to strengthen our client's position
3. CROSS_REFERENCES: How this paragraph relates to other document sections you analyzed

Return as JSON:
{{
  "risks": [
    {{
      "risk_id": "unique_id",
      "para_id": "paragraph_id",
      "severity": "high|medium|low",
      "category": "liability|termination|timing|etc",
      "title": "brief_title",
      "description": "detailed explanation",
      "affected_text": "the specific problematic language",
      "recommendation": "suggested revision or action"
    }}
  ],
  "opportunities": [...]
}}"""

    async def analyze_batch_fork(
        self,
        batch: List[Dict],
        batch_num: int,
        total_batches: int,
        initial_context: Dict
    ) -> Dict[str, Any]:
        """
        Analyze a batch by forking from the initial conversation.

        The fork includes:
        - Same system prompt as initial analysis
        - Initial user message (full document)
        - Initial assistant response (concept map, etc.)
        - NEW: Batch-specific analysis request

        Args:
            batch: List of paragraph dicts to analyze
            batch_num: Current batch number (1-indexed)
            total_batches: Total number of batches
            initial_context: Context from Plan 02 initial analysis

        Returns:
            Dict with success status, batch_num, response or error, paragraph_ids
        """
        async with self.semaphore:
            async with self.rate_limiter:
                try:
                    # Build forked message history
                    messages = initial_context['conversation_messages'].copy()

                    # Add batch-specific prompt
                    batch_prompt = self.build_batch_fork_prompt(batch, batch_num, total_batches)
                    messages.append({"role": "user", "content": batch_prompt})

                    # Call API with forked conversation
                    response = await self.client.messages.create(
                        model="claude-opus-4-5-20251101",
                        max_tokens=8000,
                        system=initial_context.get('system_prompt', ''),
                        messages=messages
                    )

                    return {
                        'success': True,
                        'batch_num': batch_num,
                        'response': response,
                        'paragraph_ids': [p.get('id') for p in batch]
                    }

                except Exception as e:
                    return {
                        'success': False,
                        'batch_num': batch_num,
                        'error': str(e),
                        'paragraph_ids': [p.get('id') for p in batch]
                    }

    async def analyze_all_batches(
        self,
        batches: List[List[Dict]],
        initial_context: Dict,
        on_batch_complete: Optional[Callable] = None
    ) -> List[Dict]:
        """
        Analyze all batches in parallel via conversation forking.

        Args:
            batches: List of paragraph batches (each batch is ~5 paragraphs)
            initial_context: From Plan 02 initial analysis
            on_batch_complete: Optional async callback for progress updates

        Returns:
            List of batch result dicts
        """
        self.progress['total'] = len(batches)
        self.progress['completed'] = 0
        self.progress['risks_found'] = 0

        async def process_batch(batch_idx: int, batch: List[Dict]):
            result = await self.analyze_batch_fork(
                batch, batch_idx + 1, len(batches), initial_context
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
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    'success': False,
                    'batch_num': i + 1,
                    'error': str(result),
                    'risks': []
                })
            else:
                processed_results.append(result)

        return processed_results

    def _parse_batch_response(self, response) -> List[Dict]:
        """
        Parse risks from a batch response.

        Args:
            response: Anthropic API response object

        Returns:
            List of risk dicts extracted from the response
        """
        try:
            text = response.content[0].text

            # Try to extract JSON from code block
            json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(1))
            else:
                # Try direct JSON parse
                data = json.loads(text)

            risks = data.get('risks', [])
            opportunities = data.get('opportunities', [])

            # Normalize risk fields
            normalized_risks = []
            for risk in risks:
                normalized_risks.append({
                    'risk_id': risk.get('risk_id', ''),
                    'para_id': risk.get('para_id', ''),
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

            # Treat opportunities as risks with type='opportunity'
            for opp in opportunities:
                normalized_risks.append({
                    'risk_id': opp.get('risk_id', ''),
                    'para_id': opp.get('para_id', ''),
                    'severity': 'info',  # Opportunities are informational
                    'type': 'opportunity',
                    'title': opp.get('title', 'Opportunity Identified'),
                    'description': opp.get('description', ''),
                    'problematic_text': opp.get('affected_text', ''),
                    'user_recommendation': opp.get('recommendation', ''),
                    'model_instructions': opp.get('model_instructions', ''),
                    'related_para_ids': opp.get('related_para_id', ''),
                    'mitigated_by': [],
                    'amplified_by': [],
                    'triggers': []
                })

            return normalized_risks

        except (json.JSONDecodeError, AttributeError, IndexError) as e:
            print(f"Failed to parse batch response: {e}")
            return []


def run_forked_parallel_analysis(
    api_key: str,
    paragraphs: List[Dict],
    initial_context: Dict,
    batch_size: int = 5,
    on_progress: Optional[Callable] = None
) -> Dict:
    """
    Synchronous wrapper for forked parallel analysis.

    Args:
        api_key: Anthropic API key
        paragraphs: List of paragraph dicts to analyze
        initial_context: Context from Plan 02 initial analysis (must include
            conversation_messages and system_prompt)
        batch_size: Number of paragraphs per batch (default 5)
        on_progress: Optional callback for progress updates (progress_dict, batch_result)

    Returns:
        Dict with:
        - risks: List of all risks from all batches
        - batch_results: List of individual batch results
        - stats: Summary statistics
    """
    # Create batches
    batches = [
        paragraphs[i:i + batch_size]
        for i in range(0, len(paragraphs), batch_size)
    ]

    analyzer = ForkedParallelAnalyzer(api_key)

    # Run async
    results = asyncio.run(
        analyzer.analyze_all_batches(batches, initial_context, on_progress)
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
