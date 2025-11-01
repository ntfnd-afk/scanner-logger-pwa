# 🚀 Быстрый деплой Dashboard на VM (51.250.107.231)

## ✅ Что уже готово

- ✅ Dashboard собран локально (`dashboard/dist/`)
- ✅ API настроен на `https://scanner-api.fulfilment-one.ru`
- ✅ Backend уже работает на VM

## 📋 Пошаговая инструкция

### Шаг 1: Создать папку на сервере

```bash
ssh ubuntu@51.250.107.231
sudo mkdir -p /var/www/scanner-dashboard
sudo chown ubuntu:ubuntu /var/www/scanner-dashboard
exit
```

### Шаг 2: Скопировать файлы на сервер

На вашем Windows (из папки проекта):

```powershell
# Перейти в папку dashboard
cd C:\Fulfillment\scanner-logger-pwa\dashboard

# Скопировать собранные файлы на сервер
scp -r dist/* ubuntu@51.250.107.231:/var/www/scanner-dashboard/
```

### Шаг 3: Настроить Nginx

Подключитесь к серверу:

```bash
ssh ubuntu@51.250.107.231
```

Откройте конфиг Nginx:

```bash
sudo nano /home/ubuntu/apps/wbd/infra/nginx/nginx.conf
```

Добавьте в конец файла (перед последней закрывающей скобкой):

```nginx
# Scanner Dashboard
server {
    listen 80;
    server_name dashboard.fulfilment-one.ru;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.fulfilment-one.ru;

    # SSL сертификаты (используем те же что и для scanner-api)
    ssl_certificate /etc/letsencrypt/live/scanner-api.fulfilment-one.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scanner-api.fulfilment-one.ru/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Статические файлы
    root /var/www/scanner-dashboard;
    index index.html;

    # SPA routing (для React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

### Шаг 4: Проверить и перезапустить Nginx

```bash
# Проверить конфигурацию
docker exec wbd_nginx nginx -t

# Если всё ОК, перезапустить Nginx
docker exec wbd_nginx nginx -s reload
```

### Шаг 5: Настроить DNS

Добавьте A-запись в вашем DNS провайдере:

```
dashboard.fulfilment-one.ru  →  51.250.107.231
```

### Шаг 6: Получить SSL сертификат

```bash
# Получить сертификат для dashboard
docker exec wbd_certbot certbot certonly --webroot \
  -w /var/www/certbot \
  -d dashboard.fulfilment-one.ru \
  --email your@email.com \
  --agree-tos \
  --non-interactive
```

После получения сертификата, обновите конфиг Nginx (шаг 3), заменив:

```nginx
ssl_certificate /etc/letsencrypt/live/scanner-api.fulfilment-one.ru/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/scanner-api.fulfilment-one.ru/privkey.pem;
```

на:

```nginx
ssl_certificate /etc/letsencrypt/live/dashboard.fulfilment-one.ru/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/dashboard.fulfilment-one.ru/privkey.pem;
```

И перезапустите Nginx:

```bash
docker exec wbd_nginx nginx -s reload
```

---

## ✅ Проверка

Откройте в браузере:
- **HTTP**: http://dashboard.fulfilment-one.ru (должен редиректить на HTTPS)
- **HTTPS**: https://dashboard.fulfilment-one.ru

Вы должны увидеть дашборд с данными из API.

---

## 🔄 Обновление дашборда

Когда нужно обновить дашборд:

### На Windows:

```powershell
# 1. Перейти в папку dashboard
cd C:\Fulfillment\scanner-logger-pwa\dashboard

# 2. Собрать новую версию
npm run build

# 3. Скопировать на сервер
scp -r dist/* ubuntu@51.250.107.231:/var/www/scanner-dashboard/
```

Готово! Обновление применится мгновенно (может потребоваться Ctrl+F5 в браузере для очистки кэша).

---

## 🐛 Troubleshooting

### Проблема: "502 Bad Gateway"

**Причина**: Backend не работает или неправильный URL.

**Решение**:
```bash
# Проверить статус backend
ssh ubuntu@51.250.107.231
docker ps | grep scanner
docker logs scanner_api
```

### Проблема: "Нет данных"

**Причина**: API ключ неверный или CORS не настроен.

**Решение**:
1. Проверьте API ключ в `dashboard/src/api/client.js` (должен совпадать с backend)
2. Проверьте CORS в backend `.env`:
   ```env
   CORS_ORIGINS=https://dashboard.fulfilment-one.ru,https://51.250.107.231
   ```

### Проблема: "SSL certificate problem"

**Причина**: Сертификат не получен или неправильно настроен.

**Решение**:
```bash
# Проверить сертификаты
sudo ls -la /etc/letsencrypt/live/

# Получить новый сертификат (см. Шаг 6)
```

### Проблема: Белый экран

**Причина**: Неправильный base path или ошибка в JS.

**Решение**:
1. Откройте DevTools (F12) и посмотрите ошибки в консоли
2. Проверьте `vite.config.js` - `base` должен быть `'/'`
3. Пересоберите: `npm run build`

---

## 📊 Альтернатива: Доступ по IP (без домена)

Если у вас нет домена, можно настроить доступ по IP:

### Вариант 1: Через порт

```nginx
server {
    listen 8080;
    server_name 51.250.107.231;

    root /var/www/scanner-dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Доступ: http://51.250.107.231:8080

### Вариант 2: Через основной домен + путь

```nginx
location /dashboard {
    alias /var/www/scanner-dashboard;
    try_files $uri $uri/ /dashboard/index.html;
}
```

Доступ: https://scanner-api.fulfilment-one.ru/dashboard

**Важно**: При использовании пути нужно изменить `base` в `vite.config.js`:

```javascript
export default defineConfig({
  base: '/dashboard/',
  // ...
})
```

И пересобрать: `npm run build`

---

## 🎉 Готово!

Теперь у вас:
- ✅ PWA на GitHub Pages: https://ntfnd-afk.github.io/scanner-logger-pwa/
- ✅ Backend API: https://scanner-api.fulfilment-one.ru
- ✅ Dashboard: https://dashboard.fulfilment-one.ru

Все компоненты работают вместе! 🚀

