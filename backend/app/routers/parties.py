from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.auth import get_current_user
from app.models import Error, NotifyResponse, PartyFormData, PartyRead
from app.store import Store, get_store

router = APIRouter()

SMS_MESSAGE = "Your table is ready at Olive & Ember! Please come to the host stand as soon as possible."


def _error(msg: str, code: int = status.HTTP_400_BAD_REQUEST) -> JSONResponse:
    return JSONResponse(status_code=code, content={"error": msg})


@router.post("/parties", status_code=status.HTTP_201_CREATED, response_model=PartyRead)
async def add_party(
    data: PartyFormData,
    user: str = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> PartyRead:
    party = store.add_party(data)
    return party.to_read()


@router.get("/parties/active", response_model=list[PartyRead])
async def get_active_parties(
    user: str = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> list[PartyRead]:
    active = store.get_active()
    return [p.to_read() for p in active]


@router.get("/parties/history", response_model=list[PartyRead])
async def get_history(
    user: str = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> list[PartyRead]:
    return [p.to_read() for p in store.get_history()]


@router.post("/parties/{party_id}/notify", response_model=NotifyResponse)
async def notify_party(
    party_id: str,
    user: str = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> NotifyResponse:
    party = store.notify_party(party_id)
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found in active list")
    return NotifyResponse(party=party.to_read(), message=SMS_MESSAGE)


@router.post("/parties/{party_id}/seat", response_model=PartyRead)
async def seat_party(
    party_id: str,
    user: str = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> PartyRead:
    party = store.seat_party(party_id)
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found in active list")
    return party.to_read()


@router.delete("/parties/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_party(
    party_id: str,
    user: str = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> None:
    party = store.remove_party(party_id)
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found in active list")
    return None
