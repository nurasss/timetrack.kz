from uuid import UUID

from pydantic import EmailStr

from app.models import Role
from app.schemas.common import OrmModel


class UserOut(OrmModel):
    id: UUID
    company_id: UUID | None
    email: EmailStr
    phone: str | None
    role: Role
    full_name: str
    avatar_url: str | None
    is_active: bool

