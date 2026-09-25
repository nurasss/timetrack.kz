from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SettingsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    language: str = Field(default="ru", min_length=2, max_length=16)
    timezone: str = Field(default="Asia/Almaty", min_length=1, max_length=64)
    require_photo_on_mark: bool = True
    require_geolocation: bool = True
    allow_offline_marks: bool = True
    late_tolerance_minutes: int = Field(default=10, ge=0, le=240)
    photo_retention_days: int = Field(default=90, ge=1, le=3650)
    mark_editing_enabled: bool = False

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("timezone must be a valid IANA timezone") from exc
        return value


class SettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    language: str | None = Field(default=None, min_length=2, max_length=16)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    require_photo_on_mark: bool | None = None
    require_geolocation: bool | None = None
    allow_offline_marks: bool | None = None
    late_tolerance_minutes: int | None = Field(default=None, ge=0, le=240)
    photo_retention_days: int | None = Field(default=None, ge=1, le=3650)
    mark_editing_enabled: bool | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("timezone must be a valid IANA timezone") from exc
        return value

    @model_validator(mode="after")
    def reject_null_values(self):
        for field_name in self.__class__.model_fields:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self
