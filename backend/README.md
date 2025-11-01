# 🚀 Scanner Logger Backend (FastAPI + PostgreSQL)

Бэкенд для PWA системы сканирования штрихкодов.

## 🏗️ Архитектура

```
FastAPI Backend
├── app/
│   ├── __init__.py
│   ├── main.py              # Точка входа приложения
│   ├── config.py            # Конфигурация (env variables)
│   ├── database.py          # Подключение к PostgreSQL
│   ├── models/              # SQLAlchemy модели
│   │   ├── __init__.py
│   │   └── event.py         # Модель Event
│   ├── schemas/             # Pydantic схемы
│   │   ├── __init__.py
│   │   ├── event.py         # EventCreate, EventResponse
│   │   └── dashboard.py     # Dashboard схемы
│   ├── api/                 # API endpoints
│   │   ├── __init__.py
│   │   ├── events.py        # POST /batch, verify
│   │   ├── dashboard.py     # GET /state, /boxes
│   │   └── export.py        # GET /csv, /excel
│   ├── services/            # Бизнес-логика
│   │   ├── __init__.py
│   │   ├── event_service.py # Логика работы с событиями
│   │   └── dashboard_service.py
│   └── utils/               # Вспомогательные функции
│       ├── __init__.py
│       └── date_parser.py   # Парсинг dd.MM.yyyy
├── migrations/              # Alembic миграции
├── tests/                   # Pytest тесты
├── requirements.txt         # Python зависимости
├── Dockerfile              # Docker образ
└── docker-compose.yml      # Docker Compose конфиг
```

## 📦 Установка

### Локальная разработка

1. **Клонировать репозиторий**
```bash
git clone <repo-url>
cd scanner-logger-pwa/backend
```

2. **Создать виртуальное окружение**
```bash
python3.11 -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate     # Windows
```

3. **Установить зависимости**
```bash
pip install -r requirements.txt
```

4. **Настроить .env файл**
```bash
cp .env.example .env
# Отредактировать .env с настройками БД
```

5. **Запустить PostgreSQL (Docker)**
```bash
docker run -d \
  --name scanner-postgres \
  -e POSTGRES_DB=scanner_logger \
  -e POSTGRES_USER=scanner \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15
```

6. **Применить миграции**
```bash
alembic upgrade head
```

7. **Запустить сервер**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API будет доступен по адресу: http://localhost:8000

## 🐳 Docker Compose (рекомендуется)

```bash
docker-compose up -d --build
```

Это запустит:
- PostgreSQL (порт 5432)
- FastAPI backend (порт 8000)
- Nginx (порт 80/443)

## 🔧 Конфигурация

### Переменные окружения (.env)

```env
# База данных
DATABASE_URL=postgresql+asyncpg://scanner:password@localhost:5432/scanner_logger
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# API
API_KEY=your_secret_api_key_here
CORS_ORIGINS=https://your-pwa-domain.com,http://localhost:3000

# Redis (опционально)
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=10

# Логирование
LOG_LEVEL=INFO
```

## 📊 База данных

### Схема PostgreSQL

```sql
-- Основная таблица событий
CREATE TABLE events (
    uuid            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts              TIMESTAMP WITH TIME ZONE NOT NULL,
    type            VARCHAR(50) NOT NULL,
    operator        VARCHAR(100) NOT NULL,
    client          VARCHAR(100),
    city            VARCHAR(100),
    box             VARCHAR(100),
    code            VARCHAR(500),
    details         TEXT,
    received_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source          VARCHAR(50) DEFAULT 'pwa',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX idx_events_ts ON events(ts DESC);
CREATE INDEX idx_events_operator ON events(operator, ts DESC);
CREATE INDEX idx_events_client ON events(client, ts DESC);
CREATE INDEX idx_events_type ON events(type, ts DESC);
CREATE INDEX idx_events_date ON events(DATE(ts), operator);
CREATE INDEX idx_dashboard ON events(operator, client, ts DESC) 
    WHERE ts > NOW() - INTERVAL '24 hours';
```

## 🔌 API Endpoints

### 1. Прием батча событий

**POST** `/api/v1/events/batch`

```json
// Request
{
  "events": [
    {
      "uuid": "c6414b06-0ea0-48ff-858c-7bd70d8b7581",
      "ts": 1728562770000,
      "type": "ITEM",
      "operator": "testscanner",
      "client": "ivancov",
      "city": "Novosem",
      "box": "ivancov/8",
      "code": "2042469234860"
    }
  ]
}

// Response
{
  "ok": true,
  "inserted": 1,
  "skipped": 0,
  "duplicates": []
}
```

### 2. Verify UUID (проверка дубликатов)

**POST** `/api/v1/events/verify`

```json
// Request
{
  "uuids": ["uuid1", "uuid2", "uuid3"]
}

// Response
{
  "ok": true,
  "present": ["uuid1"]
}
```

### 3. Dashboard - состояние

**GET** `/api/v1/dashboard/state?date=2025-10-31&operator=testscanner`

```json
{
  "generatedAt": "2025-10-31T15:30:00Z",
  "operators": [
    {
      "operator": "testscanner",
      "online": true,
      "onlineAgeSec": 45,
      "lastSeenMs": 1730390000000,
      "lastClient": "ivancov",
      "lastCity": "Novosem",
      "lastBox": "ivancov/8",
      "itemsToday": 150,
      "errorsToday": 2
    }
  ],
  "summary": {
    "items": 450,
    "opens": 12,
    "closes": 10,
    "errors": 3
  }
}
```

### 4. Короба

**GET** `/api/v1/dashboard/boxes?date=2025-10-31&client=ivancov`

### 5. Сырые логи

**GET** `/api/v1/logs/raw?date=2025-10-31&operator=testscanner`

### 6. Экспорт CSV

**GET** `/api/v1/export/csv?date=2025-10-31&client=ivancov`

## 🧪 Тестирование

```bash
# Запустить все тесты
pytest

# С покрытием
pytest --cov=app --cov-report=html

# Конкретный тест
pytest tests/test_events.py::test_batch_insert
```

## 📈 Производительность

### Бенчмарки

```bash
# Apache Bench
ab -n 1000 -c 10 -T application/json -p batch.json \
   http://localhost:8000/api/v1/events/batch

# Результаты (ожидаемые):
# - Среднее время: < 50ms
# - 95-й перцентиль: < 100ms
# - Throughput: > 200 req/s
```

## 🔐 Безопасность

### API Key аутентификация

Все запросы должны содержать header:

```
X-API-Key: your_secret_api_key
```

### Rate Limiting

- 100 запросов в минуту на IP
- 1000 запросов в час на API key

## 📝 Миграция данных из Google Sheets

Скрипт для экспорта и импорта данных:

```bash
python scripts/migrate_from_sheets.py \
  --spreadsheet-id "1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4" \
  --credentials credentials.json
```

## 🚀 Деплой на VM

### 1. Настройка сервера

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установить Docker Compose
sudo apt install docker-compose -y
```

### 2. Деплой приложения

```bash
# Клонировать репозиторий
git clone <repo-url>
cd scanner-logger-pwa/backend

# Настроить .env
cp .env.example .env
nano .env

# Запустить
docker-compose up -d --build
```

### 3. Настройка Nginx + SSL

```bash
# Установить certbot
sudo apt install certbot python3-certbot-nginx

# Получить SSL сертификат
sudo certbot --nginx -d api.yourdomain.com
```

## 📊 Мониторинг

### Логи

```bash
# Backend логи
docker-compose logs -f backend

# PostgreSQL логи
docker-compose logs -f postgres

# Nginx логи
docker-compose logs -f nginx
```

### Метрики (Prometheus)

Метрики доступны по адресу: `http://localhost:8000/metrics`

## 🆘 Troubleshooting

### Проблема: Медленные запросы

```sql
-- Проверить медленные запросы
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Проблема: Высокая нагрузка на БД

- Проверить индексы
- Включить Redis кэширование
- Увеличить `DATABASE_POOL_SIZE`

### Проблема: Ошибки дедупликации

```sql
-- Найти дубликаты UUID
SELECT uuid, COUNT(*)
FROM events
GROUP BY uuid
HAVING COUNT(*) > 1;
```

## 📚 Документация API

После запуска сервера документация доступна:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🤝 Контрибьюция

1. Fork проекта
2. Создать feature ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменений (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Открыть Pull Request

## 📄 Лицензия

MIT License

