from app.models import Role, User

ADMIN_ROLES = frozenset({Role.SUPER_ADMIN, Role.COMPANY_ADMIN})
HR_ROLES = frozenset(ADMIN_ROLES | {Role.HR})
MANAGER_ROLES = frozenset(HR_ROLES | {Role.MANAGER})
EMPLOYEE_ROLES = frozenset(MANAGER_ROLES | {Role.EMPLOYEE})


def has_any_role(user: User, roles: frozenset[Role]) -> bool:
    return user.role in roles


def is_admin(user: User) -> bool:
    return has_any_role(user, ADMIN_ROLES)


def is_hr(user: User) -> bool:
    return has_any_role(user, HR_ROLES)


def is_manager(user: User) -> bool:
    return has_any_role(user, MANAGER_ROLES)


def is_employee(user: User) -> bool:
    return has_any_role(user, EMPLOYEE_ROLES)
