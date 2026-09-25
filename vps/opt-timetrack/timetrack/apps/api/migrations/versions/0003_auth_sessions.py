"""authentication sessions and idempotency

Revision ID: 0003_auth_sessions
Revises: 0002_email_verification
Create Date: 2026-06-19
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_auth_sessions"
down_revision = "0002_email_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("jti", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(length=64), nullable=True),
        sa.Column("rotated_to_jti", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti", name="uq_auth_sessions_jti"),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_company_id", "auth_sessions", ["company_id"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
    op.create_index("ix_auth_sessions_revoked_at", "auth_sessions", ["revoked_at"])
    op.create_index("ix_auth_sessions_rotated_to_jti", "auth_sessions", ["rotated_to_jti"])

    op.add_column("attendance_marks", sa.Column("client_event_id", sa.String(length=128), nullable=True))
    op.add_column("attendance_marks", sa.Column("idempotency_key", sa.String(length=128), nullable=True))
    op.add_column(
        "attendance_marks",
        sa.Column("idempotency_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_unique_constraint(
        "uq_attendance_marks_company_employee_client_event",
        "attendance_marks",
        ["company_id", "employee_id", "client_event_id"],
    )
    op.create_unique_constraint(
        "uq_attendance_marks_company_employee_idempotency_key",
        "attendance_marks",
        ["company_id", "employee_id", "idempotency_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_attendance_marks_company_employee_idempotency_key",
        "attendance_marks",
        type_="unique",
    )
    op.drop_constraint(
        "uq_attendance_marks_company_employee_client_event",
        "attendance_marks",
        type_="unique",
    )
    op.drop_column("attendance_marks", "idempotency_metadata")
    op.drop_column("attendance_marks", "idempotency_key")
    op.drop_column("attendance_marks", "client_event_id")
    op.drop_index("ix_auth_sessions_rotated_to_jti", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_revoked_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_expires_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_company_id", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_column("users", "token_version")
