import asyncio
import os
import secrets
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Company, CompanyStatus, Role, User


async def seed() -> None:
    async with SessionLocal() as session:
        existing = await session.scalar(select(User).where(User.email == "admin@timetrack.kz"))
        if existing:
            print("Admin user already exists")
            return

        company = Company(
            name="Компания",
            status=CompanyStatus.ACTIVE,
            plan="STARTER",
            settings={
                "language": "ru",
                "timezone": "Asia/Almaty",
                "require_photo_on_mark": True,
                "require_geolocation": True,
                "allow_offline_marks": True,
                "late_tolerance_minutes": 10,
                "photo_retention_days": 90,
                "mark_editing_enabled": False,
            },
        )
        session.add(company)
        await session.flush()

        password = os.environ.get("ADMIN_SEED_PASSWORD")
        generated = False
        if not password:
            password = secrets.token_urlsafe(20)
            generated = True
        session.add(
            User(
                company_id=company.id,
                email="admin@timetrack.kz",
                password_hash=hash_password(password),
                role=Role.COMPANY_ADMIN,
                full_name="Администратор",
                email_verified_at=datetime.now(UTC),
            )
        )

        await session.commit()
        print("Admin user created")
        if generated:
            print("ADMIN_SEED_PASSWORD was not set; generated one-time bootstrap password:")
            print(password)


if __name__ == "__main__":
    asyncio.run(seed())
