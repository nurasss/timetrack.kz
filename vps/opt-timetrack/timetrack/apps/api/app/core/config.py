import secrets

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://localhost:5432/timetrack"
    redis_url: str | None = "redis://localhost:6379/0"
    jwt_secret: str | None = None
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30
    app_env: str = "development"
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    default_timezone: str = "Asia/Almaty"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    minio_endpoint: str = "minio:9000"
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_bucket: str = "timetrack-files"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "no-reply@timetrack.kz"
    smtp_use_tls: bool = True
    email_code_ttl_minutes: int = 10
    auth_rate_limit_per_window: int = 20
    auth_rate_limit_window_seconds: int = 60
    verification_rate_limit_per_window: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        environment = self.app_env.strip().lower()
        if not self.jwt_secret:
            if environment in {"production", "prod"}:
                raise ValueError("JWT_SECRET must be configured in production")
            self.jwt_secret = secrets.token_urlsafe(48)
        elif len(self.jwt_secret.encode("utf-8")) < 32:
            raise ValueError("JWT_SECRET must contain at least 32 bytes")

        if self.jwt_algorithm not in {"HS256", "HS384", "HS512"}:
            raise ValueError("JWT_ALGORITHM must be an HMAC SHA-2 algorithm")
        if not 1 <= self.jwt_access_token_expire_minutes <= 60:
            raise ValueError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be between 1 and 60")
        if not 1 <= self.jwt_refresh_token_expire_days <= 90:
            raise ValueError("JWT_REFRESH_TOKEN_EXPIRE_DAYS must be between 1 and 90")
        if not 1 <= self.email_code_ttl_minutes <= 60:
            raise ValueError("EMAIL_CODE_TTL_MINUTES must be between 1 and 60")
        if self.auth_rate_limit_per_window < 1 or self.auth_rate_limit_window_seconds < 1:
            raise ValueError("Authentication rate limit values must be positive")
        if self.verification_rate_limit_per_window < 1:
            raise ValueError("Verification rate limit values must be positive")

        origins = self.cors_origin_list
        if "*" in origins:
            raise ValueError("Wildcard CORS origins cannot be used with credentials")
        if environment in {"production", "prod"}:
            if not origins or any(not origin.startswith("https://") for origin in origins):
                raise ValueError("Production CORS origins must be explicit HTTPS origins")
            if self.smtp_host and not self.smtp_use_tls:
                raise ValueError("SMTP STARTTLS must be enabled in production")

        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
