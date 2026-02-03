"""add_onboarding_completed_to_users

Revision ID: e3c4d5f6a7b8
Revises: d2b3c4e5f6a7
Create Date: 2026-02-03 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3c4d5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'd2b3c4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add onboarding_completed column to users table."""
    op.add_column(
        'users',
        sa.Column(
            'onboarding_completed',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove onboarding_completed column from users table."""
    op.drop_column('users', 'onboarding_completed')
