from fastapi import APIRouter, Depends

from app.core.deps import current_user
from app.models import User
from app.schemas.user import UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return user

