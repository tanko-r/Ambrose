"""
Risk Map: Risks with dependency chains showing how provisions interact.

Relationship types:
- mitigated_by: provisions that reduce this risk's severity
- amplified_by: provisions that increase exposure if risk materializes
- triggers: obligations or consequences this risk activates
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field


def normalize_severity(sev: str) -> str:
    """Normalize severity to lowercase and map 'info' to 'low'."""
    if not sev:
        return 'medium'
    sev_lower = sev.lower().strip()
    # Map 'info' to 'low' for consistency in calculations
    if sev_lower == 'info':
        return 'low'
    if sev_lower in ('high', 'medium', 'low'):
        return sev_lower
    return 'medium'  # Default


@dataclass
class Risk:
    """A single risk with its relationships."""
    risk_id: str
    clause: str
    para_id: str
    title: str
    description: str
    base_severity: str  # high, medium, low (info maps to low)
    effective_severity: str = None
    mitigated_by: List[Dict[str, str]] = field(default_factory=list)
    amplified_by: List[Dict[str, str]] = field(default_factory=list)
    triggers: List[str] = field(default_factory=list)

    def __post_init__(self):
        # Normalize severities to handle case and 'info' -> 'low' mapping
        self.base_severity = normalize_severity(self.base_severity)
        if self.effective_severity is None:
            self.effective_severity = self.base_severity
        else:
            self.effective_severity = normalize_severity(self.effective_severity)

    def add_mitigator(self, ref: str, effect: str) -> None:
        """Add a mitigating provision."""
        self.mitigated_by.append({'ref': ref, 'effect': effect})

    def add_amplifier(self, ref: str, effect: str) -> None:
        """Add an amplifying provision."""
        self.amplified_by.append({'ref': ref, 'effect': effect})

    def add_trigger(self, ref: str) -> None:
        """Add a triggered obligation."""
        self.triggers.append(ref)

    def recalculate_severity(self) -> None:
        """Recalculate effective severity based on relationships."""
        severity_order = ['low', 'medium', 'high']
        base_idx = severity_order.index(self.base_severity)

        # Mitigators reduce severity
        for _ in self.mitigated_by:
            base_idx = max(0, base_idx - 1)

        # Amplifiers increase severity
        for _ in self.amplified_by:
            base_idx = min(len(severity_order) - 1, base_idx + 1)

        self.effective_severity = severity_order[base_idx]

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            'risk_id': self.risk_id,
            'clause': self.clause,
            'para_id': self.para_id,
            'title': self.title,
            'description': self.description,
            'base_severity': self.base_severity,
            'effective_severity': self.effective_severity,
            'mitigated_by': self.mitigated_by,
            'amplified_by': self.amplified_by,
            'triggers': self.triggers
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Risk':
        """Deserialize from dictionary."""
        risk = cls(
            risk_id=data['risk_id'],
            clause=data['clause'],
            para_id=data['para_id'],
            title=data['title'],
            description=data['description'],
            base_severity=data['base_severity'],
            effective_severity=data.get('effective_severity')
        )
        risk.mitigated_by = data.get('mitigated_by', [])
        risk.amplified_by = data.get('amplified_by', [])
        risk.triggers = data.get('triggers', [])
        return risk


class RiskMap:
    """Collection of risks with dependency relationships."""

    def __init__(self):
        self.risks: Dict[str, Risk] = {}
        self.change_history: List[Dict[str, Any]] = []

    def add_risk(
        self,
        risk_id: str,
        clause: str,
        para_id: str,
        title: str,
        description: str,
        base_severity: str
    ) -> Risk:
        """Add a new risk to the map."""
        risk = Risk(
            risk_id=risk_id,
            clause=clause,
            para_id=para_id,
            title=title,
            description=description,
            base_severity=base_severity
        )
        self.risks[risk_id] = risk
        return risk

    def get_risk(self, risk_id: str) -> Optional[Risk]:
        """Get a risk by ID."""
        return self.risks.get(risk_id)

    def get_risks_for_clause(self, clause: str) -> List[Risk]:
        """Get all risks for a specific clause."""
        return [r for r in self.risks.values() if r.clause == clause]

    def get_risks_for_para(self, para_id: str) -> List[Risk]:
        """Get all risks for a specific paragraph."""
        return [r for r in self.risks.values() if r.para_id == para_id]

    def recalculate_all_severities(self) -> None:
        """Recalculate effective severities for all risks."""
        for risk in self.risks.values():
            risk.recalculate_severity()

    def get_affected_risks(self, provision_ref: str) -> List[Risk]:
        """Get risks affected by a provision (as mitigator or amplifier)."""
        affected = []
        for risk in self.risks.values():
            refs = [m['ref'] for m in risk.mitigated_by]
            refs += [a['ref'] for a in risk.amplified_by]
            if provision_ref in refs:
                affected.append(risk)
        return affected

    def to_matrix_format(self, risk_ids: List[str] = None) -> str:
        """Format risks as matrix for LLM prompt."""
        if risk_ids is None:
            risk_ids = list(self.risks.keys())

        lines = [
            "| Risk ID | Clause | Severity | Mitigated By | Amplified By | Triggers |",
            "|---------|--------|----------|--------------|--------------|----------|"
        ]

        for risk_id in risk_ids:
            risk = self.risks.get(risk_id)
            if not risk:
                continue

            severity = risk.effective_severity
            if risk.base_severity != risk.effective_severity:
                severity = f"{risk.base_severity.upper()}→{risk.effective_severity.upper()}"
            else:
                severity = risk.effective_severity.upper()

            mitigators = ', '.join(m['ref'] for m in risk.mitigated_by) or '—'
            amplifiers = ', '.join(a['ref'] for a in risk.amplified_by) or '—'
            triggers = ', '.join(risk.triggers) or '—'

            lines.append(
                f"| {risk.risk_id} | {risk.clause} | {severity} | {mitigators} | {amplifiers} | {triggers} |"
            )

        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            'risks': {rid: r.to_dict() for rid, r in self.risks.items()},
            'change_history': self.change_history
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RiskMap':
        """Deserialize from dictionary."""
        rm = cls()
        for rid, rdata in data.get('risks', {}).items():
            rm.risks[rid] = Risk.from_dict(rdata)
        rm.change_history = data.get('change_history', [])
        return rm
