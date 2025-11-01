# 🚀 Инструкция по деплою hotfix для поддержки диапазона дат

## Проблема
При выборе диапазона дат `31.10 - 01.11` API возвращал пустой массив, хотя данные за 01.11 есть в БД.

**Причина**: Бэкенд не поддерживал параметр `date_end` в API эндпоинтах.

## Решение
Добавлена поддержка `date_end` в эндпоинты:
- `/api/v1/dashboard/state`
- `/api/v1/dashboard/boxes`
- `/api/v1/dashboard/raw`

## Быстрый деплой

### Windows (PowerShell)
```powershell
cd c:\Fulfillment\scanner-logger-pwa
.\deploy_hotfix.ps1
```

### Linux/Mac
```bash
cd /path/to/scanner-logger-pwa
chmod +x deploy_hotfix.sh
./deploy_hotfix.sh
```

## Ручной деплой

Если скрипты не работают, выполните команды вручную:

```bash
# 1. Скопировать файл на сервер
scp backend/app/api/dashboard.py ubuntu@51.250.107.231:~/scanner/backend/app/api/

# 2. Подключиться к серверу
ssh ubuntu@51.250.107.231

# 3. Перезапустить бэкенд
cd ~/scanner
docker-compose restart backend

# 4. Проверить логи
docker-compose logs -f backend
```

## Проверка работы

### 1. В логах бэкенда должны появиться сообщения:
```
📅 Date range: 2025-10-31 00:00:00+00:00 - 2025-11-01 23:59:59.999999+00:00
🔍 get_raw_logs: date=2025-10-31, date_end=2025-11-01, operator=None, client=None, city=None, type=None
✅ get_raw_logs: found 49 events
```

### 2. В дашборде:
1. Откройте https://ntfnd-afk.github.io/scanner-logger-pwa/dashboard/
2. Откройте DevTools (F12) → Console
3. Выберите даты: От `31.10.2025` До `01.11.2025`
4. Перейдите на вкладку "Сырые логи"
5. Должны увидеть данные за оба дня

### 3. В консоли браузера должны быть логи:
```
📅 Filters updated: {startDate: '2025-10-31', endDate: '2025-11-01', ...}
📡 API request: /dashboard/raw?date=2025-10-31&date_end=2025-11-01
📊 Raw logs data: {logs: Array(49), total: 49}
📊 Raw logs count: 49 Total: 49
```

## Что изменилось

### Бэкенд (`backend/app/api/dashboard.py`)
1. Добавлена функция `parse_date_range()` для обработки диапазона дат
2. Все эндпоинты теперь принимают `date_end`
3. Добавлены дополнительные фильтры: `client`, `city`, `type` в `/raw`
4. Добавлено детальное логирование

### Фронтенд (уже готов)
1. `dashboard/src/App.jsx`: валидация диапазона дат
2. `dashboard/src/api/client.js`: отправка `date_end` в API

## Откат изменений

Если что-то пошло не так:

```bash
ssh ubuntu@51.250.107.231
cd ~/scanner
git checkout HEAD~1 backend/app/api/dashboard.py
docker-compose restart backend
```

## Дополнительная информация

- Подробности в `backend/HOTFIX_DATE_RANGE.md`
- Отладка фильтров в `dashboard/DATE_FILTER_DEBUG.md`

