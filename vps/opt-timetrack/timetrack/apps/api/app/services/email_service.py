import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_verification_code(email: str, code: str) -> bool:
    return await send_code_email(
        email,
        code,
        "Код подтверждения Timetrack.kz",
        "Ваш код подтверждения Timetrack.kz",
    )


async def send_password_reset_code(email: str, code: str) -> bool:
    return await send_code_email(
        email,
        code,
        "Восстановление пароля Timetrack.kz",
        "Ваш код для восстановления пароля Timetrack.kz",
    )


async def send_code_email(email: str, code: str, subject: str, intro: str) -> bool:
    if not settings.smtp_host:
        logger.error("SMTP is not configured")
        return False

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = email
    message["Subject"] = subject
    message.set_content(
        "\n".join(
            [
                "Здравствуйте!",
                "",
                f"{intro}: {code}",
                f"Код действует {settings.email_code_ttl_minutes} минут.",
                "",
                "Если вы не запрашивали это действие, просто игнорируйте это письмо.",
            ]
        )
    )

    await asyncio.to_thread(_send_message, message)
    return True


def _send_message(message: EmailMessage) -> None:
    if not settings.smtp_host:
        raise RuntimeError("SMTP is not configured")
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls(context=context)
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
