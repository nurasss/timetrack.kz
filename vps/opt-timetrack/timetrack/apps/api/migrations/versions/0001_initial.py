"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-17
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

role_enum = sa.Enum("SUPER_ADMIN", "COMPANY_ADMIN", "HR", "MANAGER", "EMPLOYEE", name="role")
company_status_enum = sa.Enum("ACTIVE", "BLOCKED", "TRIAL", "EXPIRED", name="companystatus")
employment_status_enum = sa.Enum("ACTIVE", "FIRED", "VACATION", "SICK", name="employmentstatus")
mark_type_enum = sa.Enum("CHECK_IN", "CHECK_OUT", name="marktype")
mark_source_enum = sa.Enum("WEB", "MOBILE", "TABLET", "TERMINAL", "API", name="marksource")
mark_status_enum = sa.Enum("VALID", "SUSPICIOUS", "REJECTED", "MANUAL", name="markstatus")
leave_type_enum = sa.Enum("VACATION", "SICK", "BUSINESS_TRIP", "DAY_OFF", "OTHER", name="leavetype")
leave_status_enum = sa.Enum("PENDING", "APPROVED", "REJECTED", "CANCELLED", name="leavestatus")
subscription_plan_enum = sa.Enum(
    "STARTER",
    "BUSINESS_25",
    "BUSINESS_50",
    "PROFESSIONAL_100",
    "ENTERPRISE",
    name="subscriptionplan",
)
subscription_status_enum = sa.Enum("ACTIVE", "PAST_DUE", "CANCELLED", "TRIAL", name="subscriptionstatus")


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("bin", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("logo_url", sa.String(length=512), nullable=True),
        sa.Column("status", company_status_enum, nullable=False),
        sa.Column("plan", sa.String(length=64), nullable=False),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_company_id", "users", ["company_id"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["departments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_departments_company_id", "departments", ["company_id"])

    op.create_table(
        "positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_positions_company_id", "positions", ["company_id"])

    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("position_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("iin", sa.String(length=32), nullable=True),
        sa.Column("employee_code", sa.String(length=64), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("employment_status", employment_status_enum, nullable=False),
        sa.Column("hired_at", sa.Date(), nullable=True),
        sa.Column("fired_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["manager_id"], ["employees.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employees_company_id", "employees", ["company_id"])
    op.create_index("ix_employees_user_id", "employees", ["user_id"])
    op.create_index("ix_employees_department_id", "employees", ["department_id"])
    op.create_index("ix_employees_position_id", "employees", ["position_id"])
    op.create_index("ix_employees_manager_id", "employees", ["manager_id"])

    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=512), nullable=False),
        sa.Column("lat", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("lng", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("radius_meters", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_locations_company_id", "locations", ["company_id"])

    op.create_table(
        "work_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("lunch_start", sa.Time(), nullable=True),
        sa.Column("lunch_end", sa.Time(), nullable=True),
        sa.Column("days_of_week", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("late_tolerance_minutes", sa.Integer(), nullable=False),
        sa.Column("overtime_threshold_minutes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_work_schedules_company_id", "work_schedules", ["company_id"])

    op.create_table(
        "employee_schedule_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("work_schedule_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["work_schedule_id"], ["work_schedules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "work_schedule_id", "valid_from", name="uq_employee_schedule_assignment"),
    )
    op.create_index("ix_employee_schedule_assignments_employee_id", "employee_schedule_assignments", ["employee_id"])
    op.create_index("ix_employee_schedule_assignments_work_schedule_id", "employee_schedule_assignments", ["work_schedule_id"])

    op.create_table(
        "attendance_marks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", mark_type_enum, nullable=False),
        sa.Column("source", mark_source_enum, nullable=False),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("server_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("lat", sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column("lng", sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column("accuracy_meters", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("photo_url", sa.String(length=512), nullable=True),
        sa.Column("face_match_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("liveness_passed", sa.Boolean(), nullable=True),
        sa.Column("is_inside_geofence", sa.Boolean(), nullable=False),
        sa.Column("distance_to_location_meters", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("is_late", sa.Boolean(), nullable=False),
        sa.Column("late_minutes", sa.Integer(), nullable=False),
        sa.Column("is_early_leave", sa.Boolean(), nullable=False),
        sa.Column("early_leave_minutes", sa.Integer(), nullable=False),
        sa.Column("status", mark_status_enum, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attendance_marks_company_id", "attendance_marks", ["company_id"])
    op.create_index("ix_attendance_marks_employee_id", "attendance_marks", ["employee_id"])

    op.create_table(
        "leave_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", leave_type_enum, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("status", leave_status_enum, nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approver_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leave_requests_company_id", "leave_requests", ["company_id"])
    op.create_index("ix_leave_requests_employee_id", "leave_requests", ["employee_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("entity_type", sa.String(length=128), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_company_id", "audit_logs", ["company_id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan", subscription_plan_enum, nullable=False),
        sa.Column("max_employees", sa.Integer(), nullable=False),
        sa.Column("price_monthly", sa.Integer(), nullable=False),
        sa.Column("price_yearly", sa.Integer(), nullable=False),
        sa.Column("status", subscription_status_enum, nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscriptions_company_id", "subscriptions", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_subscriptions_company_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_company_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_leave_requests_employee_id", table_name="leave_requests")
    op.drop_index("ix_leave_requests_company_id", table_name="leave_requests")
    op.drop_table("leave_requests")
    op.drop_index("ix_attendance_marks_employee_id", table_name="attendance_marks")
    op.drop_index("ix_attendance_marks_company_id", table_name="attendance_marks")
    op.drop_table("attendance_marks")
    op.drop_index("ix_employee_schedule_assignments_work_schedule_id", table_name="employee_schedule_assignments")
    op.drop_index("ix_employee_schedule_assignments_employee_id", table_name="employee_schedule_assignments")
    op.drop_table("employee_schedule_assignments")
    op.drop_index("ix_work_schedules_company_id", table_name="work_schedules")
    op.drop_table("work_schedules")
    op.drop_index("ix_locations_company_id", table_name="locations")
    op.drop_table("locations")
    op.drop_index("ix_employees_manager_id", table_name="employees")
    op.drop_index("ix_employees_position_id", table_name="employees")
    op.drop_index("ix_employees_department_id", table_name="employees")
    op.drop_index("ix_employees_user_id", table_name="employees")
    op.drop_index("ix_employees_company_id", table_name="employees")
    op.drop_table("employees")
    op.drop_index("ix_positions_company_id", table_name="positions")
    op.drop_table("positions")
    op.drop_index("ix_departments_company_id", table_name="departments")
    op.drop_table("departments")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_company_id", table_name="users")
    op.drop_table("users")
    op.drop_table("companies")

    bind = op.get_bind()
    subscription_status_enum.drop(bind, checkfirst=True)
    subscription_plan_enum.drop(bind, checkfirst=True)
    leave_status_enum.drop(bind, checkfirst=True)
    leave_type_enum.drop(bind, checkfirst=True)
    mark_status_enum.drop(bind, checkfirst=True)
    mark_source_enum.drop(bind, checkfirst=True)
    mark_type_enum.drop(bind, checkfirst=True)
    employment_status_enum.drop(bind, checkfirst=True)
    company_status_enum.drop(bind, checkfirst=True)
    role_enum.drop(bind, checkfirst=True)
