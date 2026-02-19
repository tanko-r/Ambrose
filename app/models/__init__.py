"""
Data models for the Contract Review application.

- ConceptMap: Document-wide provisions grouped by legal concept
- RiskMap: Risks with dependency chains showing how provisions interact
- SessionRecord: SQLAlchemy model for persisting session metadata to PostgreSQL
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
migrate = Migrate()

from .concept_map import ConceptMap
from .risk_map import Risk, RiskMap, normalize_severity

__all__ = [
    'db', 'migrate', 'Base',
    'ConceptMap',
    'Risk', 'RiskMap', 'normalize_severity',
]

# SessionRecord import is last to avoid circular import (needs db fully assigned above)
from .session import SessionRecord  # noqa: E402

__all__ += ['SessionRecord']
