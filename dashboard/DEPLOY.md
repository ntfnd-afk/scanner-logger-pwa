# 🚀 Деплой Dashboard на сервер

## Вариант 1: Статический хостинг (рекомендуется)

### Шаг 1: Сборка

```bash
cd dashboard
npm run build
```

Результат будет в папке `dist/`

### Шаг 2: Копирование на сервер

```bash
# Создаём папку на сервере
ssh ubuntu@51.250.107.231 "mkdir -p /var/www/scanner-dashboard"

# Копируем файлы
scp -r dist/* ubuntu@51.250.107.231:/var/www/scanner-dashboard/
```

### Шаг 3: Настройка Nginx

Добавьте в конфиг Nginx (`/home/ubuntu/apps/wbd/infra/nginx/nginx.conf`):

```nginx
# Scanner Dashboard
server {
    listen 80;
    server_name dashboard.fulfilment-one.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.fulfilment-one.ru;

    # SSL сертификаты (используем те же что и для scanner-api)
    ssl_certificate /etc/letsencrypt/live/scanner-api.fulfilment-one.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scanner-api.fulfilment-one.ru/privkey.pem;

    # Статические файлы
    root /var/www/scanner-dashboard;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Шаг 4: Перезапуск Nginx

```bash
ssh ubuntu@51.250.107.231
docker exec wbd_nginx nginx -t
docker exec wbd_nginx nginx -s reload
```

### Шаг 5: DNS

Добавьте A-запись для `dashboard.fulfilment-one.ru` → `51.250.107.231`

### Шаг 6: SSL сертификат

```bash
ssh ubuntu@51.250.107.231
docker exec wbd_certbot certbot certonly --webroot \
  -w /var/www/certbot \
  -d dashboard.fulfilment-one.ru \
  --email your@email.com \
  --agree-tos \
  --non-interactive
```

---

## Вариант 2: GitHub Pages (альтернатива)

### Шаг 1: Настройка base path

В `vite.config.js`:

```javascript
export default defineConfig({
  base: '/scanner-dashboard/',
  // ...
})
```

### Шаг 2: Деплой

```bash
cd dashboard
npm run build

# Создаём отдельный репозиторий или используем gh-pages branch
cd dist
git init
git add -A
git commit -m 'Deploy dashboard'
git push -f git@github.com:username/scanner-dashboard.git main:gh-pages
```

---

## Вариант 3: Docker (если нужен)

### Dockerfile

```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Сборка и запуск

```bash
docker build -t scanner-dashboard .
docker run -d -p 3001:80 --name dashboard scanner-dashboard
```

---

## 🔧 Настройка API endpoint

Если API на другом домене, измените в `src/api/client.js`:

```javascript
const API_BASE = 'https://scanner-api.fulfilment-one.ru/api/v1';
```

---

## ✅ Проверка

После деплоя откройте:
- https://dashboard.fulfilment-one.ru

Должны увидеть дашборд с данными из API.

---

## 🔄 Обновление

```bash
# Локально
cd dashboard
npm run build

# Копируем на сервер
scp -r dist/* ubuntu@51.250.107.231:/var/www/scanner-dashboard/
```

Готово! 🎉

