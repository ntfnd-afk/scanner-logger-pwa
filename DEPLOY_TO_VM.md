# 🚀 Развертывание Scanner Logger на вашу VM (51.250.107.231)

## 📦 Что нужно перенести на сервер

Из текущей папки `c:\Fulfillment\scanner-logger-pwa\` нужно перенести **только backend**:

```
scanner/                          # Новая папка на VM
├── docker-compose.yml           # ✅ Нужен
├── Dockerfile                   # ✅ Нужен
├── requirements.txt             # ✅ Нужен
├── .env                         # ✅ Создать на сервере
├── app/                         # ✅ Весь код приложения
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   ├── schemas/
│   └── api/
├── scripts/                     # ✅ Скрипт миграции
│   └── migrate_from_sheets.py
└── nginx/                       # ✅ Конфигурация Nginx
    └── nginx.conf
```

**НЕ нужно переносить**:
- ❌ PWA файлы (index.html, app.js, styles.css) - они останутся на GitHub Pages
- ❌ Документацию (.md файлы) - опционально
- ❌ .git папку

---

## 🎯 Пошаговая инструкция

### Шаг 1: Подготовка файлов локально

На вашем Windows компьютере:

```powershell
# Перейти в папку backend
cd C:\Fulfillment\scanner-logger-pwa\backend

# Создать .env файл из примера
copy .env.example .env

# Отредактировать .env (откроется в блокноте)
notepad .env
```

**Важные настройки в .env**:

```env
# PostgreSQL
DATABASE_URL=postgresql+asyncpg://scanner:STRONG_PASSWORD_123@postgres:5432/scanner_logger
DATABASE_PASSWORD=STRONG_PASSWORD_123

# API Security (сгенерируй случайный ключ)
API_KEY=scanner_api_key_a8f7d9c2b1e4f6a3d5c8b9e2f1a4d7c6

# CORS (адрес твоей PWA на GitHub Pages)
CORS_ORIGINS=https://your-github-username.github.io,https://51.250.107.231

# App
DEBUG=False
LOG_LEVEL=INFO
TIMEZONE=Europe/Moscow

# Redis
REDIS_URL=redis://redis:6379/0
CACHE_TTL=10
```

**Генерация случайного API ключа** (в PowerShell):
```powershell
# Или просто используй любой длинный случайный набор символов (32+ символа)
"scanner_api_key_" + -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### Шаг 2: Подключение к VM

```bash
ssh ubuntu@51.250.107.231
```

### Шаг 3: Создание структуры на сервере

На VM выполни:

```bash
# Создать папку для проекта
cd /opt
sudo mkdir scanner
sudo chown $USER:$USER scanner
cd scanner

# Создать нужные директории
mkdir -p app/models app/schemas app/api scripts nginx logs
```

### Шаг 4: Перенос файлов на сервер

**Вариант А: Через SCP (рекомендуется)**

На вашем Windows компьютере (PowerShell):

```powershell
cd C:\Fulfillment\scanner-logger-pwa\backend

# Перенести все файлы одной командой
scp -r app docker-compose.yml Dockerfile requirements.txt .env nginx scripts ubuntu@51.250.107.231:/opt/scanner/
```

**Вариант Б: Через Git (если есть приватный репозиторий)**

На VM:
```bash
cd /opt/scanner
git clone https://github.com/your-repo/scanner-logger-pwa.git temp
mv temp/backend/* .
rm -rf temp

# Создать .env
nano .env
# Вставить содержимое из локального .env файла (Ctrl+Shift+V для вставки в nano)
# Сохранить: Ctrl+X, Y, Enter
```

**Вариант В: Копирование вручную (если файлов мало)**

Для каждого файла на Windows создай файл на VM через nano:

```bash
# На VM
cd /opt/scanner
nano docker-compose.yml
# Скопируй содержимое из локального файла, вставь в nano (Ctrl+Shift+V)
# Сохрани: Ctrl+X, Y, Enter

# Повторить для всех файлов
nano Dockerfile
nano requirements.txt
nano .env
# и т.д.
```

### Шаг 5: Проверка структуры файлов

На VM:

```bash
cd /opt/scanner

# Проверить структуру
tree -L 2
# Или
ls -la
ls -la app/
ls -la nginx/
```

Должно быть примерно так:
```
/opt/scanner/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   ├── schemas/
│   └── api/
├── scripts/
│   └── migrate_from_sheets.py
├── nginx/
│   └── nginx.conf
└── logs/
```

### Шаг 6: Запуск проекта

```bash
cd /opt/scanner

# Проверить что Docker работает
docker --version
docker compose version

# Запустить все сервисы
docker compose up -d

# Проверить статус
docker compose ps
```

**Ожидаемый вывод**:
```
NAME                IMAGE               STATUS      PORTS
scanner-backend     scanner-backend     running     0.0.0.0:8000->8000/tcp
scanner-postgres    postgres:15-alpine  running     0.0.0.0:5432->5432/tcp
scanner-redis       redis:7-alpine      running     0.0.0.0:6379->6379/tcp
scanner-nginx       nginx:alpine        running     0.0.0.0:80->80/tcp
```

### Шаг 7: Проверка работоспособности

```bash
# Health check
curl http://localhost:8000/health

# Должен вернуть:
# {"status":"healthy","version":"1.0.0","database":"connected"}

# Проверить логи
docker compose logs -f backend

# Если все ОК, выйти из логов: Ctrl+C
```

### Шаг 8: Проверка снаружи

На вашем Windows компьютере (браузер или PowerShell):

```powershell
# Проверить доступность API
curl http://51.250.107.231:8000/health

# Или открыть в браузере:
# http://51.250.107.231:8000/docs
```

**Если не работает** - проверь firewall:

```bash
# На VM
sudo ufw status

# Если firewall включен - открой порты
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp
```

---

## 🔒 Настройка SSL (опционально, для продакшна)

Если у тебя есть домен (например, `api.yourdomain.com`):

### 1. Настроить DNS

Добавь A-запись в DNS:
```
api.yourdomain.com → 51.250.107.231
```

### 2. Получить SSL сертификат

```bash
# На VM
cd /opt/scanner

# Остановить Nginx временно
docker compose stop nginx

# Установить certbot (если еще не установлен)
sudo apt install certbot -y

# Получить сертификат
sudo certbot certonly --standalone -d api.yourdomain.com

# Копировать сертификаты
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem

# Раскомментировать HTTPS секцию в nginx.conf
nano nginx/nginx.conf
# Найти блок "# server {" для HTTPS и раскомментировать

# Запустить Nginx обратно
docker compose start nginx

# Или перезапустить все
docker compose restart
```

### 3. Автообновление сертификатов

```bash
# Добавить cron job
sudo crontab -e

# Добавить строку (обновление каждую неделю):
0 3 * * 0 certbot renew --quiet && docker compose -f /opt/scanner/docker-compose.yml restart nginx
```

---

## 🔧 Обновление PWA для работы с новым API

После того как backend запущен, обнови PWA:

### В настройках PWA (через UI):

1. Открой PWA в браузере
2. Открой меню (≡)
3. В поле **SYNC_URL** укажи:
   ```
   http://51.250.107.231:8000/api/v1
   ```
   Или если настроил SSL:
   ```
   https://api.yourdomain.com/api/v1
   ```

4. В поле **API Key** укажи ключ из `.env`:
   ```
   scanner_api_key_a8f7d9c2b1e4f6a3d5c8b9e2f1a4d7c6
   ```

5. Нажми **"Сохранить настройки"**

6. Нажми **"Синхронизация"** или отсканируй тестовое событие

### Проверка:

```bash
# На VM проверить логи
docker compose logs -f backend

# Должны появиться запросы:
# POST /api/v1/events/batch
```

```bash
# Проверить данные в PostgreSQL
docker compose exec postgres psql -U scanner -d scanner_logger

# Внутри psql:
SELECT COUNT(*) FROM events;
SELECT * FROM events ORDER BY received_at DESC LIMIT 5;

# Выход: \q
```

---

## 📊 Миграция данных из Google Sheets (опционально)

Если нужно перенести старые данные:

### 1. Подготовить credentials.json

На Windows:
1. Создай Service Account в Google Cloud Console
2. Скачай `credentials.json`
3. Дай доступ к таблице для email из Service Account

### 2. Загрузить на сервер

```powershell
# На Windows
scp credentials.json ubuntu@51.250.107.231:/opt/scanner/
```

### 3. Запустить миграцию

```bash
# На VM
cd /opt/scanner

# Войти в backend контейнер
docker compose exec backend bash

# Тестовый запуск (dry-run)
python scripts/migrate_from_sheets.py \
  --spreadsheet-id "1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4" \
  --credentials /app/credentials.json \
  --dry-run

# Если все ОК - реальная миграция (без --dry-run)
python scripts/migrate_from_sheets.py \
  --spreadsheet-id "1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4" \
  --credentials /app/credentials.json

# Выход из контейнера
exit
```

---

## 🔍 Мониторинг и обслуживание

### Просмотр логов

```bash
cd /opt/scanner

# Все сервисы (realtime)
docker compose logs -f

# Только backend
docker compose logs -f backend

# Только ошибки
docker compose logs backend | grep ERROR

# Последние 100 строк
docker compose logs --tail=100 backend
```

### Перезапуск сервисов

```bash
# Перезапуск всех
docker compose restart

# Только backend
docker compose restart backend

# С пересборкой (после изменения кода)
docker compose down
docker compose up -d --build
```

### Бэкап PostgreSQL

```bash
# Ручной бэкап
docker compose exec postgres pg_dump -U scanner scanner_logger > backup_$(date +%Y%m%d).sql

# Восстановление
docker compose exec -T postgres psql -U scanner scanner_logger < backup_20251031.sql
```

### Автоматический бэкап (каждые 6 часов)

```bash
# Создать скрипт
cat > /opt/backup-scanner.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/scanner"
mkdir -p $BACKUP_DIR

docker compose -f /opt/scanner/docker-compose.yml \
  exec -T postgres pg_dump -U scanner scanner_logger | gzip > $BACKUP_DIR/scanner_$DATE.sql.gz

# Удалить бэкапы старше 7 дней
find $BACKUP_DIR -name "scanner_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup-scanner.sh

# Добавить в crontab
crontab -e
# Добавить:
0 */6 * * * /opt/backup-scanner.sh
```

---

## ✅ Чек-лист после развертывания

- [ ] Файлы перенесены на сервер (`/opt/scanner/`)
- [ ] `.env` файл создан и настроен
- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] Health check работает (`curl http://localhost:8000/health`)
- [ ] API docs доступны (`http://51.250.107.231:8000/docs`)
- [ ] PWA обновлена с новым SYNC_URL и API_KEY
- [ ] Тестовое событие успешно отправлено и записано в БД
- [ ] Логи не содержат ошибок (`docker compose logs backend`)
- [ ] Firewall настроен (порты 80, 8000 открыты)
- [ ] Бэкапы настроены (опционально)

---

## 🆘 Решение проблем

### Проблема: "Cannot connect to Docker daemon"

```bash
# Проверить статус Docker
sudo systemctl status docker

# Запустить Docker
sudo systemctl start docker

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker
```

### Проблема: Порт 8000 уже занят

```bash
# Найти что занимает порт
sudo lsof -i :8000

# Или изменить порт в docker-compose.yml:
nano docker-compose.yml
# Изменить "8000:8000" на "8001:8000"

docker compose down
docker compose up -d
```

### Проблема: Backend не может подключиться к PostgreSQL

```bash
# Проверить логи PostgreSQL
docker compose logs postgres

# Проверить что контейнеры в одной сети
docker network ls
docker network inspect scanner_scanner-net

# Перезапустить все
docker compose down
docker compose up -d
```

### Проблема: Permission denied при создании файлов

```bash
# Дать права на папку
sudo chown -R $USER:$USER /opt/scanner

# Или для конкретной папки
sudo chmod 755 /opt/scanner/logs
```

---

## 📞 Если что-то пошло не так

1. **Проверь логи**: `docker compose logs -f backend`
2. **Проверь статус**: `docker compose ps`
3. **Проверь .env**: `cat .env` (все ли переменные заполнены?)
4. **Проверь firewall**: `sudo ufw status`
5. **Перезапусти все**: `docker compose down && docker compose up -d`

---

## 🎉 Готово!

После выполнения всех шагов:
- ✅ Backend развернут на `http://51.250.107.231:8000`
- ✅ API docs: `http://51.250.107.231:8000/docs`
- ✅ PWA работает с новым API
- ✅ Данные пишутся в PostgreSQL

**Скорость записи теперь < 50 мс вместо 3000 мс! 🚀**

