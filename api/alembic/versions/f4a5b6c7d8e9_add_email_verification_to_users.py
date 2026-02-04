"""add_email_verification_to_users

Revision ID: f4a5b6c7d8e9
Revises: e3c4d5f6a7b8
Create Date: 2026-02-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, Sequence[str], None] = 'e3c4d5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add email verification columns to users table."""
    op.add_column(
        'users',
        sa.Column(
            'email_verified',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'email_verification_token',
            sa.String(255),
            nullable=True,
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'email_verification_sent_at',
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Backward compatibility: mark all existing users as verified
    op.execute("UPDATE users SET email_verified = true")


def downgrade() -> None:
    """Remove email verification columns from users table."""
    op.drop_column('users', 'email_verification_sent_at')
    op.drop_column('users', 'email_verification_token')
    op.drop_column('users', 'email_verified')
