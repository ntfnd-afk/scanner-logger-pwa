# Scanner Dashboard

Веб-дашборд для мониторинга сканирования в реальном времени.

## 🚀 Быстрый старт

### Разработка

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

Откройте http://localhost:3000

### Продакшн

```bash
# Сборка
npm run build

# Предпросмотр сборки
npm run preview
```

## 📦 Структура

```
dashboard/
├── src/
│   ├── components/      # React компоненты
│   │   ├── Header.jsx
│   │   ├── Filters.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Boxes.jsx
│   │   ├── DeleteLogs.jsx
│   │   ├── RawLogs.jsx
│   │   └── Export.jsx
│   ├── api/
│   │   └── client.js    # API клиент
│   ├── App.jsx          # Главный компонент
│   ├── App.css          # Стили
│   └── main.jsx         # Точка входа
├── public/              # Статические файлы
├── index.html
├── vite.config.js
└── package.json
```

## 🎯 Функции

### 📊 Рабочий стол
- Сводка по товарам, коробам, операторам
- Список активных операторов
- Последние события в реальном времени

### 📦 Короба
- Группировка по клиентам/городам
- Статус коробов (открыт/закрыт)
- Длительность обработки

### 🗑️ Удаления
- Логи всех удалений
- Фильтрация по типу

### 📝 Сырые логи
- Все события
- Поиск по всем полям
- Пагинация

### 💾 Экспорт
- Экспорт в CSV
- Предпросмотр данных
- Поддержка Excel

## 🔧 Конфигурация

API настраивается в `src/api/client.js`:

```javascript
const API_BASE = import.meta.env.PROD 
  ? 'https://scanner-api.fulfilment-one.ru/api/v1'
  : '/api/v1';
```

## 🌐 Деплой

### На сервер

```bash
# Сборка
npm run build

# Копирование на сервер
scp -r dist/* ubuntu@51.250.107.231:/var/www/scanner-dashboard/
```

### С Nginx

```nginx
server {
    listen 80;
    server_name dashboard.fulfilment-one.ru;
    
    root /var/www/scanner-dashboard;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass https://scanner-api.fulfilment-one.ru;
    }
}
```

## 📱 Особенности

- ✅ Автообновление каждые 30 секунд
- ✅ Фильтры по дате, оператору, клиенту, городу
- ✅ Адаптивный дизайн
- ✅ Быстрая загрузка
- ✅ Экспорт в CSV

## 🛠️ Технологии

- React 18
- Vite
- Vanilla CSS
- Fetch API

