from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Literal["admin", "member", "viewer"] = "member"


class InvitationOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    status: str
    invited_by_name: str | None = None
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


class InvitationAccept(BaseModel):
    token: str


class InvitationInfo(BaseModel):
    org_name: str
    org_slug: str
    role: str
    inviter_name: str | None = None
    status: str
