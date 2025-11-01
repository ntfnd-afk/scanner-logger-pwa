FROM python:3.11-slim

# Установить зависимости системы
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Рабочая директория
WORKDIR /app

# Копировать requirements и установить зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копировать код приложения
COPY ./app /app/app
COPY ./migrations /app/migrations
COPY ./alembic.ini /app/alembic.ini

# Создать директорию для логов
RUN mkdir -p /app/logs

# Пользователь без root прав
RUN useradd -m -u 1000 scanner && chown -R scanner:scanner /app
USER scanner

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Запуск приложения
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

