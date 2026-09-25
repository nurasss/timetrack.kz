from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models import Company


def resolve_timezone(value: str | None) -> ZoneInfo:
    if not value:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def company_timezone(company: Company) -> ZoneInfo:
    settings = company.settings or {}
    return resolve_timezone(settings.get("timezone") or company.timezone)
