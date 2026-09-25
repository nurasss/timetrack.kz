import asyncio
import hashlib
import time
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, Request, status

from app.core.config import settings

try:
    from redis import asyncio as redis_asyncio
    from redis.exceptions import RedisError
except ImportError:
    redis_asyncio = None

    class RedisError(Exception):
        pass


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after: int


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._values: dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def hit(self, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        now = int(time.time())
        window = now // window_seconds
        bucket = f"{key}:{window}"
        async with self._lock:
            count = self._values.get(bucket, 0) + 1
            self._values[bucket] = count
            if len(self._values) > 10_000:
                self._values = {item_key: value for item_key, value in self._values.items() if item_key.endswith(f":{window}")}
        return RateLimitDecision(count <= limit, max(1, window_seconds - (now % window_seconds)))

    async def clear(self) -> None:
        async with self._lock:
            self._values.clear()


class RateLimiter:
    _redis_script = """
    local value = redis.call('INCR', KEYS[1])
    if value == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return value
    """

    def __init__(self) -> None:
        self._memory = InMemoryRateLimiter()
        self._redis: Any | None = None
        self._redis_disabled = False
        self._redis_lock = asyncio.Lock()

    async def _get_redis(self) -> Any | None:
        if self._redis_disabled or redis_asyncio is None or not settings.redis_url:
            return None
        if self._redis is not None:
            return self._redis
        async with self._redis_lock:
            if self._redis is not None:
                return self._redis
            if self._redis_disabled or redis_asyncio is None or not settings.redis_url:
                return None
            try:
                client = redis_asyncio.Redis.from_url(
                    settings.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=0.2,
                    socket_timeout=0.2,
                )
                await client.ping()
            except (OSError, RedisError, TimeoutError):
                self._redis_disabled = True
                return None
            self._redis = client
            return client

    async def hit(self, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        if limit < 1 or window_seconds < 1:
            raise ValueError("Invalid rate limit")
        client = await self._get_redis()
        if client is None:
            if settings.app_env == "production":
                raise HTTPException(status_code=503, detail="Rate limiting is unavailable")
            return await self._memory.hit(key, limit, window_seconds)
        now = int(time.time())
        window = now // window_seconds
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        redis_key = f"timetrack:rate-limit:{window}:{digest}"
        try:
            value = int(await client.eval(self._redis_script, 1, redis_key, window_seconds))
        except (OSError, RedisError, TimeoutError) as exc:
            self._redis_disabled = True
            self._redis = None
            if settings.app_env == "production":
                raise HTTPException(status_code=503, detail="Rate limiting is unavailable") from exc
            return await self._memory.hit(key, limit, window_seconds)
        return RateLimitDecision(value <= limit, max(1, window_seconds - (now % window_seconds)))

    async def clear(self) -> None:
        await self._memory.clear()
        self._redis_disabled = False
        self._redis = None


rate_limiter = RateLimiter()


async def enforce_rate_limit(action: str, request: Request, identifier: str | None = None) -> None:
    client_host = request.client.host if request.client else "unknown"
    limit = settings.verification_rate_limit_per_window if action in {"verify", "reset"} else settings.auth_rate_limit_per_window
    window = settings.auth_rate_limit_window_seconds
    ip_key = f"{action}:ip:{client_host}"
    decisions = [await rate_limiter.hit(ip_key, max(limit * 20, 200), window)]
    if identifier:
        normalized = identifier.strip().lower()
        decisions.append(await rate_limiter.hit(f"{action}:identity:{normalized}", limit, window))
    denied = next((decision for decision in decisions if not decision.allowed), None)
    if denied:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests",
            headers={"Retry-After": str(denied.retry_after)},
        )
