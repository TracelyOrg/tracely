from __future__ import annotations

from typing import Any


def success(data: Any, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"data": data, "meta": meta or {}}


def error(code: str, message: str, details: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        err["details"] = details
    return {"error": err}


def paginated(
    data: list[Any],
    total: int,
    page: int,
    per_page: int,
) -> dict[str, Any]:
    return {
        "data": data,
        "meta": {"total": total, "page": page, "per_page": per_page},
    }
