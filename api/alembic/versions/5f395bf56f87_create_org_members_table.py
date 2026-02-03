"""create_org_members_table

Revision ID: 5f395bf56f87
Revises: d1c746136d2f
Create Date: 2026-02-03 12:23:37.816130

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f395bf56f87'
down_revision: Union[str, Sequence[str], None] = 'd1c746136d2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('org_members',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('org_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('org_id', 'user_id', name='uq_org_members_org_user')
    )
    op.create_index('idx_org_members_org_id', 'org_members', ['org_id'], unique=False)
    op.create_index('idx_org_members_user_id', 'org_members', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_org_members_user_id', table_name='org_members')
    op.drop_index('idx_org_members_org_id', table_name='org_members')
    op.drop_table('org_members')
