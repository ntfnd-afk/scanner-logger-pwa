#!/bin/bash
# 🚀 Скрипт деплоя Dashboard на VM
# Использование: ./deploy_to_vm.sh

SERVER="ubuntu@51.250.107.231"
TARGET_DIR="/var/www/scanner-dashboard"

echo "🚀 Деплой Scanner Dashboard на VM"
echo "Server: $SERVER"
echo "Target: $TARGET_DIR"
echo ""

# Шаг 1: Проверка что мы в правильной папке
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден!"
    echo "Запустите скрипт из папки dashboard/"
    exit 1
fi

# Шаг 2: Установка зависимостей (если нужно)
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка при установке зависимостей"
        exit 1
    fi
fi

# Шаг 3: Сборка проекта
echo "🔨 Сборка проекта..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при сборке проекта"
    exit 1
fi

# Проверка что dist существует
if [ ! -d "dist" ]; then
    echo "❌ Ошибка: папка dist не создана!"
    exit 1
fi

echo "✅ Сборка завершена успешно"
echo ""

# Шаг 4: Создание папки на сервере (если не существует)
echo "📁 Создание папки на сервере..."
ssh $SERVER "sudo mkdir -p $TARGET_DIR && sudo chown ubuntu:ubuntu $TARGET_DIR"

# Шаг 5: Копирование файлов на сервер
echo "📤 Копирование файлов на сервер..."
echo "Это может занять некоторое время..."

scp -r dist/* $SERVER:$TARGET_DIR/
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при копировании файлов"
    exit 1
fi

echo "✅ Файлы скопированы успешно"
echo ""

# Шаг 6: Проверка Nginx
echo "🔍 Проверка конфигурации Nginx..."
ssh $SERVER "docker exec wbd_nginx nginx -t" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Конфигурация Nginx корректна"
    
    # Перезапуск Nginx
    echo "🔄 Перезапуск Nginx..."
    ssh $SERVER "docker exec wbd_nginx nginx -s reload"
    if [ $? -eq 0 ]; then
        echo "✅ Nginx перезапущен"
    else
        echo "⚠️  Не удалось перезапустить Nginx"
    fi
else
    echo "⚠️  Nginx не настроен или есть ошибки в конфигурации"
    echo "Запустите настройку Nginx вручную (см. DASHBOARD_DEPLOY_VM.md)"
fi

echo ""
echo "🎉 Деплой завершён!"
echo ""
echo "📊 Проверьте дашборд:"
echo "  • https://dashboard.fulfilment-one.ru"
echo "  • http://51.250.107.231:8080 (если настроен порт)"
echo ""
echo "💡 Если дашборд не открывается:"
echo "  1. Проверьте DNS: dashboard.fulfilment-one.ru → 51.250.107.231"
echo "  2. Настройте Nginx (см. DASHBOARD_DEPLOY_VM.md, Шаг 3)"
echo "  3. Получите SSL сертификат (см. DASHBOARD_DEPLOY_VM.md, Шаг 6)"
echo ""

