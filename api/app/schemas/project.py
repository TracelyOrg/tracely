from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    org_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
