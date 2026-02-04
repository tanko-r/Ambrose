#!/usr/bin/env python3
"""
Forked Parallel Analyzer for Batch Document Analysis (Gemini Version)

Performs parallel batch analysis using Gemini for higher rate limits.
Each batch includes full document context from the initial Claude analysis,
enabling true parallelism with shared understanding.

Architecture:
- Initial analysis (Plan 02) uses Claude Opus for full document understanding
- This class creates N parallel Gemini calls for batch analysis
- Each call includes the full document context + specific paragraphs to analyze
- Results are aggregated into unified risk list

Why Gemini for batches:
- Claude Opus has 30K input tokens/minute rate limit
- Each batch with full context is ~29K tokens, limiting to ~1 request/minute
- Gemini has much higher rate limits, allowing true parallel execution
- Initial Claude analysis provides document understanding context

Part of Phase 6: Analysis Acceleration
"""

import asyncio
import json
import os
import re
import time
import random
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable

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


class ForkedParallelAnalyzer:
    """
    Performs parallel batch analysis using Gemini for higher rate limits.

    Architecture:
    - Initial analysis (Plan 02) uses Claude Opus for full document understanding
    - This class creates N parallel Gemini calls for batch analysis
    - Each call includes initial context + specific paragraphs to analyze
    - Results are aggregated into unified risk list

    Why Gemini:
    - Claude Opus has 30K tokens/minute rate limit (each batch is ~29K tokens)
    - Gemini has much higher limits, enabling true parallel execution
    - Cost is lower per batch while maintaining quality for structured extraction
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
        Analyze a batch using Gemini with full document context.

        Each batch includes:
        - System prompt with initial analysis context
        - Full conversation history (document + initial analysis)
        - Batch-specific analysis request

        Uses Gemini for higher rate limits than Claude Opus.

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
                    # Build the full prompt for Gemini
                    # Include initial analysis context in system instruction
                    system_prompt = initial_context.get('system_prompt', '')

                    # Build conversation context from initial messages
                    conversation_context = ""
                    for msg in initial_context.get('conversation_messages', []):
                        role = msg.get('role', 'user')
                        content = msg.get('content', '')
                        # Handle content that might be a list (with cache_control blocks)
                        if isinstance(content, list):
                            text_parts = []
                            for block in content:
                                if isinstance(block, dict) and block.get('type') == 'text':
                                    text_parts.append(block.get('text', ''))
                            content = '\n'.join(text_parts)
                        conversation_context += f"\n\n[{role.upper()}]:\n{content}"

                    # Build batch-specific prompt
                    batch_prompt = self.build_batch_fork_prompt(batch, batch_num, total_batches)

                    # Combine everything into a single prompt for Gemini
                    full_prompt = f"""DOCUMENT ANALYSIS CONTEXT:
{conversation_context}

---

NEW TASK:
{batch_prompt}"""

                    # Configure Gemini generation
                    config = types.GenerateContentConfig(
                        system_instruction=system_prompt,
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
                        "batch": f"{batch_num}/{total_batches}",
                        "paragraphs": para_ids,
                        "prompt_chars": len(full_prompt)
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

        start_summary = {
            "stage": "parallel_analysis_start",
            "api": "gemini",
            "model": self.primary_model,
            "total_batches": len(batches),
            "max_concurrent": self.semaphore._value,
            "total_paragraphs": sum(len(b) for b in batches)
        }
        print(f"[GEMINI API] Starting parallel batches: {json.dumps(start_summary)}", flush=True)

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
        Parse risks from a batch response.

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
    api_key: str = None,
    paragraphs: List[Dict] = None,
    initial_context: Dict = None,
    batch_size: int = 5,
    on_progress: Optional[Callable] = None
) -> Dict:
    """
    Synchronous wrapper for forked parallel analysis using Gemini.

    Args:
        api_key: Gemini API key (optional, will try to load from env)
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
