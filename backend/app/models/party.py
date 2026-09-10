from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, model_validator


class Resolution(str, Enum):
    seated = "seated"
    no_show = "no-show"


class Party(BaseModel):
    """Internal party model. Timestamps are Unix milliseconds (int)."""

    id: str
    name: str
    size: int
    phone: str
    added_at: int  # Unix ms
    notified_at: int | None = None
    expires_at: int | None = None
    resolved_at: int | None = None
    resolution: Resolution | None = None

    def to_read(self) -> PartyRead:
        return PartyRead(
            id=self.id,
            name=self.name,
            size=self.size,
            phone=self.phone,
            addedAt=self.added_at,
            notifiedAt=self.notified_at,
            expiresAt=self.expires_at,
            resolvedAt=self.resolved_at,
            resolution=(self.resolution.value if self.resolution else None),
        )


class PartyFormData(BaseModel):
    name: str = Field(..., min_length=1)
    size: str = Field(..., pattern=r"^[1-9]\d*$")
    phone: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def size_to_int(self) -> PartyFormData:
        self.size_int = int(self.size)
        return self

    size_int: int = Field(default=1, exclude=True)


class PartyRead(BaseModel):
    """Public-facing party model matching the OpenAPI schema."""

    id: str
    name: str
    size: int
    phone: str
    addedAt: int
    notifiedAt: int | None = None
    expiresAt: int | None = None
    resolvedAt: int | None = None
    resolution: str | None = None

    model_config = {"populate_by_name": False}


class NotifyResponse(BaseModel):
    party: PartyRead
    message: str


class Error(BaseModel):
    error: str


# Map internal Expiration -> OpenAPI string
_RESOLUTION_LABELS = {
    Resolution.seated: "seated",
    Resolution.no_show: "no-show",
}
