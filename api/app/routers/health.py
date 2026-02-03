from __future__ import annotations

from fastapi import APIRouter

from app.utils.envelope import success

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    return success({"status": "ok"})
