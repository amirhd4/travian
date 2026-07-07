# Travian

This is Travin game on web.


### Backend(Django) Requirements:
Run this command to install backend **requirements**:

```bash
pip install -r travian_clone/requirements.txt
```

---

### How to run in DEV:

#### 1st terminal:
```bash
cd travian_clone

#for first time
docker compose up --build -d

python manage.py makemigrations
python manage.py migrate
python manage.py seed_game_data
python manage.py seed_quests

# for next time
python mange.py runserver
```

#### 2nd terminal:
```bash
cd travian_clone
celery -A travian_core worker --pool=solo -l info
```

#### 3rd terminal:
```bash
cd travian_clone
celery -A travian_core beat -l info
```

#### Last terminal:
```bash
cd travian_client
npm run dev
```