# Timetrack.kz — API Contract для мобильного приложения

> Версия: 1.0  
> Дата: июнь 2026  
> Базовый URL (prod): `https://api.timetrack.kz/v1`  
> Полная спецификация: [`openapi.yaml`](./openapi.yaml)

---

## Обзор

Мобильное приложение взаимодействует с Timetrack.kz API по REST/JSON.  
Все запросы кроме `/auth/login` требуют заголовок:

```
Authorization: Bearer <accessToken>
```

Токены выдаются при логине, действуют **24 часа**. Обновляются через `/auth/refresh`.  
Все datetime в ISO 8601 с timezone offset: `2026-06-16T09:02:00+05:00`

---

## Эндпоинты для мобильного приложения

### 1. Авторизация

#### `POST /auth/login`

```json
// Request
{
  "email": "employee@company.kz",
  "password": "user_password"
}

// Response 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "expiresIn": 86400,
  "user": {
    "id": "user_001",
    "email": "employee@company.kz",
    "fullName": "Айдос Сейткали",
    "role": "EMPLOYEE",
    "companyId": "comp_001",
    "employeeId": "emp_003",
    "avatarUrl": null
  }
}
```

#### `POST /auth/refresh`

```json
// Request
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}

// Response 200 — такой же формат как login response
```

#### `POST /auth/logout`

```
// No body required
// Response 204
```

---

### 2. Профиль сотрудника

#### `GET /auth/me`

```json
// Response 200
{
  "id": "user_001",
  "email": "employee@company.kz",
  "fullName": "Айдос Сейткали",
  "role": "EMPLOYEE",
  "companyId": "comp_001",
  "employeeId": "emp_003",
  "avatarUrl": null
}
```

#### `GET /employees/{employeeId}`

Полный профиль с графиком и отделом:

```json
{
  "id": "emp_003",
  "fullName": "Айдос Сейткали",
  "email": "aidos@company.kz",
  "phone": "+7 705 123 4567",
  "employeeCode": "EMP-003",
  "departmentId": "dept_001",
  "position": "Менеджер по продажам",
  "workScheduleId": "sched_001",
  "status": "active",
  "hiredAt": "2024-03-15",
  "hasFaceTemplate": false
}
```

---

### 3. Локации сотрудника

#### `GET /locations?isActive=true`

Мобильное приложение получает все активные локации компании:

```json
[
  {
    "id": "loc_001",
    "name": "Офис Алматы",
    "address": "г. Алматы, пр. Достык 87",
    "lat": 43.2220,
    "lng": 76.8512,
    "radiusMeters": 100,
    "isActive": true
  },
  {
    "id": "loc_002",
    "name": "Склад №1",
    "address": "г. Алматы, ул. Рыскулова 45",
    "lat": 43.2500,
    "lng": 76.9000,
    "radiusMeters": 200,
    "isActive": true
  }
]
```

> **Логика выбора локации в приложении:**  
> Приложение определяет GPS координаты пользователя и автоматически подсвечивает ближайшую локацию, если расстояние ≤ `radiusMeters`. Пользователь подтверждает или выбирает вручную.

---

### 4. Статус отметки за сегодня

#### `GET /attendance/today?employeeId={employeeId}`

```json
{
  "date": "2026-06-16",
  "records": [
    {
      "id": "att_042",
      "employeeId": "emp_003",
      "type": "CHECK_IN",
      "markedAt": "2026-06-16T09:02:00+05:00",
      "status": "OK",
      "locationName": "Офис Алматы"
    }
  ],
  "totalPresent": 1,
  "totalLate": 0
}
```

> **Использование:**  
> Приложение показывает статус на главном экране: «Приход зафиксирован в 09:02», кнопка меняется на «Зафиксировать уход».

---

### 5. Фиксация прихода

#### `POST /attendance/check-in`

Перед check-in приложение может загрузить фото:

```
POST /files/selfie
Content-Type: multipart/form-data

file=<binary>
employeeId=emp_003
```

Ответ: `{ "id": "file_042", "url": "...", "thumbnailUrl": "..." }`

Затем основной запрос:

```json
// Request
{
  "employeeId": "emp_003",
  "locationId": "loc_001",
  "type": "CHECK_IN",
  "markedAt": "2026-06-16T09:02:00+05:00",
  "deviceTime": "2026-06-16T09:02:00+05:00",
  "lat": 43.2221,
  "lng": 76.8513,
  "accuracyMeters": 12,
  "selfieFileId": "file_042",
  "deviceInfo": {
    "platform": "android",
    "model": "Samsung Galaxy A52",
    "appVersion": "0.1.0",
    "isMockLocation": false
  },
  "offlineClientId": "550e8400-e29b-41d4-a716-446655440000"
}

// Response 200 — Успех
{
  "id": "att_042",
  "status": "OK",
  "serverAt": "2026-06-16T09:02:03+05:00",
  "isLate": false,
  "lateMinutes": 0,
  "geofence": {
    "passed": true,
    "distanceMeters": 15,
    "radiusMeters": 100
  },
  "message": "Приход успешно зафиксирован"
}

// Response 200 — Опоздание
{
  "id": "att_043",
  "status": "LATE",
  "serverAt": "2026-06-16T09:18:00+05:00",
  "isLate": true,
  "lateMinutes": 8,
  "geofence": {
    "passed": true,
    "distanceMeters": 42,
    "radiusMeters": 100
  },
  "message": "Приход зафиксирован. Опоздание 8 минут."
}

// Response 200 — Вне геозоны
{
  "id": "att_044",
  "status": "OUT_OF_GEOFENCE",
  "geofence": {
    "passed": false,
    "distanceMeters": 450,
    "radiusMeters": 100
  },
  "message": "Вы находитесь за пределами рабочей зоны (450 м от офиса)"
}
```

---

### 6. Фиксация ухода

#### `POST /attendance/check-out`

Идентичен check-in, только `"type": "CHECK_OUT"`.

```json
{
  "id": "att_045",
  "status": "OK",
  "serverAt": "2026-06-16T18:05:00+05:00",
  "isLate": false,
  "lateMinutes": 0,
  "geofence": { "passed": true, "distanceMeters": 20, "radiusMeters": 100 },
  "message": "Уход зафиксирован"
}
```

---

### 7. Офлайн синхронизация

#### `POST /attendance/offline-sync`

Когда нет интернета, приложение сохраняет отметки локально (SQLite / Room).  
При восстановлении связи — отправляет пакет:

```json
// Request
{
  "records": [
    {
      "employeeId": "emp_003",
      "locationId": "loc_001",
      "type": "CHECK_IN",
      "markedAt": "2026-06-15T09:00:00+05:00",
      "deviceTime": "2026-06-15T09:00:00+05:00",
      "lat": 43.2221,
      "lng": 76.8513,
      "accuracyMeters": 15,
      "selfieFileId": null,
      "offlineClientId": "uuid-1",
      "deviceInfo": { "platform": "android", "model": "Xiaomi Redmi 10", "appVersion": "0.1.0", "isMockLocation": false }
    },
    {
      "employeeId": "emp_003",
      "locationId": "loc_001",
      "type": "CHECK_OUT",
      "markedAt": "2026-06-15T18:10:00+05:00",
      "offlineClientId": "uuid-2",
      ...
    }
  ]
}

// Response 200
{
  "synced": 2,
  "duplicates": 0,
  "errors": []
}
```

> **Важно:** `offlineClientId` — UUID от устройства для идемпотентности. Повторная отправка не создаёт дубли.

---

### 8. История отметок сотрудника

#### `GET /attendance?employeeId={id}&dateFrom=2026-06-01&dateTo=2026-06-30`

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 50
}
```

---

## Статусы отметок

| Статус | Описание | Действие в приложении |
|--------|----------|----------------------|
| `OK` | Всё в порядке | Зелёный индикатор |
| `LATE` | Опоздание | Жёлтый + «опоздание X мин» |
| `OUT_OF_GEOFENCE` | Вне зоны | Красный + предупреждение |
| `MANUAL_REVIEW` | На проверке | Серый + «ожидает проверки» |

---

## Обработка ошибок

| HTTP код | Описание |
|----------|----------|
| 400 | Ошибка валидации — поле `message` содержит детали |
| 401 | Токен истёк или невалиден — нужно рефрешить |
| 403 | Нет доступа к ресурсу |
| 404 | Ресурс не найден |
| 409 | Конфликт (уже отмечался сегодня) |
| 422 | Бизнес-ошибка (сотрудник деактивирован и т.д.) |
| 500 | Серверная ошибка |

```json
// Формат ошибки
{
  "error": "ALREADY_CHECKED_IN",
  "message": "Сотрудник уже зафиксировал приход сегодня в 09:02",
  "statusCode": 409
}
```

---

## Рекомендации для мобильной команды

### Локальное хранилище
- Использовать Room (Android) / CoreData (iOS) для офлайн-буфера
- Синхронизировать при каждом восстановлении интернета
- Максимум 100 записей в одном sync-запросе

### Определение геолокации
- Запрашивать с точностью HIGH_ACCURACY
- Если `accuracyMeters > 50` — предупреждать пользователя
- Проверку геофенса дополнительно выполнять на устройстве (UX feedback)
- Блокировать отметку если `isMockLocation == true` (конфигурируемо)

### Фото
- Качество JPEG 70%, максимум 1024x1024
- Сжимать перед загрузкой
- Если нет интернета — хранить локально как Base64, отправлять при синке
- Показывать превью перед отправкой

### Обновление токенов
- Если 401 — автоматически рефрешить токен
- Если refresh тоже 401 — разлогинить пользователя
- Реализовать очередь запросов во время рефреша

### Push-уведомления
- Не входит в этот API контракт
- Планируется через Firebase FCM / APNs в следующей версии

---

## Что реализовано сейчас (Mock)

На первом этапе API — это Next.js mock-сервис (`lib/api/mock-service.ts`).  
Все запросы симулируют задержку 400мс и возвращают mock-данные.

**Для подключения реального backend:**
1. Заменить функции в `lib/api/mock-service.ts` на реальные Axios-вызовы
2. Базовый URL вынести в `.env.local` → `NEXT_PUBLIC_API_URL`
3. Добавить интерсептор Axios для автоматического refresh токена
4. OpenAPI spec (`docs/openapi.yaml`) — отдать backend-команде как контракт

---

## Контакты

По вопросам API: api@timetrack.kz  
Telegram: @timetrack_dev
