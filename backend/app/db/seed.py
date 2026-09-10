from __future__ import annotations

import time

from sqlalchemy.orm import Session

from app.db.database import Base, SessionLocal, engine
from app.db.models import PartyModel
from app.models import Resolution


def init_db() -> None:
    """Create all tables in the database."""
    Base.metadata.create_all(bind=engine)


def seed_data() -> None:
    """Seed the database with sample data if it's empty."""
    Base.metadata.create_all(bind=engine)
    
    with SessionLocal() as session:
        # Check if data already exists
        count = session.query(PartyModel).count()
        if count > 0:
            return
        
        now = int(time.time() * 1000)
        
        # Active parties
        active_parties = [
            PartyModel(
                id="p1",
                name="Adeyemi",
                size=4,
                phone="+234 803 114 2288",
                added_at=now - 6 * 60_000,
            ),
            PartyModel(
                id="p2",
                name="Whitfield",
                size=2,
                phone="+234 701 550 9034",
                added_at=now - 14 * 60_000,
                notified_at=now - 3 * 60_000,
                expires_at=now + 11 * 60_000,
            ),
            PartyModel(
                id="p3",
                name="Okonkwo",
                size=6,
                phone="+234 812 400 7712",
                added_at=now - 22 * 60_000,
            ),
        ]
        
        # History parties
        history_parties = [
            PartyModel(
                id="h1",
                name="Bassey",
                size=3,
                phone="+234 809 221 6640",
                added_at=now - 74 * 60_000,
                notified_at=now - 61 * 60_000,
                resolved_at=now - 58 * 60_000,
                resolution=Resolution.seated,
            ),
            PartyModel(
                id="h2",
                name="Larkin",
                size=2,
                phone="+234 705 333 1180",
                added_at=now - 96 * 60_000,
                notified_at=now - 82 * 60_000,
                resolved_at=now - 67 * 60_000,
                resolution=Resolution.no_show,
            ),
            PartyModel(
                id="h3",
                name="Ifeanyi",
                size=5,
                phone="+234 816 909 4402",
                added_at=now - 120 * 60_000,
                notified_at=now - 108 * 60_000,
                resolved_at=now - 104 * 60_000,
                resolution=Resolution.seated,
            ),
        ]
        
        session.add_all(active_parties + history_parties)
        session.commit()
