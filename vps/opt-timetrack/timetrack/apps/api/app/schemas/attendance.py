from datetime import datetime
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import MarkSource, MarkStatus, MarkType
from app.schemas.common import OrmModel


class MarkInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    location_id: UUID | None = None
    marked_at: datetime | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    accuracy_meters: float | None = Field(default=None, ge=0, le=10_000)
    source: MarkSource = MarkSource.WEB
    photo_url: str | None = Field(default=None, min_length=1, max_length=512)
    face_match_score: float | None = Field(default=None, ge=0, le=1)
    liveness_passed: bool | None = None
    offline: bool = False
    is_offline: bool | None = None
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=128)
    client_event_id: str | None = Field(default=None, min_length=1, max_length=128)
    client_mark_id: str | None = Field(default=None, min_length=1, max_length=128)
    idempotency_metadata: dict[str, object] | None = None
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("marked_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("marked_at must include a timezone")
        return value

    @field_validator("photo_url")
    @classmethod
    def validate_photo_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("photo_url must be an http or https URL")
        return value

    @field_validator("idempotency_metadata")
    @classmethod
    def validate_metadata(cls, value: dict[str, object] | None) -> dict[str, object] | None:
        if value is None:
            return None
        if len(value) > 32:
            raise ValueError("idempotency_metadata contains too many fields")
        for key, item in value.items():
            if len(key) > 64 or len(str(item)) > 512:
                raise ValueError("idempotency_metadata field is too long")
        return value

    @model_validator(mode="after")
    def validate_offline_fields(self):
        offline = self.offline or bool(self.is_offline)
        if self.offline and self.is_offline is False:
            raise ValueError("offline and is_offline cannot contradict each other")
        if offline and self.marked_at is None:
            raise ValueError("offline marks require marked_at")
        client_ids = {value for value in (self.idempotency_key, self.client_event_id, self.client_mark_id) if value is not None}
        if len(client_ids) > 1:
            raise ValueError("idempotency identifiers must match when provided")
        return self


class SelfMarkCreate(MarkInput):
    employee_id: UUID | None = None


class ManualMarkCreate(MarkInput):
    employee_id: UUID
    type: MarkType = MarkType.CHECK_IN


class MarkCreate(ManualMarkCreate):
    pass


class MarkOut(OrmModel):
    id: UUID
    company_id: UUID
    employee_id: UUID
    employee: str | None = None
    location_id: UUID | None
    location: str | None = None
    type: MarkType
    source: MarkSource
    marked_at: datetime
    server_at: datetime
    accuracy_meters: float | None
    lat: float | None = None
    lng: float | None = None
    photo_url: str | None = None
    face_match_score: float | None = None
    liveness_passed: bool | None = None
    is_inside_geofence: bool
    distance_to_location_meters: float | None
    is_late: bool
    late_minutes: int
    is_early_leave: bool
    early_leave_minutes: int
    status: MarkStatus
