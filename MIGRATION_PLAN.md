# 📦 План миграции PWA Scanner Logger с Google Sheets на VM + PostgreSQL

## 🎯 Цель
Миграция системы сканирования штрихкодов с Google Apps Script + Sheets на полноценную архитектуру с FastAPI + PostgreSQL для повышения производительности и стабильности.

---

## 📊 Анализ текущей системы (AS-IS)

### Архитектура
```
PWA Frontend (GitHub Pages)
    ↓ POST batch (3 скана / 3 сек)
Google Apps Script (Backend)
    ↓ LockService + Cache
Google Sheets (База данных)
    ↓ raw_log_YYYY_MM
Таблицы по месяцам
```

### Структура данных (из скриншота Google Sheets)

**Основная таблица логов (`raw_log_YYYY_MM`)**:
```
uuid          - UUID события (первичный ключ, дедупликация)
ts            - Timestamp (dd.MM.yyyy HH:mm:ss)
type          - Тип события: ITEM, BOX, CLOSE, CITY, CITY_CLOSE, ERROR, REMOVE, BULK_REMOVE
operator      - Имя сотрудника (testscanner, ivancov и т.д.)
client        - Клиент (ivancov)
city          - Город (Novosem)
box           - Короб (ivancov/8, ivancov/9 и т.д.)
code          - Штрихкод товара или код события
details       - Дополнительные детали (пусто в основном)
receivedAt    - Время получения сервером (dd.MM.yyyy HH:mm:ss)
source        - Источник (pwa, dashboard)
```

### Примеры событий из таблицы
1. **ITEM** - Сканирование товара
   ```
   uuid: c6414b06-0ea0-48ff-858c-7bd70d8b7581
   ts: 10.10.2025 13:39:30
   type: ITEM
   operator: testscanner
   client: ivancov
   city: Novosem
   box: ivancov/8
   code: 2042469234860 (штрихкод)
   source: pwa
   ```

2. **BOX** - Открытие короба
3. **CLOSE** - Закрытие короба
4. **CITY** - Открытие города
5. **CITY_CLOSE** - Закрытие города
6. **ERROR** - Ошибки (NO_BOX, BOX_NOT_CLOSED, CYRILLIC_ERROR и т.д.)

### Производительность текущей системы
- ⏱️ Время записи batch (3 скана): ~3000 мс
- 🔄 Механизм дедупликации: UUID проверка в Sheets + Cache (10-30 мин)
- 🔒 Lock механизм: LockService.getScriptLock() (до 30 сек)
- 📊 Статистика (из скриншота): ~45 записей за 5 минут

### Функционал Apps Script

#### API Endpoints (doPost + doGet)
1. **POST /** - Основной endpoint для приема батчей сканов
   - Поддерживает форматы: `{events:[...]}`, `{api:'ingest', records:[...]}`, `{rows:[...]}`
   - Дедупликация по UUID (проверка всей таблицы + Cache)
   - Группировка по месяцам (`raw_log_YYYY_MM`)

2. **GET /?api=has_uuids** - Verify-ACK (проверка существующих UUID)
3. **GET /?api=state** - Дашборд: состояние операторов
4. **GET /?api=boxes** - Группировка по коробам
5. **GET /?api=clients** - Группировка по клиентам
6. **GET /?api=raw** - Сырые логи
7. **GET /?api=export** - CSV экспорт
8. **GET /?api=export_gs** - Экспорт в Google Sheets
9. **GET /?api=export_gs_range** - Экспорт диапазона дат
10. **GET /?api=remove_item** - Удаление товара
11. **GET /?api=bulk_remove_items** - Массовое удаление
12. **GET /?api=removal_logs** - Логи удалений

#### Dashboard функции
- Онлайн-статус операторов (5 мин активности)
- Агрегация по операторам/клиентам/коробам
- Кэширование результатов (10 сек TTL)
- Лента последних 100 событий

### PWA Frontend функционал
- 📱 Offline-first: IndexedDB для хранения
- 🔄 Батчинг: 3 скана или 3 секунды задержки
- 🎙️ Голосовые уведомления (SpeechSynthesis API)
- 🔐 Проверка на кириллицу в QR-кодах
- ⏰ Автозакрытие коробов через 60 минут
- 🔄 Периодическая синхронизация (каждую минуту)

---

## 🚀 Целевая архитектура (TO-BE)

```
┌─────────────────────────────────────────────────────────────┐
│                    VM (Yandex Cloud / VK Cloud)            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Nginx (Reverse Proxy + Static PWA files)             │  │
│  │ :80/:443 → Let's Encrypt SSL                         │  │
│  └─────────────────┬────────────────────────────────────┘  │
│                    │                                        │
│  ┌─────────────────▼────────────────────────────────────┐  │
│  │ FastAPI Backend                                      │  │
│  │ :8000 (internal)                                     │  │
│  │ - REST API endpoints                                 │  │
│  │ - Pydantic validation                                │  │
│  │ - SQLAlchemy ORM                                     │  │
│  │ - Redis cache (опционально)                         │  │
│  └─────────────────┬────────────────────────────────────┘  │
│                    │                                        │
│  ┌─────────────────▼────────────────────────────────────┐  │
│  │ PostgreSQL 15+                                       │  │
│  │ :5432 (internal)                                     │  │
│  │ - Таблица events (логи сканирований)                │  │
│  │ - Индексы по uuid, operator, client, date           │  │
│  │ - Партиционирование по месяцам (опционально)        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS (fetch API)
         │
┌────────┴─────────┐
│   PWA Frontend   │
│ (GitHub Pages)   │
│ - Same UI        │
│ - New API URL    │
└──────────────────┘
```

---

## 🗄️ Схема PostgreSQL базы данных

### Основная таблица `events`
```sql
CREATE TABLE events (
    uuid            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts              TIMESTAMP WITH TIME ZONE NOT NULL,
    type            VARCHAR(50) NOT NULL, -- ITEM, BOX, CLOSE, CITY, etc.
    operator        VARCHAR(100) NOT NULL,
    client          VARCHAR(100),
    city            VARCHAR(100),
    box             VARCHAR(100),
    code            VARCHAR(500),
    details         TEXT,
    received_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source          VARCHAR(50) DEFAULT 'pwa',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Индексы для быстрых выборок
    INDEX idx_events_ts (ts DESC),
    INDEX idx_events_operator (operator, ts DESC),
    INDEX idx_events_client (client, ts DESC),
    INDEX idx_events_type (type, ts DESC),
    INDEX idx_events_box (box, ts DESC),
    INDEX idx_events_date (DATE(ts), operator),
    INDEX idx_events_received_at (received_at DESC)
);

-- Уникальный индекс для дедупликации
CREATE UNIQUE INDEX idx_events_uuid ON events(uuid);

-- Составной индекс для dashboard запросов
CREATE INDEX idx_dashboard ON events(operator, client, ts DESC) 
    WHERE ts > NOW() - INTERVAL '24 hours';
```

### Опциональная таблица для агрегатов (кэш)
```sql
CREATE TABLE operator_stats_cache (
    operator        VARCHAR(100) PRIMARY KEY,
    date            DATE NOT NULL,
    items_count     INTEGER DEFAULT 0,
    boxes_opened    INTEGER DEFAULT 0,
    boxes_closed    INTEGER DEFAULT 0,
    errors_count    INTEGER DEFAULT 0,
    last_activity   TIMESTAMP WITH TIME ZONE,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 REST API Endpoints (FastAPI)

### 1. Прием сканов (основной endpoint)
```http
POST /api/v1/events/batch
Content-Type: application/json

{
  "events": [
    {
      "uuid": "c6414b06-0ea0-48ff-858c-7bd70d8b7581",
      "ts": 1728562770000,  // Unix timestamp в ms
      "type": "ITEM",
      "operator": "testscanner",
      "client": "ivancov",
      "city": "Novosem",
      "box": "ivancov/8",
      "code": "2042469234860"
    }
  ]
}

Response:
{
  "ok": true,
  "inserted": 1,
  "skipped": 0,
  "duplicates": []
}
```

### 2. Verify-ACK (проверка существующих UUID)
```http
POST /api/v1/events/verify
{
  "uuids": ["uuid1", "uuid2", "uuid3"]
}

Response:
{
  "ok": true,
  "present": ["uuid1"]  // UUID которые уже есть в БД
}
```

### 3. Dashboard - состояние операторов
```http
GET /api/v1/dashboard/state?date=2025-10-31&operator=testscanner&client=ivancov

Response:
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
      "errorsToday": 2,
      "lastSeenAt": "31.10.2025 15:29:15"
    }
  ],
  "clients": [...],
  "feed": [...],
  "summary": {
    "items": 450,
    "opens": 12,
    "closes": 10,
    "errors": 3
  }
}
```

### 4. Группировка по коробам
```http
GET /api/v1/dashboard/boxes?date=2025-10-31&client=ivancov

Response:
{
  "clients": [
    {
      "client": "ivancov",
      "cities": [
        {
          "city": "Novosem",
          "boxes": [
            {
              "boxNo": "8",
              "itemsCount": 25,
              "firstAt": "31.10.2025 13:39:30",
              "lastAt": "31.10.2025 15:29:15",
              "operators": ["testscanner"],
              "items": [...]
            }
          ]
        }
      ]
    }
  ]
}
```

### 5. Сырые логи
```http
GET /api/v1/logs/raw?date=2025-10-31&operator=testscanner

Response:
{
  "logs": [
    {
      "uuid": "...",
      "ts": "31.10.2025 15:29:15",
      "type": "ITEM",
      "operator": "testscanner",
      "client": "ivancov",
      "city": "Novosem",
      "box": "ivancov/8",
      "code": "2042469234860",
      "receivedAt": "31.10.2025 15:29:16"
    }
  ]
}
```

### 6. Экспорт в CSV
```http
GET /api/v1/export/csv?date=2025-10-31&client=ivancov

Response: (CSV file download)
```

### 7. Удаление товара
```http
POST /api/v1/events/remove
{
  "operator": "testscanner",
  "box": "ivancov/8",
  "code": "2042469234860",
  "reason": "Ошибка сканирования"
}
```

### 8. Массовое удаление
```http
POST /api/v1/events/bulk-remove
{
  "operator": "testscanner",
  "uuids": ["uuid1", "uuid2"],
  "reason": "Массовая ошибка"
}
```

---

## 🛠️ Стек технологий

### Backend
- **Python 3.11+**
- **FastAPI** 0.104+ (асинхронный веб-фреймворк)
- **SQLAlchemy** 2.0+ (ORM)
- **Pydantic** 2.5+ (валидация данных)
- **asyncpg** (асинхронный драйвер PostgreSQL)
- **Redis** (опционально, для кэширования)
- **Uvicorn** (ASGI сервер)

### База данных
- **PostgreSQL** 15+ (основная БД)
- **pg_partman** (опционально, для партиционирования по месяцам)

### Инфраструктура
- **Docker** + **Docker Compose**
- **Nginx** (reverse proxy + статика)
- **Let's Encrypt** (SSL сертификаты)
- **systemd** или **PM2** (автозапуск)

### Мониторинг (опционально)
- **Prometheus** + **Grafana**
- **PostgreSQL Exporter**

---

## 📋 Этапы миграции

### Этап 1: Подготовка и проектирование ✅
- [x] Анализ текущего кода Apps Script
- [x] Проектирование схемы PostgreSQL
- [x] Определение API endpoints
- [ ] Выбор VM провайдера (Yandex Cloud / VK Cloud)

### Этап 2: Разработка Backend
1. Инициализация FastAPI проекта
2. Модели SQLAlchemy (events, operator_stats_cache)
3. Pydantic схемы (валидация входящих данных)
4. API endpoints:
   - POST /api/v1/events/batch (основной)
   - POST /api/v1/events/verify (verify-ACK)
   - GET /api/v1/dashboard/state
   - GET /api/v1/dashboard/boxes
   - GET /api/v1/logs/raw
   - POST /api/v1/events/remove
   - GET /api/v1/export/csv
5. Middleware для CORS, логирования
6. Обработка ошибок и валидация
7. Unit тесты (pytest)

### Этап 3: Миграция данных
1. Скрипт экспорта из Google Sheets (Python + gspread)
2. Парсинг формата даты `dd.MM.yyyy HH:mm:ss`
3. Импорт в PostgreSQL через SQLAlchemy
4. Проверка целостности (подсчет записей, типов событий)
5. Бэкап данных

### Этап 4: Адаптация PWA Frontend
1. Изменить `SYNC_URL` на новый API endpoint
2. Обновить логику отправки:
   - Формат даты: Unix timestamp в мс (уже так)
   - Content-Type: application/json
3. Обработка новых форматов ответов
4. Тестирование offline режима
5. Обновление Service Worker

### Этап 5: Настройка VM и Docker
1. Создать VM (1-2 vCPU, 2-4GB RAM)
2. Docker Compose конфигурация:
   - PostgreSQL контейнер
   - FastAPI контейнер
   - Nginx контейнер
   - Redis контейнер (опционально)
3. Настройка Nginx:
   - Reverse proxy для API
   - Статика для PWA (если нужно)
   - SSL сертификаты (Let's Encrypt)
4. Environment variables (.env файл)
5. Docker volumes для данных

### Этап 6: Деплой и тестирование
1. Развертывание на VM
2. Настройка домена и DNS
3. SSL сертификаты (certbot)
4. Нагрузочное тестирование (Apache Bench / Locust)
5. Мониторинг метрик:
   - Время ответа API (должно быть < 50ms)
   - Нагрузка на PostgreSQL
   - Использование памяти/CPU

### Этап 7: Параллельный запуск
1. PWA отправляет данные на оба сервера (старый + новый)
2. Сравнение данных (количество, типы событий)
3. Мониторинг ошибок (логи FastAPI vs Apps Script)
4. Корректировка при необходимости

### Этап 8: Полный переход
1. Переключить PWA только на новый API
2. Отключить Apps Script endpoint (или оставить read-only)
3. Мониторинг первых 48 часов
4. Настройка бэкапов PostgreSQL (pg_dump каждые 6 часов)

---

## ⚡ Ожидаемые улучшения

### Производительность
| Метрика | Сейчас (Google Sheets) | После (PostgreSQL) | Улучшение |
|---------|------------------------|-------------------|-----------|
| Время записи batch (3 скана) | ~3000 мс | < 50 мс | **60x быстрее** |
| Дедупликация | Полная проверка таблицы | Уникальный индекс | **100x быстрее** |
| Dashboard загрузка | ~2000 мс | < 200 мс | **10x быстрее** |
| Одновременные запросы | 1-2 (Lock) | 100+ | **50x больше** |

### Надежность
- ✅ 99.9% uptime (vs ~95% у Google Sheets API)
- ✅ Нет квот и лимитов API
- ✅ Атомарные транзакции
- ✅ ACID гарантии
- ✅ Полный контроль над системой

### Масштабируемость
- ✅ Поддержка 100+ одновременных сканеров
- ✅ Партиционирование по месяцам (при росте данных)
- ✅ Горизонтальное масштабирование (read replicas)
- ✅ Кэширование с Redis

---

## 💰 Стоимость инфраструктуры

### Yandex Cloud (ориентировочно)
- **VM**: 2 vCPU, 4GB RAM, 20GB SSD = ~800₽/мес
- **IP адрес**: ~150₽/мес
- **Трафик**: до 100GB = бесплатно
- **Итого**: ~950₽/мес

### VK Cloud (ориентировочно)
- **VM**: 2 vCPU, 4GB RAM, 20GB SSD = ~600₽/мес
- **IP адрес**: бесплатно
- **Трафик**: до 100GB = бесплатно
- **Итого**: ~600₽/мес

**Сравнение с Google Sheets**:
- Google Sheets (бесплатно, но лимиты + низкая производительность)
- Новая система: ~600-950₽/мес, **но полный контроль и в 60 раз быстрее**

---

## 🔒 Безопасность

### Аутентификация
1. **API Key** для PWA (переменная окружения)
2. **Bearer Token** для каждого оператора (опционально)
3. **Rate limiting** (100 req/min на IP)

### Защита данных
- SSL/TLS шифрование (Let's Encrypt)
- PostgreSQL: SSL соединения
- Environment variables для секретов (.env файл)
- Регулярные бэкапы (pg_dump)

---

## 📊 Мониторинг и логи

### Метрики для отслеживания
1. **API Performance**:
   - Время ответа (p50, p95, p99)
   - RPS (requests per second)
   - Ошибки (4xx, 5xx)

2. **Database**:
   - Количество соединений
   - Медленные запросы (> 100ms)
   - Размер БД

3. **System**:
   - CPU usage
   - Memory usage
   - Disk I/O

### Логирование
- FastAPI: structured logging (JSON format)
- Nginx: access logs + error logs
- PostgreSQL: slow query log

---

## 🚨 Риски и митигация

| Риск | Вероятность | Воздействие | Митигация |
|------|------------|-------------|-----------|
| Потеря данных при миграции | Низкая | Критическое | Бэкап Sheets перед миграцией, проверка целостности |
| Ошибки в новом API | Средняя | Высокое | Параллельный запуск, мониторинг, откат на старую систему |
| Проблемы с VM | Низкая | Высокое | Бэкапы PostgreSQL каждые 6 часов, snapshot VM |
| PWA не работает offline | Низкая | Среднее | Тестирование IndexedDB, fallback на старый URL |
| Перегрузка PostgreSQL | Низкая | Среднее | Индексы, партиционирование, Redis кэш |

---

## 📅 Timeline (ориентировочно)

- **Неделя 1**: Разработка Backend (FastAPI + SQLAlchemy)
- **Неделя 2**: Миграция данных, тестирование API
- **Неделя 3**: Адаптация PWA, Docker Compose, настройка VM
- **Неделя 4**: Деплой, нагрузочное тестирование, параллельный запуск
- **Неделя 5**: Мониторинг, переход на новую систему
- **Неделя 6**: Финальные доработки, документация

**Итого**: ~1.5 месяца до полного перехода

---

## ✅ Критерии успеха

1. ⚡ Время записи batch < 50 мс (vs 3000 мс сейчас)
2. 🚀 Uptime > 99.9%
3. 📊 Поддержка 100+ одновременных операторов
4. 💾 Нет потери данных при миграции
5. 🔄 Offline-режим PWA работает
6. 📈 Dashboard загружается < 200 мс
7. 💰 Стоимость инфраструктуры < 1000₽/мес

---

## 🔗 Следующие шаги

1. **Выбор VM провайдера** (Yandex Cloud или VK Cloud)
2. **Создание репозитория** для backend кода
3. **Инициализация FastAPI проекта**
4. **Разработка моделей SQLAlchemy**
5. **Реализация API endpoints**
6. **Скрипт миграции данных**

---

## 📝 Дополнительные вопросы

### Ответы на вопросы из ТЗ:

1. **Есть ли авторизация сотрудников?**
   - Сейчас: имя оператора указывается в настройках PWA (поле "Имя сотрудника")
   - Нет проверки подлинности
   - **Рекомендация**: добавить API Key или JWT токены для каждого оператора

2. **Какие отчёты нужны?**
   - Экспорт в CSV (по дате, клиенту, оператору)
   - Экспорт в Google Sheets (простая таблица: Клиент | Короб | ШК | Время | Оператор)
   - Dashboard с агрегатами (операторы, клиенты, короба)
   - Логи удалений (REMOVE, BULK_REMOVE)

3. **Синхронизация с внешними системами?**
   - Сейчас нет интеграций
   - Только Google Sheets для хранения и экспорта
   - **Рекомендация**: API endpoint для webhook уведомлений (для интеграции с WB, 1C и т.д.)

4. **Бюджет на инфраструктуру?**
   - ~600-950₽/мес (VM + IP адрес)
   - Укладываемся в 500-1000₽/мес

5. **Доступ к старым данным после миграции?**
   - Да, Google Sheets можно оставить в read-only режиме
   - Все данные будут импортированы в PostgreSQL
   - **Рекомендация**: архивировать старые листы, экспортировать в CSV для бэкапа

---

## 🎯 Итоговый результат

После завершения миграции получим:

✅ **Производительность**: запись батча за **< 50 мс** (вместо 3000 мс)  
✅ **Надежность**: 99.9% uptime, нет квот и лимитов  
✅ **Масштабируемость**: поддержка 100+ одновременных сканеров  
✅ **Контроль**: полное владение системой и данными  
✅ **Стоимость**: ~600-950₽/мес (сопоставимо с бесплатным Sheets, но на порядок лучше)  
✅ **Аналитика**: быстрые отчёты и выборки по любым параметрам  

---

**Готов приступить к реализации! 🚀**

