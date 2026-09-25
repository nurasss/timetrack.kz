from collections.abc import Iterable
from uuid import UUID

from app.models import Role, User

PRIVILEGED_ROLES = (Role.COMPANY_ADMIN, Role.HR, Role.MANAGER)
SELF_SERVICE_ROLES = (Role.EMPLOYEE,)

PERMISSIONS: dict[Role, frozenset[str]] = {
    Role.SUPER_ADMIN: frozenset({"*"}),
    Role.COMPANY_ADMIN: frozenset(
        {
            "employees:read",
            "employees:write",
            "employees:delete",
            "locations:read",
            "locations:write",
            "schedules:read",
            "schedules:write",
            "marks:read",
            "marks:write",
            "marks:approve",
            "requests:read",
            "requests:write",
            "requests:approve",
            "settings:read",
            "settings:write",
            "timesheet:read",
            "timesheet:export",
            "reports:read",
            "reports:export",
        }
    ),
    Role.HR: frozenset(
        {
            "employees:read",
            "employees:write",
            "employees:delete",
            "locations:read",
            "locations:write",
            "schedules:read",
            "schedules:write",
            "marks:read",
            "marks:write",
            "marks:approve",
            "requests:read",
            "requests:write",
            "requests:approve",
            "settings:read",
            "settings:write",
            "timesheet:read",
            "timesheet:export",
            "reports:read",
            "reports:export",
        }
    ),
    Role.MANAGER: frozenset(
        {
            "employees:read",
            "employees:write",
            "employees:delete",
            "locations:read",
            "locations:write",
            "schedules:read",
            "schedules:write",
            "marks:read",
            "marks:write",
            "marks:approve",
            "requests:read",
            "requests:write",
            "requests:approve",
            "settings:read",
            "settings:write",
            "timesheet:read",
            "timesheet:export",
            "reports:read",
            "reports:export",
        }
    ),
    Role.EMPLOYEE: frozenset({"self:attendance", "self:requests"}),
}


def normalize_role(role: Role | str | None) -> Role | None:
    if role is None:
        return None
    if isinstance(role, Role):
        return role
    try:
        return Role(str(role))
    except ValueError:
        return None


def has_permission(role: Role | str | None, permission: str) -> bool:
    normalized = normalize_role(role)
    if normalized is None:
        return False
    permissions = PERMISSIONS[normalized]
    return "*" in permissions or permission in permissions


def is_privileged(role: Role | str | None) -> bool:
    normalized = normalize_role(role)
    return normalized in PRIVILEGED_ROLES or normalized == Role.SUPER_ADMIN


def is_self_service(role: Role | str | None) -> bool:
    normalized = normalize_role(role)
    return normalized in SELF_SERVICE_ROLES


def can_access_employee(user: User, employee: object) -> bool:
    if is_privileged(user.role):
        return True
    return getattr(employee, "user_id", None) == user.id


def can_manage_employee(user: User, employee: object) -> bool:
    return is_privileged(user.role) and can_access_employee(user, employee)


def can_approve_for(user: User, employee: object) -> bool:
    return is_privileged(user.role) and getattr(employee, "user_id", None) != user.id


def can_view_request(user: User, employee: object) -> bool:
    return can_access_employee(user, employee)


def can_cancel_request(user: User, employee: object) -> bool:
    return can_access_employee(user, employee)


def role_matrix() -> dict[str, list[str]]:
    return {role.value: sorted(permissions) for role, permissions in PERMISSIONS.items()}


def employee_ids_for_user(users: Iterable[User], user_id: UUID) -> list[UUID]:
    return [user.id for user in users if user.id == user_id]
