# Docker Deployment Guide

## ملخص

المشروع يعمل عبر Docker Compose مع خدمتين:
- **db**: PostgreSQL 16
- **app**: Node.js 20 + Express + Prisma

---

## معلومات السيرفر

- **IP**: `217.76.53.136`
- **Port**: `3015`
- **Base URL**: `http://217.76.53.136:3015`

---

## المتطلبات على السيرفر

- Docker (v24+)
- Docker Compose (v2+)

تأكد من تثبيتهم:
```bash
docker --version
docker compose version
```

### افتح الـ Port في الـ Firewall

**Ubuntu/Debian (UFW):**
```bash
sudo ufw allow 3015/tcp
sudo ufw reload
sudo ufw status
```

**CentOS/RHEL (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=3015/tcp
sudo firewall-cmd --reload
```

**iptables:**
```bash
sudo iptables -A INPUT -p tcp --dport 3015 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

> لو السيرفر على cloud provider (AWS/Hetzner/DigitalOcean...): افتح الـ port من لوحة التحكم (Security Groups أو Firewall Rules).

---

## خطوات النشر

### 1. ارفع المشروع للسيرفر

```bash
# مثال عبر git
git clone <repo-url>
cd english

# أو ارفعه بـ scp / rsync
```

### 2. أنشئ ملف `.env` (مهم جداً)

```bash
cp .env.docker.example .env
nano .env
```

**عدّل القيم — خصوصاً:**
- `DB_PASSWORD` → كلمة سر قوية للقاعدة
- `JWT_SECRET` → نص عشوائي طويل (32+ حرف)
- `ADMIN_DEFAULT_PASSWORD` → كلمة سر الـ admin
- `RUN_SEED=true` → خليها `true` بأول تشغيل، بعدين رجّعها `false`

> **مهم:** الـ `.env` ما يُرفع لـ git. عدّله مباشرة على السيرفر.

### 3. شغّل الـ containers

```bash
docker compose up -d
```

أو استخدم npm:
```bash
npm run docker:up
```

### 4. تابع الـ logs

```bash
docker compose logs -f app
# أو
npm run docker:logs
```

عند أول تشغيل ناجح ستشاهد:
```
✅ Database is ready
🔄 Pushing Prisma schema...
🌱 Running seed... (إذا RUN_SEED=true)
🚀 Starting server...
Server running on port 3000
```

### 5. اختبر السيرفر

من السيرفر نفسه:
```bash
curl http://localhost:3015/health
# Response: {"status":"ok"}
```

من جهاز خارجي:
```bash
curl http://217.76.53.136:3015/health

curl -X POST http://217.76.53.136:3015/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"access_code":"ADMIN001","password":"Admin@12345"}'
```

### 6. أوقف الـ Seed بعد أول تشغيل ناجح

```bash
nano .env
# غيّر: RUN_SEED=false
docker compose restart app
```

---

## الأوامر المفيدة

| العملية | الأمر |
|---------|------|
| تشغيل | `docker compose up -d` |
| إيقاف | `docker compose down` |
| إعادة build بعد تعديل الكود | `docker compose up -d --build` |
| متابعة logs | `docker compose logs -f app` |
| تشغيل seed يدوياً | `docker compose exec app node prisma/seed.js` |
| دخول psql | `docker compose exec db psql -U postgres -d lectures_db` |
| دخول shell الـ container | `docker compose exec app sh` |
| حذف كل شي مع البيانات | `docker compose down -v` ⚠️ |

أو الاختصارات:
```bash
npm run docker:up
npm run docker:down
npm run docker:logs
npm run docker:rebuild
npm run docker:seed
```

---

## بنية الـ Volumes

البيانات محفوظة في volumes منفصلة:

| Volume | الوصف |
|--------|-------|
| `postgres_data` | قاعدة البيانات كاملة |
| `uploads_data` | ملفات الـ PDF والصور المرفوعة |

> الـ volumes تبقى موجودة حتى لو حذفت الـ containers، إلا لو استخدمت `docker compose down -v`.

### Backup قاعدة البيانات

```bash
docker compose exec db pg_dump -U postgres lectures_db > backup_$(date +%F).sql
```

### استعادة قاعدة البيانات

```bash
cat backup.sql | docker compose exec -T db psql -U postgres -d lectures_db
```

### Backup الملفات المرفوعة

```bash
docker run --rm -v english_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads_$(date +%F).tar.gz -C /data .
```

---

## النشر للإنتاج (Production)

### 1. خلف Reverse Proxy (Nginx)

أنشئ `nginx.conf`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 100M;  # للـ PDF uploads

    location / {
        proxy_pass http://localhost:3015;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. HTTPS عبر Let's Encrypt

```bash
sudo certbot --nginx -d api.yourdomain.com
```

### 3. أغلق منفذ القاعدة من الخارج

في `docker-compose.yml`، احذف `ports` للـ `db` (أو خليها `127.0.0.1:5432:5432`):

```yaml
db:
  # ports:                    ← احذف هاد بالإنتاج
  #   - "5432:5432"
  expose:
    - "5432"
```

### 4. مراقبة (Monitoring)

```bash
# Resource usage
docker stats

# Container health
docker compose ps

# Logs بحجم محدود
docker compose logs --tail=100 app
```

---

## التحديثات (Update)

### تحديث الكود

```bash
git pull
docker compose up -d --build
```

### تحديث الـ schema

بعد تعديل `prisma/schema.prisma`:
```bash
docker compose up -d --build
# الـ entrypoint يعمل prisma db push تلقائياً
```

---

## Troubleshooting

### المشكلة: `Cannot connect to database`
```bash
# تأكد القاعدة شغالة
docker compose ps

# شوف logs القاعدة
docker compose logs db
```

### المشكلة: `Prisma Client out of sync`
```bash
docker compose exec app npx prisma generate
docker compose restart app
```

### المشكلة: `EACCES` على uploads
```bash
docker compose exec app chmod -R 755 /app/uploads
```

### إعادة ضبط كلية (يحذف كل البيانات!)
```bash
docker compose down -v
docker compose up -d --build
# مع RUN_SEED=true في .env
```

---

## معلومات الـ Endpoints

بعد التشغيل الناجح:

```
http://217.76.53.136:3015/health           # health check
http://217.76.53.136:3015/api/auth/...     # auth endpoints
http://217.76.53.136:3015/api/student/...  # student endpoints
http://217.76.53.136:3015/api/admin/...    # admin endpoints
http://217.76.53.136:3015/uploads/...      # static files
```
