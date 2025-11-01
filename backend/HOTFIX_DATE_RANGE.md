# Hotfix: Поддержка диапазона дат в API

## Проблема
API эндпоинты `/dashboard/state`, `/dashboard/boxes`, `/dashboard/raw` не поддерживали параметр `date_end`, что приводило к тому, что фронтенд не мог получить данные за диапазон дат (например, `31.10 - 01.11`).

## Решение
Добавлена поддержка параметра `date_end` во все три эндпоинта:
- `/api/v1/dashboard/state?date=YYYY-MM-DD&date_end=YYYY-MM-DD`
- `/api/v1/dashboard/boxes?date=YYYY-MM-DD&date_end=YYYY-MM-DD`
- `/api/v1/dashboard/raw?date=YYYY-MM-DD&date_end=YYYY-MM-DD`

Также добавлены дополнительные фильтры:
- `/dashboard/raw`: `client`, `city`, `type`
- `/dashboard/boxes`: `city`

## Изменения в коде

### 1. Новая функция `parse_date_range()` в `backend/app/api/dashboard.py`
```python
def parse_date_range(date_start: Optional[str], date_end: Optional[str]) -> tuple[datetime, datetime]:
    """
    Парсинг диапазона дат
    Если date_end не указан - используется date_start
    Если оба не указаны - используется сегодня
    Если start_date > end_date - меняет местами
    """
```

### 2. Обновлены эндпоинты
- `get_dashboard_state()`: добавлен параметр `date_end`
- `get_boxes_state()`: добавлены параметры `date_end` и `city`
- `get_raw_logs()`: добавлены параметры `date_end`, `client`, `city`, `type`

### 3. Добавлено логирование
Все эндпоинты теперь логируют входящие параметры:
```python
logger.info(f"🔍 get_raw_logs: date={date}, date_end={date_end}, operator={operator}, client={client}, city={city}, type={type}")
logger.info(f"✅ get_raw_logs: found {len(events)} events")
```

## Деплой на сервер

### Вариант 1: Через Git (рекомендуется)
```bash
# На локальной машине
cd c:\Fulfillment\scanner-logger-pwa
git add backend/app/api/dashboard.py
git commit -m "feat: add date_end support to dashboard API endpoints"
git push origin main

# На сервере
ssh ubuntu@51.250.107.231
cd ~/scanner
git pull origin main
docker-compose restart backend
docker-compose logs -f backend
```

### Вариант 2: Прямое копирование файла
```bash
# На локальной машине
scp backend/app/api/dashboard.py ubuntu@51.250.107.231:~/scanner/backend/app/api/

# На сервере
ssh ubuntu@51.250.107.231
cd ~/scanner
docker-compose restart backend
docker-compose logs -f backend
```

## Проверка

### 1. Проверьте логи бэкенда
```bash
docker-compose logs -f backend | grep "Date range"
```

Должны увидеть:
```
📅 Date range: 2025-10-31 00:00:00+00:00 - 2025-11-01 23:59:59.999999+00:00
```

### 2. Проверьте API вручную
```bash
# Одна дата
curl -H "X-API-Key: ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60" \
  "https://scanner-api.fulfilment-one.ru/api/v1/dashboard/raw?date=2025-11-01"

# Диапазон дат
curl -H "X-API-Key: ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60" \
  "https://scanner-api.fulfilment-one.ru/api/v1/dashboard/raw?date=2025-10-31&date_end=2025-11-01"
```

### 3. Проверьте в дашборде
1. Откройте дашборд: https://ntfnd-afk.github.io/scanner-logger-pwa/dashboard/
2. Откройте DevTools (F12) → Console
3. Выберите диапазон дат: `31.10.2025 - 01.11.2025`
4. Перейдите на вкладку "Сырые логи"
5. В консоли должны увидеть:
```
📡 API request: /dashboard/raw?date=2025-10-31&date_end=2025-11-01
📊 Raw logs data: {logs: Array(49), total: 49}
📊 Raw logs count: 49 Total: 49
```

## Откат (если что-то пошло не так)
```bash
cd ~/scanner
git log --oneline -5  # Найдите предыдущий коммит
git checkout <previous-commit-hash> backend/app/api/dashboard.py
docker-compose restart backend
```

## Дополнительная информация
- Все даты обрабатываются в UTC
- Если `date_end` не указан, используется `date`
- Если `date > date_end`, они автоматически меняются местами
- Максимальный лимит для `/raw`: 10000 записей (по умолчанию 1000)

