from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ApiKeyCreate(BaseModel):
    name: str | None = Field(default=None, max_length=100)


class ApiKeyCreated(BaseModel):
    id: uuid.UUID
    key: str
    prefix: str
    name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyOut(BaseModel):
    id: uuid.UUID
    prefix: str
    name: str | None
    last_used_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
