# EliteTime — HTML/CSS/JS + Express + PostgreSQL

Полный учебный проект под требования итоговой работы: адаптивный фронт, карта, анимации, личный кабинет, API с авторизацией и CRUD, Postgres, Docker Compose.

## Стек и структура
- Frontend: HTML5, CSS3 (mobile‑first), нативный JS + Chart.js, Leaflet, GSAP.
- Backend: Node.js (Express), JWT, bcryptjs, pg.
- БД: PostgreSQL (схема — `docs/schema.sql`).
- Контейнеризация: Dockerfile + `docker-compose.yml`.

```
backend/        — Express + маршруты /api/register, /api/login, /api/posts, миграции/сиды
frontend/       — статический фронт (дашборд, карта, слайдер, формы)
docs/schema.sql — схема PostgreSQL
.env.example    — пример переменных окружения
docker-compose.yml / Dockerfile — поднятие БД и API
docker-data/    — volume для Postgres (создается автоматически)
```

## Сервисы (docker-compose)
- `db` (Postgres 15)
  - Порт: `55432` на хосте → `5432` в контейнере
  - Данные: `./docker-data/postgres`
  - Пользователь/пароль/БД: `elitetime / elitetime / elitetime`
  - Healthcheck: `pg_isready -U elitetime`
- `backend` (Node 20 + Express)
  - Порт: `3000` на хосте
  - Переменные: `DATABASE_URL=postgres://elitetime:elitetime@db:5432/elitetime`, `JWT_SECRET`, `FRONTEND_DIR=/app/frontend`
  - Отдает фронт из `frontend/` и API под `/api/*`

## Быстрый старт (Docker)
```bash
docker-compose up --build
# фронт и API: http://localhost:3000
# Postgres с хоста: localhost:55432 (elitetime / elitetime)
```

## Локальный запуск без Docker
1) Установите Node.js 20+ и PostgreSQL.  
2) Создайте БД/пользователя или используйте `postgres://elitetime:elitetime@localhost:5432/elitetime`.  
3) Скопируйте `.env.example` → `.env`, задайте `DATABASE_URL`, `JWT_SECRET`.  
4) `cd backend && npm install`  
5) `npm run start` (или `npm run dev` для hot‑reload). Фронт на `http://localhost:3000`.

## API
- `POST /api/register` — регистрация (name, email, password), пароль хэшируется.
- `POST /api/login` — вход, возвращает JWT и пользователя.
- `GET /api/posts` — список, query: `search`, `minRating`, `city`, `sort=price|new`.
- `GET /api/posts/:id` — карточка по ID.
- `POST /api/posts` — создать (нужен `Authorization: Bearer <token>`).
- `PUT /api/posts/:id` — обновить свою карточку.
- `DELETE /api/posts/:id` — удалить свою карточку.
- `GET /api/profile` — профиль авторизованного пользователя.

Демо после сидирования: `demo@elitetime.ru / demo1234`.

## Что есть на фронтенде (frontend/)
- Одностраничный HTML с адаптивной сеткой, плавными CSS-переходами и GSAP-анимацией hero.
- Каталог: автослайдер карточек, фильтр по названию и рейтингу.
- Дашборд: Chart.js график + сортируемая/фильтруемая таблица.
- Гео: Leaflet карта с маркерами из БД, кнопка «Определить меня».
- Личный кабинет: формы регистрации/входа и создания карточки (координаты, рейтинг, цена).

## Что есть на бэкенде (backend/)
- `src/server.js` — настройка Express, статика фронта, healthcheck.
- `src/routes/auth.js` — регистрация/логин/профиль, JWT, bcrypt.
- `src/routes/posts.js` — CRUD по постам с проверкой авторства.
- `src/db/init.js` — миграция и сиды (демо-пользователь + примеры постов).
- `src/db/pool.js` — подключение к Postgres через `pg`.

## База данных
- Таблицы: `users`, `posts`; схема также в `docs/schema.sql`.
- Поля `posts`: координаты (lat/long), город, цена, рейтинг (1–5), автор.

## Переменные окружения
- `PORT` (по умолчанию 3000)
- `DATABASE_URL` (см. `.env.example`)
- `JWT_SECRET` (обязательно поменять в продакшене)
- `FRONTEND_DIR` (путь к папке фронта, по умолчанию `frontend/`)
- `DB_SSL` (true/false, если нужен SSL к БД)

## Типовой сценарий проверки
1. `docker-compose up --build`  
2. Открыть `http://localhost:3000`. Убедиться, что лента, карта, график и таблица отображаются (данные из сидов).  
3. Войти демо-аккаунтом `demo@elitetime.ru / demo1234`.  
4. Создать новую карточку (с координатами) — она появится в списке, таблице и на карте.  
5. Проверить запросы: `GET /api/posts`, `GET /api/posts/:id`, `POST /api/posts`, `PUT /api/posts/:id`, `DELETE /api/posts/:id`, `GET /api/profile`.  
6. При необходимости подключиться к БД с хоста: `psql -h localhost -p 55432 -U elitetime -d elitetime`.
