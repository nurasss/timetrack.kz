# Timetrack.kz MVP

Timetrack.kz is a B2B SaaS MVP for employee time tracking in Kazakhstan. The repo now contains a Next.js admin/web app and a real FastAPI backend with PostgreSQL, JWT auth, tenant isolation, seed data, reports, timesheet, requests and attendance marks.

## Structure

```txt
apps/
  admin/   Next.js 14 + TypeScript + Tailwind admin/web UI
  api/     FastAPI + SQLAlchemy 2 async backend
  mobile/  Existing Expo prototype
packages/
  shared/  Shared UI prototype data/types kept for fallback/dev
infra/
  docker-compose.yml
```

## Run

```bash
cp .env.example .env
docker compose up --build
docker compose exec api alembic upgrade head
docker compose exec api python -m app.seed
```

URLs:

```txt
Web:     http://localhost:3000
API:     http://localhost:8000
Swagger: http://localhost:8000/docs
MinIO:   http://localhost:9001
```

Demo access:

```txt
URL: http://localhost:3000/login
Email: admin@timetrack.kz
Password: 123456
```

## API Highlights

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/register-company`
- `GET/PATCH /api/v1/company/me`
- `GET/POST/PATCH/DELETE /api/v1/employees`
- `GET/POST/PATCH/DELETE /api/v1/locations`
- `GET /api/v1/marks`
- `POST /api/v1/marks/check-in`
- `POST /api/v1/marks/check-out`
- `GET /api/v1/timesheet?month=2026-06`
- `GET /api/v1/dashboard/summary`
- `GET/POST /api/v1/requests`

## Development

Backend:

```bash
cd apps/api
pip install -e ".[test]"
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
npm install
npm run dev:admin
```

## Notes

- Passwords are stored with bcrypt hashes.
- Access and refresh tokens are JWT-based.
- All tenant data endpoints scope reads/writes by `company_id`.
- Important actions write audit logs.
- Mock data remains only as a frontend fallback and historical prototype material; seed data is created in PostgreSQL.

