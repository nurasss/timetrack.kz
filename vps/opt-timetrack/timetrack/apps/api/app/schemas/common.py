from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel):
    total: int
    page: int
    limit: int


class IdResponse(BaseModel):
    id: UUID
    created_at: datetime | None = None

