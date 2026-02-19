"""
SessionRecord — SQLAlchemy model for persisting session metadata to PostgreSQL.

Only lightweight metadata columns are stored here (DB-03: large blobs like
parsed_doc JSON and DOCX files remain on the filesystem).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from . import db


class SessionRecord(db.Model):
    """Persistent metadata record for a review session."""

    __tablename__ = 'sessions'

    # Primary key
    session_id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Status / workflow state
    status: Mapped[str] = mapped_column(String(50), default='initialized', nullable=False)

    # Intake metadata
    contract_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    representation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    approach: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    aggressiveness: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # File paths (filesystem paths, NOT blob content)
    target_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parsed_doc_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    precedent_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Lightweight counters
    revisions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    flags_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Dev / QA flag
    is_test_session: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f'<SessionRecord {self.session_id} status={self.status}>'
