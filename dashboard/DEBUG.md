# 🐛 Отладка Dashboard

## Проблема: "Короба" и "Сырые логи" пусты

### ✅ Что исправлено:

1. **App.jsx** - теперь для вкладки "Короба" используется `getDashboardState()` вместо `getBoxes()`
2. **Добавлены console.log** в компоненты для отладки
3. **Добавлены подсказки** если нет данных

---

## 🔍 Как проверить что работает?

### 1. Открой DevTools (F12)
```
Console → должны быть логи:
- "Dashboard data: {...}"
- "Boxes data (from feed): {...}"
- "Raw logs data: {...}"
```

### 2. Проверь фильтры
```
⚠️ ВАЖНО: Дата должна быть СЕГОДНЯ!

Сегодня: 2025-11-01
Фильтр "От": 2025-11-01
Фильтр "До": 2025-11-01
```

### 3. Проверь что API возвращает данные
```javascript
// В Console браузера:
fetch('/api/v1/dashboard/state?date=2025-11-01', {
  headers: {'X-API-Key': 'ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60'}
})
.then(r => r.json())
.then(d => console.log('API Response:', d))
```

Должно вернуть:
```json
{
  "feed": [...],  // Массив событий
  "operators": [...],
  "clients": [...],
  "summary": {...}
}
```

---

## 🔧 Частые проблемы:

### 1. "Нет данных за выбранный период"

**Причина:** Неправильная дата в фильтрах

**Решение:**
- Открой "Рабочий стол"
- Измени дату "От" на сегодня
- Нажми "Обновить"

### 2. "API Error: HTTP 404"

**Причина:** API endpoint не найден

**Решение:**
```bash
# Проверь что backend запущен
docker ps | grep scanner-backend

# Проверь логи backend
docker logs scanner-backend
```

### 3. "API Error: HTTP 401"

**Причина:** Неправильный API Key

**Решение:**
```javascript
// Проверь API_KEY в dashboard/src/api/client.js
const API_KEY = 'ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60';

// Должен совпадать с backend/.env
API_KEY=ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60
```

### 4. "CORS Error"

**Причина:** Backend не разрешает запросы с localhost:3000

**Решение:**
```bash
# Проверь CORS_ORIGINS в backend
docker exec scanner-backend env | grep CORS

# Должно быть:
CORS_ORIGINS=https://ntfnd-afk.github.io,http://localhost:3000
```

---

## 📊 Проверка данных в БД:

```bash
# Подключись к PostgreSQL
docker exec -it wbd_db psql -U scanner -d scanner_logger

# Проверь количество событий
SELECT COUNT(*) FROM events;

# Проверь последние события
SELECT * FROM events ORDER BY ts DESC LIMIT 10;

# Проверь события за сегодня
SELECT COUNT(*) FROM events WHERE ts::date = CURRENT_DATE;

# Выход
\q
```

---

## 🎯 Ожидаемое поведение:

### Рабочий стол:
- ✅ График показывает данные за 14 дней
- ✅ Метрики обновляются
- ✅ Таблица операторов заполнена

### Короба:
- ✅ Видны клиенты
- ✅ При клике раскрываются города
- ✅ При клике раскрываются короба
- ✅ При клике раскрываются штрихкоды

### Сырые логи:
- ✅ Таблица заполнена
- ✅ Поиск работает
- ✅ Пагинация работает

---

## 🚀 Быстрая проверка:

```bash
# 1. Проверь что backend работает
curl -H "X-API-Key: ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60" \
  https://scanner-api.fulfilment-one.ru/api/v1/dashboard/state?date=2025-11-01

# 2. Проверь что есть данные
# Должен вернуть JSON с feed, operators, clients, summary

# 3. Если пусто - проверь БД
docker exec -it wbd_db psql -U scanner -d scanner_logger \
  -c "SELECT COUNT(*) FROM events WHERE ts::date = CURRENT_DATE;"
```

---

## 💡 Советы:

1. **Всегда проверяй Console** - там видны все ошибки
2. **Проверяй Network tab** - там видны все API запросы
3. **Проверяй фильтры** - дата должна быть сегодня
4. **Проверяй БД** - должны быть данные за сегодня

---

**Если всё ещё не работает - пришли скриншот Console!** 📸

