# Travian Clone 🏛️

یک کلون کامل از بازی مرورگری تراوین (Travian) با معماری جدا برای بک‌اند و فرانت‌اند:

- **Backend:** Django 6 + Django REST Framework + Simple JWT + Django Channels (WebSocket زنده) + Celery + Redis + PostgreSQL
- **Frontend:** React 19 + Vite + Tailwind CSS + Zustand + Axios + React Router

این فایل، راهنمای **کامل راه‌اندازی پروژه از صفر تا صد** است؛ هم برای محیط توسعه (Local) و هم برای محیط عملیاتی (Production).

---

## فهرست مطالب

1. [ساختار پروژه](#ساختار-پروژه)
2. [پیش‌نیازها](#پیش‌نیازها)
3. [Quick Start (خلاصه دستورات لوکال)](#quick-start-خلاصه-دستورات-لوکال)
4. [راه‌اندازی کامل در محیط Local](#راه‌اندازی-کامل-در-محیط-local)
5. [دستورات Seed (پر کردن دیتابیس با داده‌های پایه بازی)](#دستورات-seed-پر-کردن-دیتابیس-با-داده‌های-پایه-بازی)
6. [راه‌اندازی کامل در محیط Production](#راه‌اندازی-کامل-در-محیط-production)
7. [بروزرسانی سرور (Deploy مجدد)](#بروزرسانی-سرور-deploy-مجدد)
8. [نکات امنیتی مهم](#نکات-امنیتی-مهم)
9. [عیب‌یابی رایج (Troubleshooting)](#عیب‌یابی-رایج-troubleshooting)

---

## ساختار پروژه

```
.
├── travian_clone/                 # Backend (Django)
│   ├── apps/
│   │   ├── authentication/        # ثبت‌نام، ورود، JWT، کپچا، قفل حساب
│   │   ├── game_engine/           # دهکده، منابع، ساختمان‌ها، بازارچه، آبادی‌ها، کوئست‌ها، طلا
│   │   ├── combat/                # نیرو، حمله/غارت، قهرمان، آکادمی، آهنگری، تله
│   │   └── world_wonder/          # شگفتی جهان و ناتارها
│   ├── travian_core/              # تنظیمات (settings.py)، URLها، ASGI/WSGI، Celery
│   ├── docker-compose.yml         # کانتینرهای PostgreSQL و Redis
│   └── requirements.txt           # پکیج‌های پایتون
│
└── travian_client/                # Frontend (React + Vite)
    ├── src/
    │   ├── pages/                 # صفحات بازی (دهکده، نقشه، بازارچه و...)
    │   ├── components/
    │   ├── store/                 # Zustand (useGameStore)
    │   └── api/axiosConfig.js     # اتصال به بک‌اند + مدیریت رفرش توکن
    └── vite.config.js
```

> ⚠️ نکته مهم: پوشه‌ی `migrations` در `.gitignore` قرار دارد و روی گیت commit نمی‌شود، پس همیشه بار اول باید `makemigrations` را قبل از `migrate` اجرا کنید.

---

## پیش‌نیازها

قبل از شروع، موارد زیر باید روی سیستم (لوکال) یا سرور (پروداکشن) نصب باشند:

| ابزار | نسخه پیشنهادی | استفاده |
|---|---|---|
| Python | 3.11 یا بالاتر | اجرای Django |
| Node.js | 20.19+ یا 22.12+ (LTS) | اجرای Vite/React |
| Docker + Docker Compose | آخرین نسخه | اجرای PostgreSQL و Redis |
| Git | - | دریافت کد |
| (Production) Nginx | آخرین نسخه | Reverse Proxy + سرو فایل‌های استاتیک |
| (Production) Certbot | آخرین نسخه | صدور گواهی SSL رایگان Let's Encrypt |

---

## Quick Start (خلاصه دستورات لوکال)

اگر فقط می‌خواهید سریع پروژه را بالا بیاورید (جزئیات کامل در بخش بعد):

```bash
# 1) کلون پروژه
git clone <repository-url> travian
cd travian

# 2) بک‌اند
cd travian_clone
python -m venv venv && source venv/bin/activate      # ویندوز: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # سپس مقادیر داخل .env را تنظیم کنید (بخش بعد)
docker compose up --build -d
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_game_data
python manage.py seed_quests
python manage.py seed_gold_packages
python manage.py seed_oases --count 60
python manage.py seed_nature_troops
python manage.py seed_admin
python manage.py runserver 127.0.0.1:8000

# 3) در ترمینال دوم: Celery Worker
cd travian_clone && source venv/bin/activate
celery -A travian_core worker --pool=solo -l info     # لینوکس/مک: بدون --pool=solo هم می‌شود

# 4) در ترمینال سوم: Celery Beat (زمان‌بند وظایف دوره‌ای)
cd travian_clone && source venv/bin/activate
celery -A travian_core beat -l info

# 5) در ترمینال چهارم: فرانت‌اند
cd travian_client
npm install
cp .env.example .env        # VITE_API_BASE_URL و VITE_WS_BASE_URL را تنظیم کنید
npm run dev
```

سپس مرورگر را روی آدرسی که Vite نشان می‌دهد (پیش‌فرض `http://127.0.0.1:5173`) باز کنید.

---

## راه‌اندازی کامل در محیط Local

### گام ۱ - دریافت کد

```bash
git clone <repository-url> travian
cd travian
```

### گام ۲ - راه‌اندازی Backend

#### ۲.۱ ساخت محیط مجازی و نصب پکیج‌ها

```bash
cd travian_clone
python -m venv venv
source venv/bin/activate        # ویندوز: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

#### ۲.۲ ساخت فایل `.env`

در مسیر `travian_clone/.env` فایلی با محتوای زیر بسازید (مقادیر مربوط به دیتابیس باید دقیقاً با `docker-compose.yml` یکی باشند):

```env
# --- Django ---
SECRET_KEY=change-this-to-a-random-string-in-any-environment
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# --- PostgreSQL (باید با docker-compose.yml یکی باشد) ---
DB_NAME=travian_db
DB_USER=your_user
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432

# --- Redis (کش + Channels + Celery) ---
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# --- CORS / CSRF (آدرس دقیق فرانت‌اند، بدون اسلش انتهایی) ---
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

> اگر مقادیر `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` داخل `docker-compose.yml` را تغییر دادید، حتماً همان مقادیر را در `.env` هم اعمال کنید تا Django بتواند به دیتابیس وصل شود.

#### ۲.۳ بالا آوردن PostgreSQL و Redis با Docker

```bash
docker compose up --build -d
docker compose ps      # بررسی اینکه هر دو سرویس db و redis در حال اجرا هستند
```

#### ۲.۴ اجرای Migration و ساخت حساب ادمین

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

با این حساب می‌توانید بعداً وارد پنل مدیریت جنگو در آدرس `/admin/` شوید.

#### ۲.۵ Seed کردن داده‌های پایه بازی

به ترتیب زیر اجرا کنید (توضیح کامل هر دستور در [بخش بعد](#دستورات-seed-پر-کردن-دیتابیس-با-داده‌های-پایه-بازی)):

```bash
python manage.py seed_game_data
python manage.py seed_quests
python manage.py seed_gold_packages
python manage.py seed_oases --count 60
python manage.py seed_nature_troops
python manage.py seed_natars        # اختیاری
python manage.py seed_farm_villages # اختیاری
```

#### ۲.۶ (اختیاری) تنظیم `ServerSetting`

بازی بدون این مرحله هم با مقادیر پیش‌فرض (سرعت ۱x و...) کار می‌کند، اما برای کنترل کامل سرعت سرور، مدت زمان محافظت تازه‌واردها، زمان آزادسازی منجنیق/کتیبه‌ها و... وارد `http://127.0.0.1:8000/admin/` شوید و یک رکورد `ServerSetting` با `is_active=True` بسازید.

#### ۲.۷ اجرای سرور Backend

```bash
python manage.py runserver 127.0.0.1:8000
```

> چون اپ `channels` نصب است، دستور `runserver` به‌صورت خودکار هم HTTP و هم WebSocket (مسیر `/ws/game/`) را سرو می‌کند؛ نیازی به اجرای جدا برای وب‌سوکت نیست.

#### ۲.۸ اجرای Celery Worker (ترمینال جدا)

```bash
cd travian_clone
source venv/bin/activate
celery -A travian_core worker --pool=solo -l info
```

> `--pool=solo` روی **ویندوز** الزامی است. روی **لینوکس/مک** می‌توانید بدون آن یا با `--pool=prefork -c 4` اجرا کنید.

#### ۲.۹ اجرای Celery Beat (ترمینال جدا)

Celery Beat مسئول اجرای خودکار وظایف زمان‌بندی‌شده است (تولید ماجراجویی قهرمان، محاسبه امتیاز فرهنگی، فعال‌سازی کتیبه‌ها، محاسبه مدال روزانه، بررسی زمان‌بندی سرور برای ظهور ناتارها و شگفتی جهان و...):

```bash
cd travian_clone
source venv/bin/activate
celery -A travian_core beat -l info
```

### گام ۳ - راه‌اندازی Frontend

#### ۳.۱ نصب پکیج‌ها

```bash
cd travian_client
npm install
```

#### ۳.۲ ساخت فایل `.env`

در مسیر `travian_client/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

> ⚠️ **نکته حیاتی درباره کوکی‌ها:** رفرش‌توکن به‌صورت کوکی `httpOnly` با `SameSite=Lax` ذخیره می‌شود. برای اینکه مرورگر این کوکی را بین فرانت و بک‌اند درست رد و بدل کند، **فرانت و بک‌اند باید دقیقاً روی یک هاست‌نیم** باز شوند (مثلاً هر دو `127.0.0.1` یا هر دو `localhost`؛ نه یکی `localhost` و دیگری `127.0.0.1`).

#### ۳.۳ اجرای فرانت‌اند

```bash
npm run dev
```

طبق `vite.config.js` روی آدرس `http://127.0.0.1:5173` بالا می‌آید.

### گام ۴ - تست نهایی

مرورگر را باز کنید و به `http://127.0.0.1:5173/register` بروید، یک حساب بسازید، نژاد را انتخاب کنید و وارد بازی شوید. دهکده اول به‌صورت خودکار (از طریق سیگنال `post_save` روی مدل `Player`) ساخته می‌شود.

---

## دستورات Seed (پر کردن دیتابیس با داده‌های پایه بازی)

| دستور | مسیر | توضیح | آرگومان‌ها |
|---|---|---|---|
| `seed_game_data` | `apps/combat` | انواع نیرو (۱۰ نیرو برای هر ۳ قبیله)، نیازمندی‌های آکادمی، حیوانات نگهبان، آیتم‌های قهرمان | - |
| `seed_quests` | `apps/game_engine` | ۱۳ کوئست آموزشی ابتدای بازی | - |
| `seed_gold_packages` | `apps/game_engine` | بسته‌های خرید سکه طلا (فروشگاه طلا) | - |
| `seed_oases` | `apps/game_engine` | ساخت آبادی‌ها (Oasis) روی نقشه | `--count`, `--density` (پیش‌فرض 0.10), `--radius` (پیش‌فرض 250), `--clear` |
| `seed_nature_troops` | `apps/game_engine` | نیروهای طبیعت (مار، خرس، ببر و...) و اسپاون آن‌ها داخل آبادی‌های ساخته‌شده — **باید بعد از `seed_oases` اجرا شود** | `--clear` |
| `seed_natars` | `apps/game_engine` | (اختیاری) ساخت فوری قبیله ناتار + دهکده‌های شگفتی جهان برای تست سریع؛ در حالت عادی این کار به‌طور خودکار توسط Celery Beat بر اساس درصدی از عمر سرور انجام می‌شود | `--clear` |
| `seed_farm_villages` | `apps/game_engine` | (اختیاری) دهکده‌های فارم NPC با منابع نامحدود | - |
| `seed_admin` | `apps/game_engine` | ساخت حساب ادمین پیش‌فرض (`majditravian`) برای سیستم پشتیبانی | - |

مثال کامل اجرای اولیه:

```bash
python manage.py seed_game_data
python manage.py seed_quests
python manage.py seed_gold_packages
python manage.py seed_oases --count 60
python manage.py seed_nature_troops
python manage.py seed_admin
```

---

## سیستم پیام‌رسانی و پشتیبانی

بازی دارای یک سیستم پیام‌رسانی کامل است که بازیکنان می‌توانند از طریق آن با یکدیگر و با تیم پشتیبانی ارتباط برقرار کنند.

### حساب ادمین پشتیبانی

دستور `seed_admin` یک حساب ادمین پیش‌فرض با مشخصات زیر می‌سازد:

| فیلد | مقدار |
|------|-------|
| نام کاربری | `majditravian` |
| ایمیل | `admin@travian.ir` |
| رمز عبور | `admin123` |

> **مهم:** حتماً پس از اولین ورود، رمز عبور را تغییر دهید.

```bash
python manage.py seed_admin
```

### ارسال پیام پشتیبانی

بازیکنان از طریق دکمه «پشتیبانی» در فوتر یا تب «نوشتن پیام» می‌توانند پیام مستقیم به ادمین ارسال کنند. پیام‌ها به‌صورت خودکار به کاربر `majditravian` ارسال می‌شوند.

### پنل مدیریت پیام‌ها

ادمین‌ها (کاربران `is_superuser` یا `is_staff`) به پنل مدیریت پیام‌ها در مسیر `/admin/messages` دسترسی دارند:

- مشاهده تمام پیام‌های سیستم
- فیلتر بر اساس شناسه بازیکن
- پاسخ مستقیم به پیام‌ها

### قابلیت‌های سیستم پیام‌رسانی

- **ارسال پیام با نام کاربری:** جستجوی خودکار نام کاربری گیرنده
- **پاسخ به پیام:** نقل‌قول خودکار پیام اصلی
- **حذف پیام:** حذف نرم (هر طرف می‌تواند پیام را حذف کند)
- **صندوق ورودی و ارسالی:** با صفحه‌بندی
- **شمارنده پیام‌های خوانده‌نشده:** در نوار پیمایش

---

## راه‌اندازی کامل در محیط Production

این بخش یک راه‌اندازی واقعی روی یک سرور لینوکسی (مثلاً Ubuntu 22.04) با **Nginx + Daphne (ASGI) + Celery + Docker (فقط برای DB/Redis) + systemd** را توضیح می‌دهد.

### تفاوت‌های اصلی نسبت به محیط Local

- `DEBUG=False`
- `SECRET_KEY` تصادفی و قوی (هرگز از مقدار دیفالت استفاده نکنید)
- `ALLOWED_HOSTS` فقط شامل دامنه واقعی
- استفاده از **HTTPS** الزامی است، چون در تنظیمات پروژه `AUTH_COOKIE_SECURE = not DEBUG` است؛ یعنی وقتی `DEBUG=False` باشد کوکی رفرش‌توکن فقط روی HTTPS ارسال می‌شود.
- فرانت‌اند به‌صورت build شده (استاتیک) پشت Nginx سرو می‌شود، نه با `npm run dev`.
- Backend به‌جای `runserver` با یک ASGI Server واقعی (Daphne) اجرا می‌شود.
- همه پردازش‌ها (Daphne، Celery Worker، Celery Beat) به‌صورت سرویس‌های `systemd` همیشه در پس‌زمینه اجرا و در صورت کرش، خودکار ری‌استارت می‌شوند.

### گام ۱ - آماده‌سازی سرور

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx curl
# نصب Docker (برای PostgreSQL و Redis)
curl -fsSL https://get.docker.com | sh
sudo apt install -y docker-compose-plugin
# نصب Node.js (LTS) برای build فرانت‌اند
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# نصب Certbot برای SSL
sudo apt install -y certbot python3-certbot-nginx
```

### گام ۲ - دریافت کد روی سرور

```bash
sudo mkdir -p /opt/travian
sudo chown $USER:$USER /opt/travian
git clone <repository-url> /opt/travian
cd /opt/travian
```

### گام ۳ - راه‌اندازی PostgreSQL و Redis

در `travian_clone/docker-compose.yml` مقدار `POSTGRES_PASSWORD` را به یک پسورد قوی تغییر دهید (این فایل شامل ولوم‌های دائمی `postgres_data` و `redis_data` است، پس داده‌ها با ری‌استارت سرور از بین نمی‌روند)، سپس:

```bash
cd /opt/travian/travian_clone
docker compose up -d
```

> 🔒 پورت‌های ۵۴۳۲ و ۶۳۷۹ نباید از بیرون (اینترنت) قابل دسترس باشند. فایروال سرور (`ufw`) را طوری تنظیم کنید که فقط ۸۰/۴۴۳ و SSH باز باشند.

### گام ۴ - تنظیم Backend

```bash
cd /opt/travian/travian_clone
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install daphne     # اگر از قبل در requirements.txt نبود
```

فایل `.env` (Production):

```env
SECRET_KEY=<با دستور زیر تولید کنید>
DEBUG=False
ALLOWED_HOSTS=example.com,www.example.com

DB_NAME=travian_db
DB_USER=your_user
DB_PASSWORD=<پسورد قوی - همان مقدار docker-compose.yml>
DB_HOST=127.0.0.1
DB_PORT=5432

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com
```

تولید یک `SECRET_KEY` امن:

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

سپس:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput

# Seed داده‌های پایه (همان دستورات بخش قبل)
python manage.py seed_game_data
python manage.py seed_quests
python manage.py seed_gold_packages
python manage.py seed_oases --count 200
python manage.py seed_nature_troops
```

> فایل‌های گرافیکی چهره‌ی قهرمان (`static/hero/faces/...`) به‌صورت دستی (خارج از گیت) باید داخل `travian_clone/static/hero/faces/` قرار داده شوند، چون این asset ها در کد پروژه seed/ساخته نمی‌شوند.

### گام ۵ - اجرای Backend با systemd (Daphne)

فایل `/etc/systemd/system/travian-daphne.service`:

```ini
[Unit]
Description=Travian Daphne ASGI Server
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/travian/travian_clone
ExecStart=/opt/travian/travian_clone/venv/bin/daphne -b 127.0.0.1 -p 8000 travian_core.asgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### گام ۶ - اجرای Celery Worker و Beat با systemd

فایل `/etc/systemd/system/travian-celery-worker.service`:

```ini
[Unit]
Description=Travian Celery Worker
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/travian/travian_clone
ExecStart=/opt/travian/travian_clone/venv/bin/celery -A travian_core worker -l info --concurrency=4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

فایل `/etc/systemd/system/travian-celery-beat.service`:

```ini
[Unit]
Description=Travian Celery Beat
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/travian/travian_clone
ExecStart=/opt/travian/travian_clone/venv/bin/celery -A travian_core beat -l info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

فعال‌سازی و اجرای هر سه سرویس:

```bash
sudo chown -R www-data:www-data /opt/travian
sudo systemctl daemon-reload
sudo systemctl enable --now travian-daphne
sudo systemctl enable --now travian-celery-worker
sudo systemctl enable --now travian-celery-beat

# بررسی وضعیت
sudo systemctl status travian-daphne
sudo journalctl -u travian-daphne -f     # مشاهده لاگ زنده
```

### گام ۷ - Build فرانت‌اند

فایل `travian_client/.env.production`:

```env
VITE_API_BASE_URL=https://example.com
VITE_WS_BASE_URL=wss://example.com
```

```bash
cd /opt/travian/travian_client
npm install
npm run build
```

خروجی build در پوشه `travian_client/dist/` تولید می‌شود.

### گام ۸ - تنظیم Nginx (Reverse Proxy + سرو فرانت‌اند)

فایل `/etc/nginx/sites-available/travian`:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    client_max_body_size 20M;

    # --- فرانت‌اند (فایل‌های build شده React) ---
    root /opt/travian/travian_client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # --- فایل‌های استاتیک جنگو (پنل ادمین و...) ---
    location /static/ {
        alias /opt/travian/travian_clone/staticfiles/;
    }

    # --- API ---
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- پنل مدیریت جنگو ---
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- WebSocket (اتاق بازی زنده) ---
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

فعال‌سازی:

```bash
sudo ln -s /etc/nginx/sites-available/travian /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### گام ۹ - صدور گواهی SSL رایگان

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot به‌صورت خودکار تنظیمات SSL بالا را در Nginx به‌روزرسانی می‌کند و رفرش خودکار گواهی را زمان‌بندی می‌کند.

### گام ۱۰ - تست نهایی Production

آدرس `https://example.com` را باز کنید، ثبت‌نام کنید و مطمئن شوید:
- لاگین/رفرش توکن به‌درستی کار می‌کند (کوکی ست می‌شود).
- وب‌سوکت وصل می‌شود (اعلان‌های زنده بازی مثل نتیجه نبرد).
- پنل ادمین در `https://example.com/admin/` بالا می‌آید.

---

## بروزرسانی سرور (Deploy مجدد)

هر بار که کد جدید منتشر می‌کنید:

```bash
cd /opt/travian
git pull

# Backend
cd travian_clone
source venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart travian-daphne travian-celery-worker travian-celery-beat

# Frontend
cd ../travian_client
npm install
npm run build
sudo systemctl reload nginx
```

---

## نکات امنیتی مهم

- فایل `.env` هرگز نباید commit شود (از قبل در `.gitignore` قرار دارد).
- در Production حتماً `DEBUG=False` و `SECRET_KEY` تصادفی/قوی باشد.
- `ALLOWED_HOSTS`، `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` را دقیقاً به دامنه واقعی محدود کنید (نه `*`).
- پورت‌های PostgreSQL (۵۴۳۲) و Redis (۶۳۷۹) نباید مستقیماً از اینترنت در دسترس باشند.
- HTTPS الزامی است چون کوکی رفرش‌توکن در Production با فلگ `Secure` ارسال می‌شود.
- به‌صورت دوره‌ای از دیتابیس بک‌آپ بگیرید:
  ```bash
  docker exec -t travian_clone-db-1 pg_dump -U your_user travian_db > backup_$(date +%F).sql
  ```
- محدودیت نرخ درخواست (Throttling) روی لاگین/ثبت‌نام/کپچا از قبل در پروژه فعال است (`REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`)؛ در صورت نیاز مقادیر آن را در `settings.py` متناسب با ترافیک واقعی تنظیم کنید.

---

## عیب‌یابی رایج (Troubleshooting)

| مشکل | راه‌حل احتمالی |
|---|---|
| خطای اتصال به دیتابیس (`connection refused`) | مطمئن شوید `docker compose ps` نشان می‌دهد سرویس `db` بالاست و `DB_HOST`/`DB_PORT` در `.env` درست‌اند. |
| لاگین کار می‌کند ولی بعد از رفرش صفحه از سیستم خارج می‌شوید | فرانت و بک‌اند باید دقیقاً روی یک هاست‌نیم اجرا شوند (`127.0.0.1` با `127.0.0.1`، نه با `localhost`). |
| خطای CORS در کنسول مرورگر | آدرس دقیق فرانت (بدون `/` انتهایی) را به `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` اضافه کنید و سرور Django را ری‌استارت کنید. |
| وب‌سوکت وصل نمی‌شود / اعلان‌های زنده کار نمی‌کنند | مطمئن شوید Redis بالاست (Channel Layer از Redis استفاده می‌کند) و توکن دسترسی معتبر ارسال می‌شود؛ در Nginx بخش `location /ws/` باید هدرهای `Upgrade`/`Connection` را داشته باشد. |
| وظایف زمان‌بندی‌شده (مثل ظهور ناتار، مدال روزانه) اجرا نمی‌شوند | Celery **Beat** جدا از Celery **Worker** است و باید هر دو همزمان اجرا باشند. |
| خطای «نوع نیرو یافت نشد» هنگام آموزش سرباز | دستور `python manage.py seed_game_data` را اجرا کنید. |
| خرید طلا / بسته‌های طلا نمایش داده نمی‌شود | دستور `python manage.py seed_gold_packages` را اجرا کنید. |
| نقشه جهان خالی است، آبادی‌ای دیده نمی‌شود | دستور `python manage.py seed_oases` را اجرا کنید. |
| ارسال پیام پشتیبانی خطای ۵۰۳ می‌دهد | حداقل باید یک حساب ادمین (`is_superuser=True`) در سیستم وجود داشته باشد؛ کافیست `python manage.py seed_admin` را اجرا کرده باشید. |
| تصویر چهره قهرمان (Hero Image) بارگذاری نمی‌شود | asset های گرافیکی چهره باید دستی در `travian_clone/static/hero/faces/` قرار داده شوند؛ در ریپازیتوری seed نمی‌شوند. |