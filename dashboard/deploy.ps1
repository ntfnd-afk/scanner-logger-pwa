# PowerShell скрипт для деплоя dashboard на сервер

Write-Host "🚀 Деплой Scanner Dashboard" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

# Сборка
Write-Host "📦 Сборка приложения..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка сборки!" -ForegroundColor Red
    exit 1
}

# Копирование на сервер
Write-Host "📤 Копирование файлов на сервер..." -ForegroundColor Yellow
$SERVER = "ubuntu@51.250.107.231"
$TARGET_DIR = "/var/www/scanner-dashboard"

# Создаём папку если её нет
ssh $SERVER "mkdir -p $TARGET_DIR"

# Копируем файлы
scp -r dist/* "${SERVER}:${TARGET_DIR}/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Деплой завершён!" -ForegroundColor Green
    Write-Host "🌐 Откройте: https://dashboard.fulfilment-one.ru" -ForegroundColor Cyan
} else {
    Write-Host "❌ Ошибка деплоя!" -ForegroundColor Red
    exit 1
}

