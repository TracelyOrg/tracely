from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import settings
from app.routers import auth, health, organizations
from app.utils.envelope import error
from app.utils.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)


def create_app() -> FastAPI:
    app = FastAPI(title="TRACELY API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(organizations.router)

    @app.exception_handler(ConflictError)
    async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=error("CONFLICT", exc.message),
        )

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content=error("NOT_FOUND", exc.message),
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
        return JSONResponse(
            status_code=403,
            content=error("FORBIDDEN", exc.message),
        )

    @app.exception_handler(UnauthorizedError)
    async def unauthorized_handler(
        request: Request, exc: UnauthorizedError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content=error("UNAUTHORIZED", exc.message),
        )

    @app.exception_handler(ValidationError)
    async def validation_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        details = [
            {"field": e.get("loc", ["unknown"])[-1], "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=error("VALIDATION_ERROR", "Invalid request", details),
        )

    return app


app = create_app()
