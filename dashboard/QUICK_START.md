# 🚀 Быстрый старт - Scanner Dashboard

## 📋 Что уже работает?

### ✅ Готово:
- 📊 Рабочий стол с графиком
- 📦 Короба (структура матрёшки)
- 📝 Сырые логи с поиском
- 💾 Экспорт в CSV
- 🎨 Дизайн в стиле WBD

### ⚠️ Требует доработки:
- 🗑️ Удаление штрихкодов (нужен API)
- 📊 Экспорт в XLSX (нужна библиотека)

---

## 🎯 Как пользоваться?

### 1. **Рабочий стол**
```
📊 График → показывает динамику за 14 дней
📈 Метрики → обновляются автоматически
👥 Операторы → кликай для детализации
```

### 2. **Короба**
```
🏢 Клиент → кликай
  └─ 🏙️ Город → кликай
      └─ 📦 Короб → кликай
          └─ 🏷️ Штрихкод → кнопка "Удалить"
```

### 3. **Сырые логи**
```
🔍 Поиск → работает по всем полям
📄 Пагинация → 50 записей на страницу
🎨 Бейджи → цветные типы событий
```

### 4. **Экспорт**
```
📊 Статистика → перед экспортом
📥 CSV → работает (скачивается автоматически)
⚠️ XLSX → пока не работает (нужна библиотека)
```

---

## 🔧 Что нужно доделать?

### Backend (Python/FastAPI):

#### 1. API для удаления штрихкодов:
```python
# backend/app/api/v1/endpoints/events.py

@router.delete("/events/{event_uuid}")
async def delete_event(
    event_uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(verify_api_key)
):
    """Мягкое удаление события"""
    # 1. Найти событие
    event = await db.get(Event, event_uuid)
    if not event:
        raise HTTPException(404, "Event not found")
    
    # 2. Создать запись удаления
    deletion = Deletion(
        event_uuid=event_uuid,
        deleted_by=current_user,
        deleted_at=datetime.now(),
        event_data=event.to_dict()
    )
    db.add(deletion)
    
    # 3. Пометить как удалённое
    event.deleted = True
    event.deleted_at = datetime.now()
    
    await db.commit()
    return {"ok": True}
```

#### 2. API для просмотра удалений:
```python
@router.get("/deletions")
async def get_deletions(
    date: str = None,
    operator: str = None,
    client: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить список удалений"""
    query = select(Deletion).order_by(Deletion.deleted_at.desc())
    
    if date:
        query = query.filter(Deletion.deleted_at >= date)
    if operator:
        query = query.filter(Deletion.deleted_by == operator)
    
    result = await db.execute(query)
    deletions = result.scalars().all()
    
    return {
        "deletions": [d.to_dict() for d in deletions],
        "total": len(deletions)
    }
```

#### 3. Создать таблицу deletions:
```python
# backend/app/models/deletion.py

class Deletion(Base):
    __tablename__ = "deletions"
    
    id = Column(Integer, primary_key=True)
    event_uuid = Column(String, nullable=False)
    deleted_by = Column(String, nullable=False)
    deleted_at = Column(DateTime, default=datetime.now)
    event_data = Column(JSON)  # Сохраняем данные события
```

### Frontend (React):

#### 1. Установить библиотеку для XLSX:
```bash
cd dashboard
npm install xlsx
```

#### 2. Обновить ExportNew.jsx:
```javascript
import * as XLSX from 'xlsx';

const exportToXLSX = () => {
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Scanner Data");
  XLSX.writeFile(wb, `scanner_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};
```

#### 3. Добавить API клиент для удаления:
```javascript
// dashboard/src/api/client.js

export async function deleteEvent(eventUuid) {
  return fetchAPI(`/events/${eventUuid}`, {
    method: 'DELETE'
  });
}

export async function getDeletions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.append('date', filters.date);
  if (filters.operator) params.append('operator', filters.operator);
  
  return fetchAPI(`/deletions?${params.toString()}`);
}
```

#### 4. Обновить BoxesNew.jsx:
```javascript
import { deleteEvent } from '../api/client';

const handleDeleteItem = async (itemUuid, boxCode, clientName, cityName) => {
  if (!confirm('Удалить этот штрихкод из короба?')) return;

  try {
    await deleteEvent(itemUuid);
    alert('Штрихкод удалён!');
    // Перезагрузить данные
    window.location.reload();
  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Ошибка при удалении');
  }
};
```

---

## 📱 Тестирование

### 1. Проверь график:
- Открой "Рабочий стол"
- График должен показывать данные за 14 дней
- Метрики справа должны обновляться

### 2. Проверь короба:
- Открой "Короба"
- Кликни на клиента → должны раскрыться города
- Кликни на город → должны раскрыться короба
- Кликни на короб → должны показаться штрихкоды

### 3. Проверь сырые логи:
- Открой "Сырые логи"
- Введи что-то в поиск
- Проверь пагинацию

### 4. Проверь экспорт:
- Открой "Экспорт"
- Нажми "Экспортировать CSV"
- Файл должен скачаться

---

## 🎨 Кастомизация

### Изменить цвета:
```css
/* dashboard/src/App.css */

/* Основной цвет */
#1976D2 → твой цвет

/* Успех */
#4CAF50 → твой цвет

/* Ошибка */
#C62828 → твой цвет
```

### Изменить количество дней на графике:
```javascript
// dashboard/src/components/DashboardNew.jsx

for (let i = 13; i >= 0; i--) {  // 14 дней
// Измени на:
for (let i = 29; i >= 0; i--) {  // 30 дней
```

### Изменить количество записей на странице:
```javascript
// dashboard/src/components/RawLogsNew.jsx

const itemsPerPage = 50;
// Измени на:
const itemsPerPage = 100;
```

---

## 🐛 Troubleshooting

### График не показывает данные?
- Проверь фильтры (дата должна быть сегодня)
- Проверь что есть события типа `ITEM`
- Открой DevTools → Console

### Короба не раскрываются?
- Проверь что есть данные с `client`, `city`, `box`
- Проверь Console на ошибки

### Экспорт не работает?
- Проверь что есть данные
- Проверь Console на ошибки
- Попробуй другой браузер

---

**Готово!** 🎉

Если что-то не работает - пиши! 💬

