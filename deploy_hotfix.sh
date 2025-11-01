#!/bin/bash

# Bash скрипт для деплоя hotfix на сервер

echo "🚀 Deploying date_range hotfix to server..."

# Проверка, что мы в правильной директории
if [ ! -f "backend/app/api/dashboard.py" ]; then
    echo "❌ Error: backend/app/api/dashboard.py not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Копирование файла на сервер
echo "📤 Copying dashboard.py to server..."
scp backend/app/api/dashboard.py ubuntu@51.250.107.231:~/scanner/backend/app/api/

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy file to server!"
    exit 1
fi

echo "✅ File copied successfully!"

# Перезапуск бэкенда на сервере
echo "🔄 Restarting backend on server..."
ssh ubuntu@51.250.107.231 "cd ~/scanner && docker-compose restart backend"

if [ $? -ne 0 ]; then
    echo "❌ Failed to restart backend!"
    exit 1
fi

echo "✅ Backend restarted successfully!"

# Показать логи
echo ""
echo "📋 Showing backend logs (Ctrl+C to exit)..."
echo "Look for: '📅 Date range:' messages"
echo ""
ssh ubuntu@51.250.107.231 "cd ~/scanner && docker-compose logs -f --tail=50 backend"

