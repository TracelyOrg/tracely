"""create_alert_rules_table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create alert_rules table for storing user alert configurations."""
    op.create_table('alert_rules',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('preset_key', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('threshold_value', sa.Float(), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('comparison_operator', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_custom', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'preset_key', name='uq_alert_rules_project_preset')
    )
    # Index for efficient lookups by org_id (multi-tenant queries)
    op.create_index('idx_alert_rules_org_id', 'alert_rules', ['org_id'], unique=False)
    # Index for efficient lookups by project_id
    op.create_index('idx_alert_rules_project_id', 'alert_rules', ['project_id'], unique=False)
    # Index for finding active alerts
    op.create_index('idx_alert_rules_active', 'alert_rules', ['project_id', 'is_active'], unique=False)


def downgrade() -> None:
    """Drop alert_rules table."""
    op.drop_index('idx_alert_rules_active', table_name='alert_rules')
    op.drop_index('idx_alert_rules_project_id', table_name='alert_rules')
    op.drop_index('idx_alert_rules_org_id', table_name='alert_rules')
    op.drop_table('alert_rules')
