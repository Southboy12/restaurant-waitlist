from __future__ import annotations

from sqlalchemy import Column, Enum as SAEnum, Integer, String, BigInteger
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.models.party import Resolution


class PartyModel(Base):
    """SQLAlchemy ORM model for parties in the waitlist."""

    __tablename__ = "parties"

    id = Column(String(10), primary_key=True)
    name = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)
    phone = Column(String(50), nullable=False)
    added_at = Column(BigInteger, nullable=False)
    notified_at = Column(BigInteger, nullable=True)
    expires_at = Column(BigInteger, nullable=True)
    resolved_at = Column(BigInteger, nullable=True)
    resolution = Column(
        SAEnum(Resolution, name="resolution_enum", create_type=False),
        nullable=True
    )
