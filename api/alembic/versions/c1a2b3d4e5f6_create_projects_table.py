"""create_projects_table

Revision ID: c1a2b3d4e5f6
Revises: 5f395bf56f87
Create Date: 2026-02-03 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '5f395bf56f87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('projects',
    sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
    sa.Column('org_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('slug', sa.String(length=60), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('org_id', 'slug', name='uq_projects_org_slug')
    )
    op.create_index('idx_projects_org_id', 'projects', ['org_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_projects_org_id', table_name='projects')
    op.drop_table('projects')
