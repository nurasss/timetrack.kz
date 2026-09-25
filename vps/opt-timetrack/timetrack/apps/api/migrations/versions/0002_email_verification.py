"""email verification codes

Revision ID: 0002_email_verification
Revises: 0001_initial
Create Date: 2026-06-18
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_email_verification"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE"
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS email_verification_codes (
                id UUID NOT NULL,
                user_id UUID NOT NULL,
                email VARCHAR(255) NOT NULL,
                code_hash VARCHAR(128) NOT NULL,
                purpose VARCHAR(64) NOT NULL DEFAULT 'email_verification',
                attempts INTEGER NOT NULL DEFAULT 0,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                consumed_at TIMESTAMP WITH TIME ZONE,
                ip_address VARCHAR(64),
                user_agent VARCHAR(512),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT pk_email_verification_codes PRIMARY KEY (id),
                CONSTRAINT fk_email_verification_codes_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_email_verification_codes_user_id ON email_verification_codes (user_id)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_email_verification_codes_email ON email_verification_codes (email)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_email_verification_codes_expires_at ON email_verification_codes (expires_at)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_email_verification_codes_expires_at"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_email_verification_codes_email"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_email_verification_codes_user_id"))
    op.execute(sa.text("DROP TABLE IF EXISTS email_verification_codes"))
    op.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at"))
