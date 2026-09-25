# Timetrack.kz — Frontend MVP

> B2B SaaS-сервис учёта рабочего времени для Казахстана.  
> Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui

---

## Быстрый запуск

```bash
cd timetrack-web
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

### Тестовые аккаунты

| Email | Пароль | Роль |
|-------|--------|------|
| admin@timetrack.kz | password | Администратор |
| hr@timetrack.kz | password | HR-менеджер |
| manager@timetrack.kz | password | Руководитель |

---

## Структура проекта

```
timetrack-web/
├── app/
│   ├── page.tsx                    # Главная (лендинг)
│   ├── pricing/page.tsx            # Тарифы
│   ├── features/page.tsx           # Возможности
│   ├── contacts/page.tsx           # Контакты / форма заявки
│   ├── login/page.tsx              # Страница входа
│   └── dashboard/
│       ├── layout.tsx              # Layout с sidebar и auth guard
│       ├── page.tsx                # Главный дашборд
│       ├── employees/page.tsx      # Сотрудники
│       ├── locations/page.tsx      # Локации
│       ├── schedules/page.tsx      # Графики работы
│       ├── attendance/page.tsx     # Журнал отметок
│       ├── reports/page.tsx        # Отчёты + Excel экспорт
│       ├── leave-requests/page.tsx # Заявки на отпуск
│       └── settings/page.tsx       # Настройки
├── components/
│   ├── marketing/
│   │   ├── Header.tsx              # Хедер лендинга
│   │   └── Footer.tsx              # Футер лендинга
│   ├── dashboard/
│   │   └── Sidebar.tsx             # Сайдбар дашборда
│   └── shared/
│       └── index.tsx               # Общие компоненты (badges, loaders)
├── lib/
│   ├── types/index.ts              # TypeScript типы всех сущностей
│   ├── mock/data.ts                # Mock-данные (25 сотрудников, 120 отметок)
│   ├── api/mock-service.ts         # Mock API (заменить на Axios при подключении backend)
│   ├── auth/store.ts               # Zustand auth store (persist)
│   └── utils/index.ts              # Утилиты (форматирование, cn())
└── docs/
    ├── openapi.yaml                # OpenAPI 3.0 спецификация
    └── api-contract.md             # API контракт для мобильной команды
```

---

## Что уже работает

### Маркетинговый сайт
- ✅ **Главная** — Hero, преимущества, как работает, для кого, CTA
- ✅ **Тарифы** — 4 плана + Enterprise, доп. услуги, FAQ
- ✅ **Возможности** — 10 секций с иконками и описаниями
- ✅ **Контакты** — форма с валидацией, mock-отправка (localStorage + toast)

### Авторизация
- ✅ Mock-логин (3 тестовых аккаунта)
- ✅ Zustand store с persist в localStorage
- ✅ Auth guard на dashboard routes

### Дашборд
- ✅ **Главная** — 6 stat-карточек, AreaChart, BarChart, таблица последних отметок
- ✅ **Сотрудники** — таблица, поиск, фильтры по отделу/статусу, добавить/редактировать/деактивировать
- ✅ **Локации** — карточки локаций, добавить/редактировать/удалить, map placeholder
- ✅ **Графики** — карточки с визуализацией дней и времени, день-пикер, create/edit/delete
- ✅ **Журнал отметок** — таблица с фильтрами (дата, сотрудник, локация, статус, тип), detail modal
- ✅ **Отчёты** — табель (scrollable таблица), отчёт по опозданиям, переработкам, отсутствиям + Excel экспорт (SheetJS)
- ✅ **Заявки на отпуск** — карточки с approve/reject actions, создание заявки, фильтрация
- ✅ **Настройки** — компания, роли, язык (RU/KZ), политика фото, API ключи, интеграции

### Данные
- ✅ 1 компания (ТОО «Алтын Логистик»)
- ✅ 25 сотрудников с казахстанскими именами
- ✅ 4 отдела
- ✅ 3 локации (Алматы офис, Алматы склад, Астана филиал)
- ✅ 3 графика работы
- ✅ 120+ отметок за 14 дней
- ✅ 5 заявок на отпуск/больничный/командировку

### API контракт
- ✅ `docs/openapi.yaml` — полная OpenAPI 3.0 спецификация
- ✅ `docs/api-contract.md` — подробный контракт для мобильной команды

---

## Что осталось сделать (следующие этапы)

### Backend
- [ ] REST API на Node.js (Fastify/Express) или Go
- [ ] PostgreSQL с миграциями (Prisma / Drizzle)
- [ ] JWT + Refresh token rotation
- [ ] Геофенсинг на сервере (haversine formula)
- [ ] Redis для сессий и rate limiting
- [ ] S3-совместимое хранилище для фото (Yandex Cloud Object Storage / MinIO)

### Мобильное приложение
- [ ] Android (Kotlin) — отдельная команда, API контракт готов
- [ ] iOS (Swift) — при необходимости

### Frontend доработки
- [ ] Реальная карта для локаций (Yandex Maps JS API или Google Maps)
- [ ] Импорт сотрудников из Excel (UI готов, нужен парсер)
- [ ] PDF экспорт табеля (placeholder готов)
- [ ] Пагинация с server-side
- [ ] Уведомления в real-time (WebSocket / SSE)
- [ ] i18n KZ — структура подготовлена, нужен перевод
- [ ] Drag-and-drop для назначения графиков

### Интеграции (в плане)
- [ ] 1С:Бухгалтерия — экспорт табеля
- [ ] Bitrix24 — синхронизация сотрудников
- [ ] Hikvision — биометрические терминалы
- [ ] Telegram Bot — уведомления
- [ ] Webhook — события в реальном времени

### Enterprise
- [ ] Биометрический шаблон лица
- [ ] Мультикомпанийность
- [ ] SLA-дашборд
- [ ] Kaspi Pay / CloudPayments для биллинга

---

## Как заменить mock на реальный backend

1. Создать `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=https://api.timetrack.kz/v1
   ```

2. Создать `lib/api/client.ts` с настроенным Axios:
   ```ts
   import axios from 'axios';

   export const apiClient = axios.create({
     baseURL: process.env.NEXT_PUBLIC_API_URL,
   });

   // Интерсептор для токена
   apiClient.interceptors.request.use(config => {
     const token = localStorage.getItem('access_token');
     if (token) config.headers.Authorization = `Bearer ${token}`;
     return config;
   });

   // Интерсептор для refresh
   apiClient.interceptors.response.use(
     res => res,
     async err => {
       if (err.response?.status === 401) {
         // TODO: refresh token logic
       }
       return Promise.reject(err);
     }
   );
   ```

3. Заменить функции в `lib/api/mock-service.ts` на вызовы `apiClient`.  
   Сигнатуры остаются теми же — компоненты не нужно менять.

---

## Стек технологий

| Категория | Библиотека |
|-----------|-----------|
| Framework | Next.js 14 App Router |
| Язык | TypeScript |
| Стили | Tailwind CSS |
| Компоненты | shadcn/ui + Radix UI |
| Формы | React Hook Form + Zod |
| Графики | Recharts |
| Таблицы | TanStack Table (в отчётах) |
| Запросы | Fetch (mock), готово под React Query |
| Состояние | Zustand (auth) |
| Даты | date-fns + ru locale |
| Excel | SheetJS (xlsx) |
| Уведомления | sonner |

---

## Дизайн-система

Цветовые токены (Tailwind):

```
brand-* — Indigo (#4f46e5) — основной
cyan-*  — Cyan (#0891b2) — акцент, градиент
emerald-* — Success, check-in OK
amber-*   — Предупреждения, опоздания
red-*     — Ошибки, check-out, удаление
slate-*   — Нейтральный фон и текст
```

---

*Timetrack.kz MVP — июнь 2026*
