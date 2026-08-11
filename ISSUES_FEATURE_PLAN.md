# Issues Feature — Plan & Task Checklist

Status: not started. Tasks are meant to be implemented one at a time.

## Context

Tracely already captures exceptions inside ClickHouse spans (`exception.type`,
`exception.message`, `exception.stacktrace` in the `attributes` Map — see
`api/app/utils/otlp.py:220-255`), but there's no way today to see "which
errors keep happening" without manually searching raw spans. This feature
adds a Sentry-style **Issues** view: recurring errors get grouped into a
single "Issue" that tracks occurrence count, first/last seen, and a status
(open/resolved/ignored) a user can change.

The design mirrors the existing **Alert** system (`alert_rule.py` /
`alert_event.py` / `alert_evaluator.py` / `alert_scheduler.py` /
`routers/alerts.py`): evaluates conditions from ClickHouse, stores mutable
state in Postgres, runs on a scheduler, exposes a scoped REST API, has a
paginated frontend list.

All ClickHouse access **must** go through the `ch_query`/`ch_insert` helpers
in `api/app/db/clickhouse.py` (never a raw client) — sharing a client across
threads caused a real production incident this session ("Attempt to execute
concurrent queries within the same session").

## Confirmed decisions

- **Creation mechanism: periodic scan**, not inline-at-ingestion.
  `ingest_service.py:70-76` already keeps ingestion hot-path-safe by pushing
  its one side effect (Redis counters) into `asyncio.create_task`
  fire-and-forget — Postgres upserts per error span would reintroduce
  exactly the kind of ingestion-path risk that pattern avoids. A scheduler
  (mirroring `alert_scheduler.py`) scanning every 30s bounds Postgres writes
  to one upsert per unique fingerprint per interval. `ingest_service.py` is
  **not modified**.

- **Fingerprint = hash(service_name + exception.type + route + normalized
  message)**. Plain service+type+route was rejected as too coarse. The
  exception message is normalized (UUIDs, numbers, quoted values replaced
  with placeholders) before hashing, so `"User 123 not found"` and
  `"User 456 not found"` still merge, but `"User not found"` and
  `"Invalid token"` stay separate. Avoids the fragility of stack-trace
  parsing (format varies per language/SDK) while being more precise than
  route+type alone.

## Verified against the actual codebase

- Alembic head is `f6a7b8c9d0e1` (confirmed leaf — re-check with
  `alembic heads` before writing the migration, in case it changed).
- Migration style confirmed from
  `alembic/versions/c3d4e5f6a7b8_create_alert_rules_table.py`: raw
  `op.create_table` + `sa.Column(..., server_default=sa.text('now()'))`,
  `sa.UniqueConstraint(...)` inline, separate `op.create_index` calls,
  symmetric `downgrade()`.
- `app/main.py:44-51` lifespan: `await init_clickhouse()` →
  `await init_redis()` → `start_scheduler()` (sync) → `yield` →
  `await stop_scheduler()` → `await close_redis()` → `await close_clickhouse()`.
  Router registration is a flat list of `app.include_router(...)` (lines 65-77).
- `alert_scheduler.py` pattern: module-level `_scheduler_running` bool +
  `_scheduler_task`, `start_scheduler()` is a plain (non-async) function
  calling `asyncio.create_task(_scheduler_loop())`, `stop_scheduler()` is
  async and cancels+awaits the task. Uses `async_session_factory()` from
  `app.db.postgres` for a fresh session per cycle.
- `app/db/redis.py`: `cache_get(key)` / `cache_set(key, value,
  ttl_seconds=20)` — default TTL is only 20s, so the scanner's
  high-water-mark key must pass an explicit long `ttl_seconds` (e.g. 7
  days) so it doesn't expire and force a full rescan.

---

## Backend tasks

### B1 — Fingerprint helper

Create `api/app/services/issue_fingerprint.py` (pure functions, no I/O):

```python
import hashlib
import re

_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE)
_QUOTED_RE = re.compile(r"'[^']*'|\"[^\"]*\"")
_NUMBER_RE = re.compile(r"\d+")

def normalize_message(message: str) -> str:
    """Replace likely-dynamic tokens (UUIDs, numbers, quoted values) with
    placeholders so messages differing only in embedded IDs still group
    into the same issue."""
    msg = _UUID_RE.sub("<uuid>", message)
    msg = _QUOTED_RE.sub("<value>", msg)
    msg = _NUMBER_RE.sub("<n>", msg)
    return msg.strip()

def resolve_route(http_route: str, span_name: str) -> str:
    """Prefer http_route; fall back to span_name when no route is set."""
    return http_route if http_route else span_name

def compute_fingerprint(service_name: str, exception_type: str, route: str, message: str) -> str:
    """v1 fingerprint: service + exception type + route + normalized message.

    Deliberately does not parse stack traces (format varies per
    language/SDK). Different call sites throwing the same exception with
    the same normalized message on the same route merge into one issue.
    """
    key = f"{service_name}|{exception_type}|{route}|{normalize_message(message)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
```

Add `api/tests/services/test_issue_fingerprint.py`: `normalize_message` on
numbers/UUIDs/quoted strings, `compute_fingerprint` stability (same inputs
→ same hash) and sensitivity (different service/type/route/message →
different hash).

### B2 — Postgres model + migration

Create `api/app/models/issue.py`, following `alert_event.py`'s exact
conventions (UUID pk default=uuid.uuid4, org_id/project_id FKs
ondelete=CASCADE, `DateTime(timezone=True)` timestamps, `String(20)` status):

```python
class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("project_id", "fingerprint", name="uq_issues_project_fingerprint"),
        Index("idx_issues_org_id", "org_id"),
        Index("idx_issues_project_status", "project_id", "status"),
        Index("idx_issues_project_last_seen", "project_id", "last_seen"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    service_name: Mapped[str] = mapped_column(String(255), nullable=False)
    exception_type: Mapped[str] = mapped_column(String(255), nullable=False)
    route: Mapped[str] = mapped_column(String(500), nullable=False)
    last_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)  # open, resolved, ignored
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
```

Then create `api/alembic/versions/<newrev>_create_issues_table.py`:
- Re-run `alembic heads` first to confirm current head (was `f6a7b8c9d0e1`
  at plan time — may have changed).
- Mirror `c3d4e5f6a7b8_create_alert_rules_table.py`'s exact
  `op.create_table` + `sa.UniqueConstraint(...)` + separate
  `op.create_index` style, symmetric `downgrade()`.

### B3 — Pydantic schemas

Create `api/app/schemas/issue.py`, mirroring `schemas/alert.py`:
- `IssueOut` (`model_config = {"from_attributes": True}`)
- `IssueStatusUpdate` (`status: Literal["open", "resolved", "ignored"]`)
- `IssueListResponse` (`issues: list[IssueOut]`, `total`, `offset`, `limit`)
- `IssueSampleOccurrence` (trace_id, span_id, start_time, duration_ms,
  exception_message, exception_stacktrace)
- `IssueDetailOut` (IssueOut fields + `samples: list[IssueSampleOccurrence]`)

### B4 — Issue service (Postgres CRUD + ClickHouse sample fetch)

Create `api/app/services/issue_service.py`, mirroring `alert_service.py`'s
org/project-scoped query style (`select(Issue).where(Issue.org_id == ...,
Issue.project_id == ...)`, offset/limit + separate `func.count()` query):

- `list_issues(db, org_id, project_id, status, offset, limit)`
- `get_issue(db, org_id, project_id, issue_id)` → raises `NotFoundError`
- `update_issue_status(db, org_id, project_id, issue_id, status)`
- `get_sample_occurrences(org_id, project_id, service_name, exception_type,
  route)` — via `ch_query`, `%(name)s` parameter style (matching
  `span_service.py` — **not** `{name:Type}` typed-placeholder syntax, that's
  unverified against this codebase's clickhouse_connect version):

```sql
SELECT trace_id, span_id, start_time, duration_ms,
       attributes['exception.message'] AS exception_message,
       attributes['exception.stacktrace'] AS exception_stacktrace
FROM spans
WHERE org_id = %(org_id)s AND project_id = %(project_id)s
  AND status_code = 'ERROR' AND span_type = 'span'
  AND service_name = %(service_name)s
  AND attributes['exception.type'] = %(exception_type)s
  AND (http_route = %(route)s OR span_name = %(route)s)
ORDER BY start_time DESC
LIMIT 5
```

Add `api/tests/services/test_issue_service.py`: list pagination/status
filter, get-by-id `NotFoundError`, status update, org/project scoping
isolation (mirror `test_alert_service.py`'s cross-tenant assertions).

### B5 — Issue scanner (scan + group + upsert)

Create `api/app/services/issue_scanner.py` (kept separate from
`issue_service.py`'s CRUD, mirroring how `alert_evaluator.py` is separate
from `alert_service.py`):

```sql
SELECT
    org_id, project_id, service_name,
    attributes['exception.type'] AS exception_type,
    http_route, span_name,
    attributes['exception.message'] AS exception_message,
    count() AS occurrence_count,
    min(start_time) AS first_seen,
    max(start_time) AS last_seen
FROM spans
WHERE status_code = 'ERROR' AND span_type = 'span'
  AND start_time >= %(since)s
  AND attributes['exception.type'] != ''
GROUP BY org_id, project_id, service_name, exception_type, http_route, span_name, exception_message
```

`scan_and_upsert(db, since)`:
1. Run the query above via `ch_query` (groups by raw message — normalization
   happens in Python so there's one source of truth for that logic).
2. For each row: `route = resolve_route(http_route, span_name)`,
   `fingerprint = compute_fingerprint(service_name, exception_type, route,
   exception_message)`.
3. **Merge in Python** by fingerprint — multiple raw messages in one scan
   window can normalize to the same fingerprint (e.g. different user IDs in
   the same message template), so sum `occurrence_count`, take
   `min(first_seen)`/`max(last_seen)` across rows sharing a fingerprint, and
   keep the raw message from the row with the latest `last_seen` as the
   merged `last_message`.
4. For each merged fingerprint, upsert into Postgres (`INSERT ... ON
   CONFLICT (project_id, fingerprint) DO UPDATE`): bump `occurrence_count`
   (add, not overwrite), `last_seen` = max of existing/new, `last_message` =
   newest, and apply the **reopening rule**: if existing `status ==
   "resolved"` and new occurrences exist, flip to `"open"`; if `status ==
   "ignored"`, leave status untouched (only bump count/last_seen). New
   fingerprints insert with `status="open"`.

Add `api/tests/services/test_issue_scanner.py`: mock `ch_query` (patch
`app.services.issue_scanner.ch_query` as `AsyncMock` returning a
`MagicMock` with `.result_rows`/`.column_names`, exactly as
`test_span_service.py` and `test_alert_evaluator.py` already do) to verify:
new fingerprint creates a row with correct
first_seen/last_seen/occurrence_count; rescanning increments count without
duplicating rows; multiple raw messages merging into one fingerprint within
a scan sum correctly; resolved issue with new occurrences reopens to
"open"; ignored issue stays "ignored" but count still updates.

### B6 — Scheduler

Create `api/app/services/issue_scheduler.py`, mirrors `alert_scheduler.py`
exactly (`_scheduler_running`/`_scheduler_task` globals,
`start_scheduler()`/`stop_scheduler()`/`scheduler_lifespan()`), but:
- Interval 30s (tighter than alerts' 60s — issues are triage-facing).
- Tracks `last_scan_at` via `cache_get`/`cache_set` in `app.db.redis` under
  key `issues:last_scan_at`, **passing a long `ttl_seconds`** (e.g.
  `60 * 60 * 24 * 7`) since the default is only 20s. Falls back to
  `now() - 5 minutes` if no cached value (first run / cache miss).
- Each cycle: read `last_scan_at` → `scan_and_upsert(db, since=last_scan_at)`
  → write new `last_scan_at = now()`.

Wire into `api/app/main.py`: add to router import tuple isn't needed here
(scheduler, not router) — in `lifespan()` add
`start_scheduler()`/`stop_scheduler()` for the new scheduler with renamed
imports to avoid collision with the alert scheduler:
`from app.services.issue_scheduler import start_scheduler as
start_issue_scheduler, stop_scheduler as stop_issue_scheduler`.

### B7 — Router

Create `api/app/routers/issues.py`:
`APIRouter(prefix="/api/orgs/{org_slug}/projects/{project_slug}/issues",
tags=["issues"])`, same `org_id: uuid.UUID = Depends(get_current_org)` →
`project_service.get_project_by_slug(db, org_id, project_slug)` pattern as
`routers/alerts.py`:
- `GET /` — `offset`/`limit` Query + optional `status` filter
  (`Query(None, pattern="^(open|resolved|ignored)$")`).
- `GET /{issue_id}` — detail + up to 5 ClickHouse sample occurrences.
- `PATCH /{issue_id}/status` — body `IssueStatusUpdate`.

Register in `api/app/main.py`: add `issues` to the router import tuple
(line ~10-24), `app.include_router(issues.router)` (near line 76).

Add `api/tests/routers/test_issues.py`: mirror `test_dashboard.py`'s
fixture style (`mock_user`, `sample_org`, `sample_project`); test all 3
endpoints incl. 404 cross-project access, 422 invalid status value.

`ingest_service.py` is **not modified** (see Confirmed decisions above).

---

## Frontend tasks

### F1 — Types + query keys

- `app/src/types/issue.ts` — mirrors `types/alert.ts`.
- `app/src/lib/queries.ts` — add `issues(projectId, filters?)` /
  `issue(projectId, issueId)` key factories, mirroring `alertHistory`/`alertEvent`.

### F2 — List components

- `app/src/components/issues/IssueList.tsx` — new sibling to
  `AlertHistoryList.tsx` (different data shape — 3-state status, no
  severity/category — so copy the skeleton/empty/error/pagination
  structure rather than importing it directly).
- `app/src/components/issues/IssueRow.tsx` — sibling to
  `AlertHistoryRow.tsx`: exception type + route as title, service_name,
  occurrence_count, first_seen/last_seen, 3-state status badge (open=red,
  resolved=green, ignored=gray).
- `app/src/components/issues/IssueStatusControl.tsx` — status
  dropdown/button-group, `useMutation` calling `PATCH /status` +
  `queryClient.invalidateQueries(queryKeys.issues(...))`. No existing Alert
  component does inline row-level status mutation — borrow button styling
  from `BulkActionBar.tsx`.

### F3 — List page

- `app/src/app/(dashboard)/[orgSlug]/[projectSlug]/issues/page.tsx` +
  `IssuesPageContent.tsx` + `loading.tsx` — top-level "Issues" tab (not
  nested under alerts), mirroring `alerts/history/page.tsx` structure.

### F4 — Detail page

- `app/src/components/issues/IssueSamplesList.tsx` — detail-page-only,
  renders ClickHouse sample occurrences (trace_id links to the trace
  waterfall view, timestamp, exception message/stacktrace preview). Build
  fresh using `AlertEventDetailContent.tsx`'s layout conventions.
- `app/src/app/(dashboard)/[orgSlug]/[projectSlug]/issues/[issueId]/page.tsx`
  + `IssueDetailContent.tsx` — mirrors `alerts/history/[eventId]/page.tsx`
  + `AlertEventDetailContent.tsx`.

### F5 — Nav link

- `app/src/app/(dashboard)/layout.tsx` — add an "Issues" nav link between
  "Dashboard" and "Alerts", copying the exact active-underline pattern used
  for the other nav links.

---

## Verification (run after each backend task, and again at the end)

- `cd api && .venv/bin/pytest tests/ -q` — full suite must stay green (289
  passing baseline established this session; recreate the `.venv` with
  `uv venv .venv --python 3.12 && uv pip install -p .venv -e ".[dev]"` if
  it's not present).
- `cd api && alembic upgrade head` against the dev Postgres to confirm the
  new migration applies and `downgrade` reverses cleanly.
- Manually trigger a test error span (e.g. via the SDK example app or a
  crafted OTLP payload with `exception.type`/`exception.message` set), wait
  one scan cycle (30s), then `GET
  /api/orgs/{org}/projects/{project}/issues` and confirm the issue appears
  with `occurrence_count: 1`.
- Send a second identical error → confirm `occurrence_count` becomes 2 and
  `last_seen` updates without a duplicate row.
- `PATCH .../status {"status": "resolved"}`, then send another matching
  error, wait one scan cycle, confirm status flips back to `"open"`
  (reopening rule).
- `cd app && npm run lint` and `npx tsc --noEmit` for the new frontend
  files, and manually load the `/issues` page in a browser to confirm the
  list/detail/status-change flow end-to-end.
