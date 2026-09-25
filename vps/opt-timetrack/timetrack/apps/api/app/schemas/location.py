from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import OrmModel


class LocationInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LocationIn(LocationInput):
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=512)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    radius_meters: int = Field(default=100, ge=1, le=100_000)
    is_active: bool = True


class LocationPatch(LocationInput):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, min_length=1, max_length=512)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    radius_meters: int | None = Field(default=None, ge=1, le=100_000)
    is_active: bool | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field_name in ("name", "address", "lat", "lng"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class LocationOut(OrmModel):
    id: UUID
    company_id: UUID
    name: str
    address: str
    lat: float
    lng: float
    radius_meters: int
    is_active: bool
