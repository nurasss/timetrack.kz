# timetrack.kz

Мульти-тенантный учёт рабочего времени по лицу сотрудника. PWA + PHP-бэкенд.

## Архитектура

- **Лендинг + регистрация** — `index.html`
- **Админка** — `admin.html?c={slug}`
- **Планшет/киоск** — `tablet.html?c={slug}`, распознавание лица через face-api.js в браузере, liveness-проверка (моргание / поворот головы)
- **API** — `api.php` (продакшн, PHP) или `server.js` (локальная разработка, Node.js)
- **Изоляция компаний** — данные каждой в `data/{slug}/store.json`
- **Хранилище** — JSON-файлы на диске (без БД)

## Локальная разработка

```bash
node server.js
# открыть http://localhost:8787/
```

`server.js` отдаёт и API, и статику. Для деплоя на VPS можно использовать `server.vps.js` (только API, статику раздаёт reverse proxy).

## Деплой

Сейчас живёт на VPS за Caddy:
- Статика: `dev-timetrack/public/` → file_server
- API (`/api.php*`): reverse_proxy на Node.js контейнер с `server.vps.js`

## Файлы

| Файл | Назначение |
|------|------------|
| `index.html` | Лендинг + регистрация новой компании |
| `admin.html` | Админка компании (сотрудники, дашборд, табель, экспорт XLSX) |
| `tablet.html` | Киоск-планшет с камерой |
| `api.php` | Продакшн API (PHP) |
| `server.js` | Локальный dev-сервер (Node.js, статика + API) |
| `server.vps.js` | Production API сервер (только API, без статики) |
| `sw.js` | Service worker для PWA |
| `manifest.webmanifest` | PWA-манифест |
| `models/` | face-api.js модели (TinyFaceDetector, SSD, FaceLandmark, FaceRecognition) |
| `icons/` | PWA-иконки |
| `timetrack-logo.svg` | Логотип |

## Технологии

- Vanilla JS (без фреймворков)
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) — распознавание лица в браузере
- [Lucide](https://lucide.dev) — иконки
- PHP 7.4+ или Node.js 20+
- Caddy / любой веб-сервер с поддержкой PHP

## Безопасность

- PIN админки хранится только в `data/{slug}/store.json` (не отдаётся клиенту в публичном state)
- `data/` под `.htaccess` Deny-all
- Все API-action с записью требуют PIN
- Удаление компании — отдельным подтверждением (PIN + ручной ввод slug)
