from fastapi import APIRouter

from app.api.v1 import (
    auth,
    companies,
    dashboard,
    employees,
    locations,
    marks,
    reports,
    requests,
    schedules,
    settings,
    timesheet,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(companies.router, prefix="/company", tags=["company"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(marks.router, prefix="/marks", tags=["marks"])
api_router.include_router(timesheet.router, prefix="/timesheet", tags=["timesheet"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(requests.router, prefix="/requests", tags=["requests"])
api_router.include_router(requests.router, prefix="/leave-requests", tags=["requests"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])

