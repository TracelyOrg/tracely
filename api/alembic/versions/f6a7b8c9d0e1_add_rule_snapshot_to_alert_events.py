"""add_rule_snapshot_to_alert_events

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-06

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    """Add rule_snapshot JSONB column to alert_events table.

    This column stores a snapshot of the alert rule configuration
    at the time the event was triggered, preserving history even
    if the rule is later modified or deleted.
    """
    op.add_column(
        "alert_events",
        sa.Column(
            "rule_snapshot",
            postgresql.JSONB,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("alert_events", "rule_snapshot")
