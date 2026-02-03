"""create_organizations_table

Revision ID: d1c746136d2f
Revises: b1c2d3e4f5a6
Create Date: 2026-02-03 12:22:44.780958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1c746136d2f'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('organizations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('slug', sa.String(length=60), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_organizations_slug', 'organizations', ['slug'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_organizations_slug', table_name='organizations')
    op.drop_table('organizations')
