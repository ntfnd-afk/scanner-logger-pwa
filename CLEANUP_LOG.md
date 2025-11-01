# 🧹 Лог очистки проекта

Дата: 01.11.2025

## Удалённые файлы

### 1. Устаревшие компоненты дашборда (старые версии)

| Файл | Причина удаления | Замена |
|------|------------------|--------|
| `dashboard/src/components/Dashboard.jsx` | Устаревшая версия | `DashboardNew.jsx` |
| `dashboard/src/components/Boxes.jsx` | Устаревшая версия | `BoxesNew.jsx` |
| `dashboard/src/components/RawLogs.jsx` | Устаревшая версия | `RawLogsNew.jsx` |
| `dashboard/src/components/Export.jsx` | Устаревшая версия | `ExportNew.jsx` |
| `dashboard/src/components/Filters.jsx` | Логика перенесена | `Header.jsx` |

### 2. Дублирующиеся документы

| Файл | Причина удаления | Замена |
|------|------------------|--------|
| `dashboard/QUICKSTART.md` | Дубликат | `dashboard/QUICK_START.md` |

### 3. Архивы

| Файл | Причина удаления |
|------|------------------|
| `scanner-logger-pwa.zip` | Старый архив проекта |
| `scanner-pwa.tar.gz` | Старый архив проекта |

### 4. Устаревшие конфигурации

| Файл | Причина удаления | Примечание |
|------|------------------|------------|
| `wbd_nginx_scanner_addition.conf` | Конфигурация перенесена на сервер | Используется `/home/ubuntu/apps/wbd/infra/nginx/nginx.conf` |
| `netlify.toml` | Не используется | Деплой через GitHub Pages |
| `vercel.json` | Не используется | Деплой через GitHub Pages |

### 5. Устаревшие документы

| Файл | Причина удаления | Статус |
|------|------------------|--------|
| `NEXT_STEPS.md` | Задачи выполнены | ✅ Завершено |
| `PWA_MIGRATION_GUIDE.md` | Миграция завершена | ✅ Завершено |
| `DASHBOARD_READY.md` | Дашборд готов и развёрнут | ✅ Завершено |

## Итого удалено

- **14 файлов**
- Освобождено места: ~500 KB
- Структура проекта стала чище и понятнее

## Проверка целостности

✅ Все импорты в `App.jsx` используют новые компоненты  
✅ Линтер не показывает ошибок  
✅ Проект компилируется без ошибок  

## Что осталось

### Актуальные файлы PWA (корень)
- `index.html` - главная страница PWA
- `app.js` - основная логика PWA
- `styles.css` - стили PWA
- `sw.js` - Service Worker
- `manifest.webmanifest` - манифест PWA
- `vendor-idb.js` - библиотека IndexedDB

### Актуальные папки PWA
- `db/` - работа с IndexedDB
- `sync/` - синхронизация с API
- `state/` - управление состоянием
- `ui/` - UI компоненты (вкладки)
- `features/` - функции (wakelock, orientation)
- `assets/` - иконки PWA

### Дашборд
- `dashboard/` - React дашборд
  - `src/components/` - актуальные компоненты (New версии + Sidebar, Header, DeleteLogs)
  - `src/api/` - API клиент
  - `src/App.jsx` - главный компонент
  - `src/App.css` - стили

### Бэкенд
- `backend/` - FastAPI бэкенд
  - `app/` - код приложения
  - `docker-compose.yml` - Docker конфигурация
  - `Dockerfile` - образ Docker
  - `requirements.txt` - зависимости Python

### Документация (актуальная)
- `README.md` - главное описание проекта
- `DEPLOY_TO_VM.md` - инструкция по деплою на VM
- `MIGRATION_PLAN.md` - план миграции (для истории)
- `SYNC_TROUBLESHOOTING.md` - диагностика синхронизации
- `DEPLOY_SYNC_FIX.md` - инструкция по деплою фикса синхронизации
- `HOTFIX_DEPLOY_INSTRUCTIONS.md` - инструкция по деплою hotfix
- `backend/DEPLOYMENT.md` - деплой бэкенда
- `backend/HOTFIX_DATE_RANGE.md` - hotfix для диапазона дат
- `backend/README.md` - описание бэкенда
- `dashboard/README.md` - описание дашборда
- `dashboard/QUICK_START.md` - быстрый старт дашборда
- `dashboard/DEBUG.md` - отладка дашборда
- `dashboard/DATE_FILTER_DEBUG.md` - отладка фильтров дат
- `dashboard/CHANGELOG.md` - история изменений дашборда
- `dashboard/DEPLOY.md` - деплой дашборда

### Скрипты деплоя
- `deploy_hotfix.ps1` / `deploy_hotfix.sh` - деплой hotfix на сервер
- `dashboard/deploy.ps1` / `dashboard/deploy.sh` - деплой дашборда на сервер

### Конфигурации
- `_redirects` - редиректы для GitHub Pages
- `robots.txt` - для поисковых систем
- `CNAME` - домен для GitHub Pages (если используется)

### Google Apps Script (для истории)
- `apps-script/` - старый код Google Apps Script (для справки)

## Рекомендации

### Можно оставить (для истории)
- `MIGRATION_PLAN.md` - полезно для понимания истории проекта
- `apps-script/` - может пригодиться для сравнения со старой версией

### Можно удалить позже (после полного тестирования)
- `_redirects` - если не используется
- `CNAME` - если не используется кастомный домен
- `robots.txt` - если не нужна индексация

### Не удалять!
- Все файлы в `backend/`, `dashboard/src/`, корневые файлы PWA (`app.js`, `index.html`, `styles.css`, `sw.js`)
- Актуальную документацию
- Скрипты деплоя

