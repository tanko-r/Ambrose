# tests/test_claude_service.py
import pytest
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.claude_service import build_risk_analysis_prompt


def test_prompt_includes_concept_extraction():
    """Test that the prompt includes concept map extraction instructions."""
    prompt = build_risk_analysis_prompt(
        contract_type='psa',
        representation='seller',
        aggressiveness=3
    )

    assert 'CONCEPT MAP' in prompt or 'concept map' in prompt.lower()
    assert 'liability_limitations' in prompt or 'LIABILITY LIMITATIONS' in prompt
    assert 'mitigated_by' in prompt


def test_prompt_includes_risk_relationships():
    """Test that the prompt includes risk relationship instructions."""
    prompt = build_risk_analysis_prompt(
        contract_type='psa',
        representation='seller',
        aggressiveness=3
    )

    assert 'mitigated_by' in prompt
    assert 'amplified_by' in prompt
    assert 'triggers' in prompt


def test_prompt_includes_concept_map_categories():
    """Test that all concept map categories are present."""
    prompt = build_risk_analysis_prompt(
        contract_type='lease',
        representation='landlord',
        aggressiveness=4
    )

    # Check for all required concept map categories
    assert 'KNOWLEDGE STANDARDS' in prompt or 'knowledge_standards' in prompt
    assert 'TERMINATION TRIGGERS' in prompt or 'termination_triggers' in prompt
    assert 'DEFAULT REMEDIES' in prompt or 'default_remedies' in prompt
    assert 'KEY DEFINED TERMS' in prompt or 'key_defined_terms' in prompt


def test_prompt_includes_relationship_examples():
    """Test that the prompt includes examples of risk relationships."""
    prompt = build_risk_analysis_prompt(
        contract_type='psa',
        representation='buyer',
        aggressiveness=2
    )

    # The prompt should explain what mitigated_by, amplified_by, triggers mean
    assert 'basket' in prompt.lower() or 'mitigates' in prompt.lower()
    assert 'concept_map' in prompt


def test_prompt_output_format_includes_relationships():
    """Test that the output format section includes relationship fields."""
    prompt = build_risk_analysis_prompt(
        contract_type='development',
        representation='developer',
        aggressiveness=5
    )

    # Check that output format mentions the relationship fields
    assert '"mitigated_by"' in prompt or 'mitigated_by' in prompt
    assert '"amplified_by"' in prompt or 'amplified_by' in prompt
    assert '"triggers"' in prompt or 'triggers' in prompt
