# 🚀 Инструкция по развертыванию Scanner Logger Backend

## 📋 Содержание
1. [Подготовка VM](#подготовка-vm)
2. [Установка зависимостей](#установка-зависимостей)
3. [Настройка приложения](#настройка-приложения)
4. [Деплой с Docker Compose](#деплой-с-docker-compose)
5. [Настройка SSL (Let's Encrypt)](#настройка-ssl)
6. [Миграция данных из Google Sheets](#миграция-данных)
7. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)

---

## 🖥️ Подготовка VM

### Требования к серверу
- **CPU**: 2 vCPU
- **RAM**: 4 GB
- **Диск**: 20 GB SSD
- **ОС**: Ubuntu 22.04 LTS или новее
- **Сеть**: Статический IP адрес

### Создание VM (Yandex Cloud пример)

```bash
# Через Yandex Cloud CLI
yc compute instance create \
  --name scanner-logger \
  --zone ru-central1-a \
  --cores 2 \
  --memory 4 \
  --create-boot-disk size=20,type=network-ssd,image-folder-id=standard-images,image-family=ubuntu-2204-lts \
  --network-interface subnet-name=default,nat-ip-version=ipv4 \
  --ssh-key ~/.ssh/id_rsa.pub
```

### Подключение к серверу

```bash
ssh ubuntu@<YOUR_SERVER_IP>
```

---

## 📦 Установка зависимостей

### 1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка Docker

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверка
docker --version
```

### 3. Установка Docker Compose

```bash
# Docker Compose уже включен в Docker Desktop
# Если нужна отдельная установка:
sudo apt install docker-compose-plugin -y

# Проверка
docker compose version
```

### 4. Установка дополнительных утилит

```bash
sudo apt install -y git curl wget htop nginx certbot python3-certbot-nginx
```

---

## ⚙️ Настройка приложения

### 1. Клонирование репозитория

```bash
cd /opt
sudo git clone https://github.com/your-repo/scanner-logger-pwa.git
sudo chown -R $USER:$USER scanner-logger-pwa
cd scanner-logger-pwa/backend
```

### 2. Настройка переменных окружения

```bash
# Скопировать пример конфига
cp .env.example .env

# Отредактировать .env
nano .env
```

**Важные переменные в `.env`**:

```env
# Database
DATABASE_URL=postgresql+asyncpg://scanner:STRONG_PASSWORD_HERE@postgres:5432/scanner_logger
DATABASE_PASSWORD=STRONG_PASSWORD_HERE

# API Security
API_KEY=GENERATE_RANDOM_KEY_HERE_32_CHARS_MIN

# CORS (замени на адрес твоей PWA)
CORS_ORIGINS=https://your-pwa-domain.com,http://localhost:3000

# Redis
REDIS_URL=redis://redis:6379/0

# App
DEBUG=False
LOG_LEVEL=INFO
```

**Генерация случайного API ключа**:

```bash
# Сгенерировать случайный ключ (64 символа)
openssl rand -hex 32
```

### 3. Создание директорий для данных

```bash
mkdir -p logs nginx/ssl
chmod 755 logs nginx/ssl
```

---

## 🐳 Деплой с Docker Compose

### 1. Сборка и запуск контейнеров

```bash
# Сборка образов
docker compose build

# Запуск в фоновом режиме
docker compose up -d

# Проверка статуса
docker compose ps
```

**Ожидаемый вывод**:

```
NAME                COMMAND                  SERVICE     STATUS      PORTS
scanner-backend     "uvicorn app.main:ap…"   backend     running     0.0.0.0:8000->8000/tcp
scanner-postgres    "docker-entrypoint.s…"   postgres    running     0.0.0.0:5432->5432/tcp
scanner-redis       "docker-entrypoint.s…"   redis       running     0.0.0.0:6379->6379/tcp
scanner-nginx       "/docker-entrypoint.…"   nginx       running     0.0.0.0:80->80/tcp, 443/tcp
```

### 2. Проверка работоспособности

```bash
# Health check
curl http://localhost:8000/health

# API docs
curl http://localhost:8000/docs

# Логи backend
docker compose logs -f backend
```

### 3. Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Только backend
docker compose logs -f backend

# Только PostgreSQL
docker compose logs -f postgres

# Последние 100 строк
docker compose logs --tail=100 backend
```

---

## 🔒 Настройка SSL (Let's Encrypt)

### 1. Настройка DNS

Убедись, что доменное имя указывает на IP твоего сервера:

```bash
# Проверка DNS записи
nslookup api.yourdomain.com

# Или
dig api.yourdomain.com +short
```

### 2. Получение SSL сертификата

```bash
# Остановить Nginx в Docker (временно)
docker compose stop nginx

# Получить сертификат
sudo certbot certonly --standalone -d api.yourdomain.com

# Копировать сертификаты в nginx/ssl
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem

# Запустить Nginx обратно
docker compose start nginx
```

### 3. Настройка Nginx для HTTPS

Отредактируй `nginx/nginx.conf` - раскомментируй секцию HTTPS server:

```bash
nano nginx/nginx.conf
```

Перезапусти Nginx:

```bash
docker compose restart nginx
```

### 4. Автоматическое обновление сертификатов

```bash
# Добавить cron job для обновления сертификатов
sudo crontab -e

# Добавить строку (обновление каждую неделю)
0 3 * * 0 certbot renew --quiet && docker compose -f /opt/scanner-logger-pwa/backend/docker-compose.yml restart nginx
```

---

## 📊 Миграция данных из Google Sheets

### 1. Подготовка credentials.json

1. Создай Service Account в Google Cloud Console
2. Включи Google Sheets API и Google Drive API
3. Скачай `credentials.json`
4. Дай доступ к таблице для email из Service Account

### 2. Загрузка credentials на сервер

```bash
# На локальной машине
scp credentials.json ubuntu@<SERVER_IP>:/opt/scanner-logger-pwa/backend/

# На сервере
chmod 600 /opt/scanner-logger-pwa/backend/credentials.json
```

### 3. Запуск миграции

```bash
# Войти в backend контейнер
docker compose exec backend bash

# Запустить скрипт миграции (DRY RUN для теста)
python scripts/migrate_from_sheets.py \
  --spreadsheet-id "1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4" \
  --credentials credentials.json \
  --dry-run

# Реальная миграция (если dry-run прошел успешно)
python scripts/migrate_from_sheets.py \
  --spreadsheet-id "1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4" \
  --credentials credentials.json
```

### 4. Проверка данных после миграции

```bash
# Подключиться к PostgreSQL
docker compose exec postgres psql -U scanner -d scanner_logger

# SQL запросы для проверки
SELECT COUNT(*) FROM events;
SELECT type, COUNT(*) FROM events GROUP BY type;
SELECT DATE(ts) as date, COUNT(*) FROM events GROUP BY DATE(ts) ORDER BY date DESC LIMIT 10;

# Выход из psql
\q
```

---

## 📈 Мониторинг и обслуживание

### Логи приложения

```bash
# Backend логи (realtime)
docker compose logs -f backend

# Логи с временными метками
docker compose logs -f --timestamps backend

# Ошибки PostgreSQL
docker compose logs postgres | grep ERROR
```

### Метрики (Prometheus)

Метрики доступны по адресу:
```
http://your-server-ip:8000/metrics
```

### Бэкап PostgreSQL

**Автоматический бэкап каждые 6 часов**:

```bash
# Создать скрипт бэкапа
cat > /opt/backup-postgres.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR

docker compose -f /opt/scanner-logger-pwa/backend/docker-compose.yml \
  exec -T postgres pg_dump -U scanner scanner_logger | gzip > $BACKUP_DIR/scanner_logger_$DATE.sql.gz

# Удалить бэкапы старше 7 дней
find $BACKUP_DIR -name "scanner_logger_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup-postgres.sh

# Добавить в crontab (каждые 6 часов)
sudo crontab -e
# Добавить строку:
0 */6 * * * /opt/backup-postgres.sh
```

**Ручной бэкап**:

```bash
# Создать бэкап
docker compose exec postgres pg_dump -U scanner scanner_logger > backup_$(date +%Y%m%d).sql

# Восстановление из бэкапа
docker compose exec -T postgres psql -U scanner scanner_logger < backup_20251031.sql
```

### Обновление приложения

```bash
# 1. Остановить backend (оставить БД работать)
docker compose stop backend

# 2. Обновить код
git pull origin main

# 3. Пересобрать образ
docker compose build backend

# 4. Запустить обновленный backend
docker compose up -d backend

# 5. Проверить логи
docker compose logs -f backend
```

### Перезапуск сервисов

```bash
# Перезапуск всех сервисов
docker compose restart

# Только backend
docker compose restart backend

# С пересборкой
docker compose down && docker compose up -d --build
```

### Мониторинг ресурсов

```bash
# CPU и Memory использование контейнерами
docker stats

# Размер дисков
df -h

# Использование места PostgreSQL
docker compose exec postgres du -sh /var/lib/postgresql/data
```

### Очистка неиспользуемых ресурсов

```bash
# Очистка Docker
docker system prune -a --volumes

# Логи PostgreSQL
docker compose exec postgres bash -c "rm -f /var/lib/postgresql/data/log/*"
```

---

## 🔥 Troubleshooting

### Проблема: Backend не запускается

```bash
# Проверить логи
docker compose logs backend

# Проверить переменные окружения
docker compose exec backend env | grep DATABASE_URL

# Перезапустить с пересборкой
docker compose down
docker compose up -d --build
```

### Проблема: PostgreSQL не доступен

```bash
# Проверить статус
docker compose ps postgres

# Проверить логи
docker compose logs postgres

# Проверить подключение изнутри backend
docker compose exec backend python -c "from app.database import check_connection; import asyncio; asyncio.run(check_connection())"
```

### Проблема: Медленные запросы

```bash
# Подключиться к PostgreSQL
docker compose exec postgres psql -U scanner -d scanner_logger

# Включить логирование медленных запросов
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

# Посмотреть медленные запросы
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Проблема: Нет места на диске

```bash
# Проверить использование
df -h

# Найти большие файлы
du -sh /opt/scanner-logger-pwa/*
du -sh /var/lib/docker/*

# Очистить старые логи
docker compose exec backend bash -c "rm -rf logs/*.log.old"

# Очистить Docker
docker system prune -a --volumes
```

---

## 📚 Полезные команды

```bash
# === Docker Compose ===
docker compose up -d              # Запустить все сервисы
docker compose down               # Остановить и удалить контейнеры
docker compose ps                 # Статус сервисов
docker compose logs -f service    # Логи сервиса
docker compose restart service    # Перезапуск сервиса
docker compose exec service bash  # Войти в контейнер

# === PostgreSQL ===
docker compose exec postgres psql -U scanner -d scanner_logger
# Внутри psql:
\dt                              # Список таблиц
\d events                        # Структура таблицы events
SELECT COUNT(*) FROM events;     # Количество записей

# === Backend ===
docker compose exec backend python -c "from app import main; print('OK')"

# === Nginx ===
docker compose exec nginx nginx -t              # Проверка конфига
docker compose exec nginx nginx -s reload       # Перезагрузка конфига
```

---

## ✅ Чек-лист после деплоя

- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] Health check работает (`curl http://localhost:8000/health`)
- [ ] API docs доступны (`http://your-ip:8000/docs`)
- [ ] PostgreSQL доступен (проверка подключения)
- [ ] SSL сертификаты получены (если используется HTTPS)
- [ ] Nginx конфигурация корректна
- [ ] Бэкапы настроены (cron job)
- [ ] Логи пишутся в `logs/` директорию
- [ ] PWA может подключиться к API
- [ ] Данные мигрированы из Google Sheets (если нужно)

---

## 🆘 Поддержка

Если возникли проблемы:

1. **Проверь логи**: `docker compose logs -f`
2. **Проверь .env файл**: правильность DATABASE_URL, API_KEY
3. **Проверь firewall**: порты 80, 443, 8000 должны быть открыты
4. **Проверь DNS**: домен должен указывать на IP сервера
5. **GitHub Issues**: создай issue с описанием проблемы и логами

---

**Готово! Backend успешно развернут! 🎉**

