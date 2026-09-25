from datetime import datetime

from fastapi import HTTPException


CONSENT_VERSION = "privacy-20260924.1"


def normalize_consent(value: object | None) -> dict[str, str] | None:
    if not isinstance(value, dict):
        return None
    granted_at = value.get("granted_at")
    version = value.get("version")
    try:
        parsed = datetime.fromisoformat(str(granted_at)) if granted_at else None
    except ValueError:
        return None
    if value.get("granted") is not True or parsed is None or value.get("revoked_at"):
        return None
    return {"granted": True, "version": str(version or CONSENT_VERSION)[:64], "granted_at": parsed.isoformat()}


def require_biometric_consent(consent_value: object | None, *, has_biometric_data: bool) -> None:
    if not has_biometric_data:
        return
    if normalize_consent(consent_value) is None:
        raise HTTPException(status_code=422, detail="Biometric consent is required before storing face data")
