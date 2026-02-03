from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from app.dependencies import get_api_key_project
from app.services.ingest_service import ingest_traces
from app.utils.envelope import error

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/v1/traces", status_code=200)
async def receive_traces(
    request: Request,
    auth: tuple[uuid.UUID, uuid.UUID] = Depends(get_api_key_project),
) -> Response:
    """OTLP/HTTP protobuf ingestion endpoint.

    Receives ExportTraceServiceRequest payloads from SDKs.
    API key auth scopes the request to a specific project and organization.
    Returns 200 with empty body on success (OTLP convention).
    """
    project_id, org_id = auth

    raw_body = await request.body()
    if not raw_body:
        return JSONResponse(
            status_code=400,
            content=error("BAD_REQUEST", "Empty request body"),
        )

    try:
        count = await ingest_traces(raw_body, org_id, project_id)
    except ValueError as e:
        logger.warning("Malformed OTLP payload from project %s: %s", project_id, e)
        return JSONResponse(
            status_code=400,
            content=error("BAD_REQUEST", str(e)),
        )

    logger.debug("Ingested %d spans for project %s", count, project_id)
    return Response(status_code=200)
