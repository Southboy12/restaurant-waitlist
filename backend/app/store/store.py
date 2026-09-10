from __future__ import annotations

import random
import string
import time
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models import PartyModel
from app.models import Party, PartyFormData, Resolution

if TYPE_CHECKING:
    from collections.abc import Sequence


def _rand_id() -> str:
    return "p" + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def _party_to_model(party: Party) -> PartyModel:
    """Convert a Party domain model to a PartyModel ORM object."""
    return PartyModel(
        id=party.id,
        name=party.name,
        size=party.size,
        phone=party.phone,
        added_at=party.added_at,
        notified_at=party.notified_at,
        expires_at=party.expires_at,
        resolved_at=party.resolved_at,
        resolution=party.resolution,
    )


def _model_to_party(model: PartyModel) -> Party:
    """Convert a PartyModel ORM object to a Party domain model."""
    return Party(
        id=model.id,
        name=model.name,
        size=model.size,
        phone=model.phone,
        added_at=model.added_at,
        notified_at=model.notified_at,
        expires_at=model.expires_at,
        resolved_at=model.resolved_at,
        resolution=model.resolution,
    )


class Store:
    """Database-backed waitlist store using SQLAlchemy."""

    def __init__(self, session: Session | None = None) -> None:
        self._session = session
        self._own_session = session is None

    def __enter__(self) -> Store:
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def close(self) -> None:
        """Close the session if we created it."""
        if self._own_session and self._session is not None:
            self._session.close()
            self._session = None

    @property
    def session(self) -> Session:
        """Get the current session, creating one if needed."""
        if self._session is None:
            self._session = SessionLocal()
            self._own_session = True
        return self._session

    # ------------------------------------------------------------------
    # Seeding
    # ------------------------------------------------------------------

    def seed(self) -> None:
        """Seed the database with sample data if it's empty."""
        from app.db.seed import seed_data
        seed_data()

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def add_party(self, data: PartyFormData) -> Party:
        now = int(time.time() * 1000)
        party = Party(
            id=_rand_id(),
            name=data.name.strip(),
            size=data.size_int,
            phone=data.phone.strip(),
            added_at=now,
        )
        model = _party_to_model(party)
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_party(model)

    def get_active(self) -> list[Party]:
        """Return active parties, moving expired ones to history as no-shows."""
        now = int(time.time() * 1000)
        
        # Get all parties that haven't been resolved yet
        active_query = (
            self.session.query(PartyModel)
            .filter(PartyModel.resolution.is_(None))
            .order_by(PartyModel.added_at.desc())
        )
        
        active_models = active_query.all()
        
        # Separate expired and still-active parties
        expired_models = []
        still_active_models = []
        
        for model in active_models:
            if model.expires_at is not None and model.expires_at <= now:
                expired_models.append(model)
            else:
                still_active_models.append(model)
        
        # Update expired parties to no-show
        for model in expired_models:
            model.resolution = Resolution.no_show
            model.resolved_at = now
        
        self.session.commit()
        
        return [_model_to_party(m) for m in still_active_models]

    def get_history(self) -> list[Party]:
        """Return resolved parties (history)."""
        history_query = (
            self.session.query(PartyModel)
            .filter(PartyModel.resolution.isnot(None))
            .order_by(PartyModel.resolved_at.desc())
        )
        return [_model_to_party(m) for m in history_query.all()]

    def find_active(self, party_id: str) -> Party | None:
        """Find an active party by ID."""
        model = (
            self.session.query(PartyModel)
            .filter(
                PartyModel.id == party_id,
                PartyModel.resolution.is_(None)
            )
            .first()
        )
        return _model_to_party(model) if model else None

    def update_party(self, party_id: str, **kwargs) -> Party | None:
        """Update a party's fields in the database."""
        model = self.session.query(PartyModel).filter(
            PartyModel.id == party_id,
            PartyModel.resolution.is_(None)
        ).first()
        
        if model is None:
            return None
        
        for key, value in kwargs.items():
            if hasattr(model, key):
                setattr(model, key, value)
        
        self.session.commit()
        self.session.refresh(model)
        return _model_to_party(model)

    def notify_party(self, party_id: str, timeout_s: int = 15 * 60) -> Party | None:
        """Notify a party and set their expiration time."""
        model = self.session.query(PartyModel).filter(
            PartyModel.id == party_id,
            PartyModel.resolution.is_(None)
        ).first()
        
        if model is None:
            return None
        
        now = int(time.time() * 1000)
        model.notified_at = now
        model.expires_at = now + timeout_s * 1000
        self.session.commit()
        self.session.refresh(model)
        return _model_to_party(model)

    def seat_party(self, party_id: str) -> Party | None:
        """Seat a party (move from active to history as seated)."""
        model = self.session.query(PartyModel).filter(
            PartyModel.id == party_id,
            PartyModel.resolution.is_(None)
        ).first()
        
        if model is None:
            return None
        
        now = int(time.time() * 1000)
        model.resolution = Resolution.seated
        model.resolved_at = now
        model.expires_at = None
        self.session.commit()
        self.session.refresh(model)
        return _model_to_party(model)

    def remove_party(self, party_id: str) -> Party | None:
        """Remove a party (move from active to history as no-show)."""
        model = self.session.query(PartyModel).filter(
            PartyModel.id == party_id,
            PartyModel.resolution.is_(None)
        ).first()
        
        if model is None:
            return None
        
        now = int(time.time() * 1000)
        model.resolution = Resolution.no_show
        model.resolved_at = now
        self.session.commit()
        self.session.refresh(model)
        return _model_to_party(model)


# Module-level singleton (fresh per process; tests create their own)
_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
        _store.seed()
    return _store


def reset_store() -> None:
    """Replace the global store with a fresh instance. For testing."""
    global _store
    if _store is not None:
        _store.close()
    _store = Store()
    from app.db.seed import init_db, seed_data
    init_db()
    seed_data()
