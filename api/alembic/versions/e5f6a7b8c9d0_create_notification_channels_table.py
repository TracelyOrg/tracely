"""create_notification_channels_table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2024-02-06

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notification_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "channel_type",
            sa.String(20),
            nullable=False,
        ),  # email, slack, discord
        sa.Column(
            "config",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
        ),  # webhook_url, etc.
        sa.Column(
            "is_enabled",
            sa.Boolean,
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Indexes
    op.create_index(
        "idx_notification_channels_project_id",
        "notification_channels",
        ["project_id"],
    )
    op.create_index(
        "idx_notification_channels_org_id",
        "notification_channels",
        ["org_id"],
    )
    # Unique constraint: one channel type per project
    op.create_unique_constraint(
        "uq_notification_channels_project_type",
        "notification_channels",
        ["project_id", "channel_type"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_notification_channels_project_type",
        "notification_channels",
        type_="unique",
    )
    op.drop_index("idx_notification_channels_org_id", "notification_channels")
    op.drop_index("idx_notification_channels_project_id", "notification_channels")
    op.drop_table("notification_channels")
