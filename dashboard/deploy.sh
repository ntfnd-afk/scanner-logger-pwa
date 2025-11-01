#!/bin/bash

# Скрипт для деплоя dashboard на сервер

set -e

echo "🚀 Деплой Scanner Dashboard"
echo "=============================="

# Сборка
echo "📦 Сборка приложения..."
npm run build

# Копирование на сервер
echo "📤 Копирование файлов на сервер..."
SERVER="ubuntu@51.250.107.231"
TARGET_DIR="/var/www/scanner-dashboard"

# Создаём папку если её нет
ssh $SERVER "mkdir -p $TARGET_DIR"

# Копируем файлы
scp -r dist/* $SERVER:$TARGET_DIR/

echo "✅ Деплой завершён!"
echo "🌐 Откройте: https://dashboard.fulfilment-one.ru"

