import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


pytestmark = pytest.mark.asyncio


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def auth_headers(client: AsyncClient) -> dict[str, str]:
    response = await client.post("/api/v1/auth/login", json={"email": "admin@timetrack.kz", "password": "123456"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def test_login_success():
    async with client() as api:
        response = await api.post("/api/v1/auth/login", json={"email": "admin@timetrack.kz", "password": "123456"})
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "COMPANY_ADMIN"


async def test_login_wrong_password():
    async with client() as api:
        response = await api.post("/api/v1/auth/login", json={"email": "admin@timetrack.kz", "password": "wrong"})
    assert response.status_code == 401


async def test_get_me():
    async with client() as api:
        headers = await auth_headers(api)
        response = await api.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "admin@timetrack.kz"


async def test_company_isolation():
    async with client() as api:
        headers = await auth_headers(api)
        response = await api.get("/api/v1/employees", headers=headers)
    assert response.status_code == 200
    assert all(item["company_id"] for item in response.json()["items"])


async def test_create_employee():
    async with client() as api:
        headers = await auth_headers(api)
        response = await api.post("/api/v1/employees", headers=headers, json={"full_name": "Тестовый Сотрудник"})
    assert response.status_code == 200
    assert response.json()["full_name"] == "Тестовый Сотрудник"


async def test_create_location():
    async with client() as api:
        headers = await auth_headers(api)
        response = await api.post(
            "/api/v1/locations",
            headers=headers,
            json={"name": "Тест офис", "address": "Алматы", "lat": 43.238949, "lng": 76.889709, "radius_meters": 100},
        )
    assert response.status_code == 200
    assert response.json()["name"] == "Тест офис"


async def test_check_in_geofence_success():
    async with client() as api:
        headers = await auth_headers(api)
        employees = (await api.get("/api/v1/employees", headers=headers)).json()["items"]
        locations = (await api.get("/api/v1/locations", headers=headers)).json()
        response = await api.post(
            "/api/v1/marks/check-in",
            headers=headers,
            json={
                "employee_id": employees[0]["id"],
                "location_id": locations[0]["id"],
                "marked_at": "2026-06-17T08:56:00+05:00",
                "lat": locations[0]["lat"],
                "lng": locations[0]["lng"],
                "accuracy_meters": 12,
                "source": "WEB",
            },
        )
    assert response.status_code == 200
    assert response.json()["is_inside_geofence"] is True


async def test_check_in_outside_geofence_suspicious():
    async with client() as api:
        headers = await auth_headers(api)
        employees = (await api.get("/api/v1/employees", headers=headers)).json()["items"]
        locations = (await api.get("/api/v1/locations", headers=headers)).json()
        response = await api.post(
            "/api/v1/marks/check-in",
            headers=headers,
            json={
                "employee_id": employees[0]["id"],
                "location_id": locations[0]["id"],
                "marked_at": "2026-06-17T08:56:00+05:00",
                "lat": 40.0,
                "lng": 70.0,
                "accuracy_meters": 12,
                "source": "WEB",
            },
        )
    assert response.status_code == 200
    assert response.json()["status"] == "SUSPICIOUS"


async def test_dashboard_summary():
    async with client() as api:
        headers = await auth_headers(api)
        response = await api.get("/api/v1/dashboard/summary", headers=headers)
    assert response.status_code == 200
    assert "total_employees" in response.json()
