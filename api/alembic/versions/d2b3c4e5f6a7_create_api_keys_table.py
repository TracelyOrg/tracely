"""create_api_keys_table

Revision ID: d2b3c4e5f6a7
Revises: c1a2b3d4e5f6
Create Date: 2026-02-03 20:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2b3c4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('api_keys',
    sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
    sa.Column('project_id', sa.UUID(), nullable=False),
    sa.Column('org_id', sa.UUID(), nullable=False),
    sa.Column('key_prefix', sa.String(length=12), nullable=False),
    sa.Column('key_hash', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=True),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_revoked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_api_keys_hash', 'api_keys', ['key_hash'], unique=False)
    op.create_index('idx_api_keys_project_id', 'api_keys', ['project_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_api_keys_project_id', table_name='api_keys')
    op.drop_index('idx_api_keys_hash', table_name='api_keys')
    op.drop_table('api_keys')
