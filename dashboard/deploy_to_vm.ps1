# 🚀 Скрипт деплоя Dashboard на VM
# Использование: .\deploy_to_vm.ps1

param(
    [string]$Server = "ubuntu@51.250.107.231",
    [string]$TargetDir = "/var/www/scanner-dashboard"
)

Write-Host "🚀 Деплой Scanner Dashboard на VM" -ForegroundColor Cyan
Write-Host "Server: $Server" -ForegroundColor Gray
Write-Host "Target: $TargetDir" -ForegroundColor Gray
Write-Host ""

# Шаг 1: Проверка что мы в правильной папке
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Ошибка: package.json не найден!" -ForegroundColor Red
    Write-Host "Запустите скрипт из папки dashboard/" -ForegroundColor Yellow
    exit 1
}

# Шаг 2: Установка зависимостей (если нужно)
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Установка зависимостей..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка при установке зависимостей" -ForegroundColor Red
        exit 1
    }
}

# Шаг 3: Сборка проекта
Write-Host "🔨 Сборка проекта..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при сборке проекта" -ForegroundColor Red
    exit 1
}

# Проверка что dist существует
if (-not (Test-Path "dist")) {
    Write-Host "❌ Ошибка: папка dist не создана!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Сборка завершена успешно" -ForegroundColor Green
Write-Host ""

# Шаг 4: Создание папки на сервере (если не существует)
Write-Host "📁 Создание папки на сервере..." -ForegroundColor Yellow
ssh $Server "sudo mkdir -p $TargetDir && sudo chown ubuntu:ubuntu $TargetDir"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Предупреждение: не удалось создать папку (возможно, уже существует)" -ForegroundColor Yellow
}

# Шаг 5: Копирование файлов на сервер
Write-Host "📤 Копирование файлов на сервер..." -ForegroundColor Yellow
Write-Host "Это может занять некоторое время..." -ForegroundColor Gray

# Используем scp для копирования
scp -r dist/* "$Server`:$TargetDir/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при копировании файлов" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Файлы скопированы успешно" -ForegroundColor Green
Write-Host ""

# Шаг 6: Проверка Nginx
Write-Host "🔍 Проверка конфигурации Nginx..." -ForegroundColor Yellow
$nginxCheck = ssh $Server "docker exec wbd_nginx nginx -t 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Конфигурация Nginx корректна" -ForegroundColor Green
    
    # Перезапуск Nginx
    Write-Host "🔄 Перезапуск Nginx..." -ForegroundColor Yellow
    ssh $Server "docker exec wbd_nginx nginx -s reload"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Nginx перезапущен" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Не удалось перезапустить Nginx" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Nginx не настроен или есть ошибки в конфигурации" -ForegroundColor Yellow
    Write-Host "Запустите настройку Nginx вручную (см. DASHBOARD_DEPLOY_VM.md)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🎉 Деплой завершён!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Проверьте дашборд:" -ForegroundColor Cyan
Write-Host "  • https://dashboard.fulfilment-one.ru" -ForegroundColor White
Write-Host "  • http://51.250.107.231:8080 (если настроен порт)" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Если дашборд не открывается:" -ForegroundColor Yellow
Write-Host "  1. Проверьте DNS: dashboard.fulfilment-one.ru → 51.250.107.231" -ForegroundColor Gray
Write-Host "  2. Настройте Nginx (см. DASHBOARD_DEPLOY_VM.md, Шаг 3)" -ForegroundColor Gray
Write-Host "  3. Получите SSL сертификат (см. DASHBOARD_DEPLOY_VM.md, Шаг 6)" -ForegroundColor Gray
Write-Host ""

