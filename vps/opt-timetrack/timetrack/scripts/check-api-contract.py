#!/usr/bin/env python3
"""Fail if the Next admin client calls FastAPI routes or methods that do not exist."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.main import app  # noqa: E402

CALL = re.compile(r"api\.(get|post|patch|put|delete)\(\s*[`'\"]([^`'\"]+)[`'\"]")
TEMPLATE = re.compile(r"\$\{[^}]+\}")


def normalize(path: str) -> str:
    normalized = TEMPLATE.sub("{id}", path)
    normalized = re.sub(r"\{[^}]+\}", "{param}", normalized)
    if not normalized.startswith("/api/v1/"):
        normalized = f"/api/v1{normalized if normalized.startswith('/') else '/' + normalized}"
    return normalized


def main() -> int:
    service = (ROOT / "apps" / "admin" / "lib" / "api" / "service.ts").read_text(encoding="utf-8")
    openapi_paths = {normalize(path): {method.upper() for method in methods} for path, methods in app.openapi()["paths"].items()}
    errors = []
    for method, path in CALL.findall(service):
        normalized = normalize(path)
        allowed = openapi_paths.get(normalized)
        if allowed is None:
            errors.append(f"missing route: {method.upper()} {path}")
        elif method.upper() not in allowed:
            errors.append(f"missing method: {method.upper()} {path} (available: {sorted(allowed)})")
    if errors:
        print("\n".join(errors))
        return 1
    print(f"admin API contract OK: {len(CALL.findall(service))} calls")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
