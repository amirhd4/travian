# Travian Game

A complete clone of the browser-based game Travian with a separated backend and frontend architecture:

- **Backend:** Django 6 + Django REST Framework + Simple JWT + Django Channels (Live WebSocket) + Celery + Redis + PostgreSQL
- **Frontend:** React 19 + Vite + Tailwind CSS + Zustand + Axios + React Router

This document is a **complete setup guide from start to finish**, covering both the Local (Development) environment and the Production environment.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Quick Start (Local Setup Summary)](#quick-start-local-setup-summary)
4. [Complete Local Setup](#complete-local-setup)
5. [Seed Commands (Populate the Database with Initial Game Data)](#seed-commands-populate-the-database-with-initial-game-data)
6. [Complete Production Setup](#complete-production-setup)
7. [Server Update (Redeployment)](#server-update-redeployment)
8. [Important Security Notes](#important-security-notes)
9. [Common Troubleshooting](#common-troubleshooting)

---

## Project Structure

```text
.
├── travian_clone/                 # Backend (Django)
│   ├── apps/
│   │   ├── authentication/        # Registration, Login, JWT, CAPTCHA, Account Lockout
│   │   ├── game_engine/           # Villages, Resources, Buildings, Marketplace, Oases, Quests, Gold
│   │   ├── combat/                # Troops, Attacks/Raids, Hero, Academy, Smithy, Traps
│   │   └── world_wonder/          # World Wonder and Natars
│   ├── travian_core/              # Settings (settings.py), URLs, ASGI/WSGI, Celery
│   ├── docker-compose.yml         # PostgreSQL and Redis containers
│   └── requirements.txt           # Python dependencies
│
└── travian_client/                # Frontend (React + Vite)
    ├── src/
    │   ├── pages/                 # Game pages (Village, Map, Marketplace, etc.)
    │   ├── components/
    │   ├── store/                 # Zustand (useGameStore)
    │   └── api/axiosConfig.js     # Backend connection + Token Refresh handling
    └── vite.config.js
```

> ⚠️ **Important:** The `migrations` directory is included in `.gitignore` and is **not committed** to Git. Therefore, when setting up the project for the first time, you must always run `makemigrations` before running `migrate`.

---

## Prerequisites

Before getting started, make sure the following tools are installed on your local machine or production server:

| Tool | Recommended Version | Purpose |
|---|---|---|
| Python | 3.11 or later | Run the Django backend |
| Node.js | 20.19+ or 22.12+ (LTS) | Run Vite/React |
| Docker + Docker Compose | Latest version | Run PostgreSQL and Redis |
| Git | - | Clone the repository |
| (Production) Nginx | Latest version | Reverse Proxy + Static File Serving |
| (Production) Certbot | Latest version | Issue free Let's Encrypt SSL certificates |

---

## Quick Start (Local Setup Summary)

If you just want to get the project running as quickly as possible (full details are provided in the next section):

```bash
# 1) Clone the repository
git clone https://github.com/amirhd4/travian.git travian
cd travian

# 2) Backend
cd travian_clone
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # Then configure the values inside .env (see the next section)
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

# 3) In a second terminal: Celery Worker
cd travian_clone && source venv/bin/activate
celery -A travian_core worker --pool=solo -l info     # On Linux/macOS, --pool=solo is optional

# 4) In a third terminal: Celery Beat (Periodic Task Scheduler)
cd travian_clone && source venv/bin/activate
celery -A travian_core beat -l info

# 5) In a fourth terminal: Frontend
cd travian_client
npm install
cp .env.example .env        # Configure VITE_API_BASE_URL and VITE_WS_BASE_URL
npm run dev
```

Then open your browser and navigate to the URL displayed by Vite (default: `http://127.0.0.1:5173`).

---

## Complete Local Setup

### Step 1 - Clone the Repository

```bash
git clone https://github.com/amirhd4/travian.git travian
cd travian
```

### Step 2 - Set Up the Backend

#### 2.1 Create a Virtual Environment and Install Dependencies

```bash
cd travian_clone
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

#### 2.2 Create the `.env` File

Create a file named `travian_clone/.env` with the following content (the database values **must exactly match** those defined in `docker-compose.yml`):

```env
# --- Django ---
SECRET_KEY=change-this-to-a-random-string-in-any-environment
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# --- PostgreSQL (must match docker-compose.yml) ---
DB_NAME=travian_db
DB_USER=your_user
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432

# --- Redis (Cache + Channels + Celery) ---
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# --- CORS / CSRF (Frontend URL without a trailing slash) ---
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

> If the values of `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`
#### 2.3 Start PostgreSQL and Redis with Docker

```bash
docker compose up --build -d
docker compose ps      # Verify that both db and redis services are running
```

#### 2.4 Run Migrations and Create the Admin Account

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

You can later use this account to access the Django Admin panel at `/admin/`.

#### 2.5 Seed the Initial Game Data

Run the following commands in order (a detailed explanation of each command is provided in the [next section](#seed-commands-populate-the-database-with-initial-game-data)):

```bash
python manage.py seed_game_data
python manage.py seed_quests
python manage.py seed_gold_packages
python manage.py seed_oases --count 60
python manage.py seed_nature_troops
python manage.py seed_natars        # Optional
python manage.py seed_farm_villages # Optional
```

#### 2.6 (Optional) Configure `ServerSetting`

The game will work with the default settings (1x server speed, etc.) even if you skip this step. However, for full control over the server speed, beginner protection duration, catapult/artifact unlock times, and other server settings, open `http://127.0.0.1:8000/admin/` and create a `ServerSetting` record with `is_active=True`.

#### 2.7 Start the Backend Server

```bash
python manage.py runserver 127.0.0.1:8000
```

> Since the `channels` app is installed, the `runserver` command automatically serves both HTTP and WebSocket (`/ws/game/`). No separate WebSocket server is required.

#### 2.8 Start the Celery Worker (Separate Terminal)

```bash
cd travian_clone
source venv/bin/activate
celery -A travian_core worker --pool=solo -l info
```

> `--pool=solo` is **required on Windows**. On **Linux/macOS**, you can omit it or use `--pool=prefork -c 4`.

#### 2.9 Start Celery Beat (Separate Terminal)

Celery Beat is responsible for executing scheduled tasks automatically (hero adventure generation, culture point calculations, artifact activation, daily medal calculations, server timeline checks for Natars and the World Wonder, and more):

```bash
cd travian_clone
source venv/bin/activate
celery -A travian_core beat -l info
```

### Step 3 - Set Up the Frontend

#### 3.1 Install Dependencies

```bash
cd travian_client
npm install
```

#### 3.2 Create the `.env` File

Create the following file at `travian_client/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

> ⚠️ **Important Cookie Note:** The refresh token is stored as an `httpOnly` cookie with `SameSite=Lax`. To ensure that browsers correctly send this cookie between the frontend and backend, **both applications must use exactly the same hostname** (for example, both `127.0.0.1` or both `localhost`—not one using `localhost` and the other `127.0.0.1`).

#### 3.3 Start the Frontend

```bash
npm run dev
```

According to `vite.config.js`, the frontend will be available at `http://127.0.0.1:5173`.

### Step 4 - Final Test

Open your browser and navigate to `http://127.0.0.1:5173/register`, create a new account, choose your tribe, and enter the game. Your first village will be created automatically through the `post_save` signal on the `Player` model.

---

## Seed Commands (Populate the Database with Initial Game Data)

| Command | Location | Description | Arguments |
|---|---|---|---|
| `seed_game_data` | `apps/combat` | Creates troop types (10 units for each of the 3 tribes), Academy requirements, nature guardians, and hero items | - |
| `seed_quests` | `apps/game_engine` | Creates the 13 beginner tutorial quests | - |
| `seed_gold_packages` | `apps/game_engine` | Creates Gold purchase packages (Gold Shop) | - |
| `seed_oases` | `apps/game_engine` | Generates Oases on the world map | `--count`, `--density` (default `0.10`), `--radius` (default `250`), `--clear` |
| `seed_nature_troops` | `apps/game_engine` | Spawns Nature troops (Snakes, Bears, Tigers, etc.) inside generated Oases — **must be executed after `seed_oases`** | `--clear` |
| `seed_natars` | `apps/game_engine` | *(Optional)* Instantly creates the Natar tribe and World Wonder villages for testing. Under normal gameplay, these are created automatically by Celery Beat according to the server timeline | `--clear` |
| `seed_farm_villages` | `apps/game_engine` | *(Optional)* Creates NPC farm villages with unlimited resources | - |
| `seed_admin` | `apps/game_engine` | Creates the default administrator account (`majditravian`) for the support system | - |

Example of the initial setup:

```bash
python manage.py seed_game_data
python manage.py seed_quests
python manage.py seed_gold_packages
python manage.py seed_oases --count 60
python manage.py seed_nature_troops
python manage.py seed_admin
```

---

## Messaging and Support System

The game includes a complete messaging system that allows players to communicate with each other as well as with the support team.

### Default Support Administrator Account

The `seed_admin` command creates a default administrator account with the following credentials:

| Field | Value |
|------|-------|
| Username | `majditravian` |
| Email | `admin@travian.ir` |
| Password | `admin123` |

> **Important:** Be sure to change the password immediately after the first login.

```bash
python manage.py seed_admin
```

### Sending a Support Message

Players can send a direct message to the administrator using the **Support** button in the footer or the **Write Message** tab. Messages are automatically delivered to the `majditravian` user.

### Message Management Panel

Administrators (`is_superuser` or `is_staff` users) can access the message management panel at `/admin/messages`, where they can:

- View all system messages
- Filter messages by player ID
- Reply directly to messages

### Messaging System Features

- **Send Messages by Username:** Automatic recipient username lookup
- **Reply to Messages:** Automatically quotes the original message
- **Delete Messages:** Soft deletion (either participant can delete the conversation from their own view)
- **Inbox and Sent Items:** With pagination support
- **Unread Message Counter:** Displayed in the navigation bar

---

## Complete Production Setup

This section describes a real-world deployment on a Linux server (for example, Ubuntu 22.04) using **Nginx + Daphne (ASGI) + Celery + Docker (Database/Redis only) + systemd**.

### Key Differences Compared to the Local Environment

- `DEBUG=False`
- A strong, randomly generated `SECRET_KEY` (never use the default value)
- `ALLOWED_HOSTS` should only contain your actual domain name
- **HTTPS is mandatory**, because the project uses `AUTH_COOKIE_SECURE = not DEBUG`. This means that when `DEBUG=False`, the refresh token cookie is sent only over HTTPS.
- The frontend is served as a production build (static files) behind Nginx instead of using `npm run dev`.
- The backend runs with a production ASGI server (Daphne) instead of Django's `runserver`.
- All processes (Daphne, Celery Worker, and Celery Beat) run as `systemd` services, ensuring they remain active in the background and automatically restart if they crash.

### Step 1 - Prepare the Server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx curl

# Install Docker (for PostgreSQL and Redis)
curl -fsSL https://get.docker.com | sh
sudo apt install -y docker-compose-plugin

# Install Node.js (LTS) for building the frontend
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2 - Clone the Project on the Server

```bash
sudo mkdir -p /opt/travian
sudo chown $USER:$USER /opt/travian
git clone https://github.com/amirhd4/travian.git /opt/travian
cd /opt/travian
```
### Step 3 - Set Up PostgreSQL and Redis

In `travian_clone/docker-compose.yml`, change the `POSTGRES_PASSWORD` value to a strong password (this file includes persistent `postgres_data` and `redis_data` volumes, so your data will survive server restarts), then run:

```bash
cd /opt/travian/travian_clone
docker compose up -d
```

> 🔒 Ports **5432** and **6379** should **not** be accessible from the public Internet. Configure your server firewall (`ufw`) so that only ports **80**, **443**, and **SSH** are open.

### Step 4 - Configure the Backend

```bash
cd /opt/travian/travian_clone
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install daphne     # If it is not already included in requirements.txt
```

Create the production `.env` file:

```env
SECRET_KEY=<Generate using the command below>
DEBUG=False
ALLOWED_HOSTS=example.com,www.example.com

DB_NAME=travian_db
DB_USER=your_user
DB_PASSWORD=<Strong password - must match docker-compose.yml>
DB_HOST=127.0.0.1
DB_PORT=5432

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com
```

Generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Then run:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput

# Seed the initial game data (same commands as in the previous section)
python manage.py seed_game_data
python manage.py seed_quests
python manage.py seed_gold_packages
python manage.py seed_oases --count 200
python manage.py seed_nature_troops
```

> The Hero face image assets (`static/hero/faces/...`) must be copied manually (outside of Git) into `travian_clone/static/hero/faces/`, since these assets are not generated or seeded by the project.

### Step 5 - Run the Backend with systemd (Daphne)

Create the file `/etc/systemd/system/travian-daphne.service`:

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

### Step 6 - Run Celery Worker and Beat with systemd

Create the file `/etc/systemd/system/travian-celery-worker.service`:

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

Create the file `/etc/systemd/system/travian-celery-beat.service`:

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

Enable and start all three services:

```bash
sudo chown -R www-data:www-data /opt/travian
sudo systemctl daemon-reload
sudo systemctl enable --now travian-daphne
sudo systemctl enable --now travian-celery-worker
sudo systemctl enable --now travian-celery-beat

# Check service status
sudo systemctl status travian-daphne
sudo journalctl -u travian-daphne -f     # View live logs
```

### Step 7 - Build the Frontend

Create the file `travian_client/.env.production`:

```env
VITE_API_BASE_URL=https://example.com
VITE_WS_BASE_URL=wss://example.com
```

Then build the frontend:

```bash
cd /opt/travian/travian_client
npm install
npm run build
```

The production build will be generated inside the `travian_client/dist/` directory.

### Step 8 - Configure Nginx (Reverse Proxy + Frontend Hosting)

Create the file `/etc/nginx/sites-available/travian`:

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

    # --- Frontend (React production build) ---
    root /opt/travian/travian_client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # --- Django static files (Admin panel, etc.) ---
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

    # --- Django Admin Panel ---
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- WebSocket (Live Game Communication) ---
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

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/travian /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 9 - Obtain a Free SSL Certificate

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot will automatically update the Nginx configuration with the SSL settings and schedule automatic certificate renewal.

### Step 10 - Final Production Test

Open `https://example.com`, register a new account, and verify that:

- Login and token refresh work correctly (the cookie is set properly).
- The WebSocket connection is established (live game notifications such as battle results are received).
- The Django Admin panel is accessible at `https://example.com/admin/`.

---

## Server Update (Redeployment)

Whenever a new version of the code is released:

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

## Important Security Notes

- Never commit the `.env` file (it is already included in `.gitignore`).
- In production, always set `DEBUG=False` and use a strong, randomly generated `SECRET_KEY`.
- Restrict `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` to your actual domain(s)—never use `*`.
- PostgreSQL (**5432**) and Redis (**6379**) ports should never be publicly accessible.
- HTTPS is required because the refresh token cookie is sent with the `Secure` flag in production.
- Regularly back up your database:

  ```bash
  docker exec -t travian_clone-db-1 pg_dump -U your_user travian_db > backup_$(date +%F).sql
  ```

- Request rate limiting (throttling) for login, registration, and CAPTCHA endpoints is already enabled in the project (`REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`). Adjust the values in `settings.py` if needed based on your production traffic.

---

## Common Troubleshooting

| Problem | Possible Solution |
|---|---|
| Database connection error (`connection refused`) | Make sure `docker compose ps` shows that the `db` service is running and verify that `DB_HOST` and `DB_PORT` are correctly configured in `.env`. |
| Login works, but you are logged out after refreshing the page | The frontend and backend must use **exactly the same hostname** (`127.0.0.1` with `127.0.0.1`, not `localhost` with `127.0.0.1`). |
| CORS error in the browser console | Add the exact frontend URL (without a trailing `/`) to both `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, then restart the Django server. |
| WebSocket connection fails or live notifications do not work | Make sure Redis is running (the Channel Layer depends on Redis), verify that a valid access token is being sent, and ensure the `location /ws/` block in Nginx includes the `Upgrade` and `Connection` headers. |
| Scheduled tasks (such as Natar appearance or daily medals) are not executed | Celery **Beat** is separate from the Celery **Worker**. Both services must be running simultaneously. |
| "Troop type not found" error when training units | Run `python manage.py seed_game_data`. |
| Gold Shop or Gold Packages are not displayed | Run `python manage.py seed_gold_packages`. |
| The world map is empty and no Oases are visible | Run `python manage.py seed_oases`. |
| Sending a support message returns a 503 error | At least one administrator account (`is_superuser=True`) must exist. Simply run `python manage.py seed_admin`. |
| Hero portrait image is missing | The Hero face assets must be manually copied into `travian_clone/static/hero/faces/`; they are not included in the repository or generated by the seed commands. |
