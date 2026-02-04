"""add_password_reset_to_users

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add password reset columns to users table."""
    op.add_column(
        'users',
        sa.Column(
            'password_reset_token',
            sa.String(255),
            nullable=True,
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'password_reset_sent_at',
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove password reset columns from users table."""
    op.drop_column('users', 'password_reset_sent_at')
    op.drop_column('users', 'password_reset_token')
