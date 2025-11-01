# PowerShell скрипт для деплоя hotfix на сервер

Write-Host "🚀 Deploying date_range hotfix to server..." -ForegroundColor Green

# Проверка, что мы в правильной директории
if (-not (Test-Path "backend/app/api/dashboard.py")) {
    Write-Host "❌ Error: backend/app/api/dashboard.py not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Копирование файла на сервер
Write-Host "📤 Copying dashboard.py to server..." -ForegroundColor Cyan
scp backend/app/api/dashboard.py ubuntu@51.250.107.231:~/scanner/backend/app/api/

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to copy file to server!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ File copied successfully!" -ForegroundColor Green

# Перезапуск бэкенда на сервере
Write-Host "🔄 Restarting backend on server..." -ForegroundColor Cyan
ssh ubuntu@51.250.107.231 "cd ~/scanner && docker-compose restart backend"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to restart backend!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend restarted successfully!" -ForegroundColor Green

# Показать логи
Write-Host "`n📋 Showing backend logs (Ctrl+C to exit)..." -ForegroundColor Cyan
Write-Host "Look for: '📅 Date range:' messages" -ForegroundColor Yellow
Write-Host ""
ssh ubuntu@51.250.107.231 "cd ~/scanner && docker-compose logs -f --tail=50 backend"

