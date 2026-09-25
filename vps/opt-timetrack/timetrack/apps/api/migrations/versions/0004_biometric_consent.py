"""employee biometric consent

Revision ID: 0004_biometric_consent
Revises: 0003_auth_sessions
Create Date: 2026-09-24
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_biometric_consent"
down_revision = "0003_auth_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "employees",
        sa.Column("biometric_consent", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("employees", "biometric_consent")
