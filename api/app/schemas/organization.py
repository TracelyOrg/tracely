from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class OrgUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class OrgOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    member_count: int = 0
    project_count: int = 0
    user_role: str = "member"
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgMemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
