from datetime import datetime, timezone
from travian_core.celery import app
from apps.game_engine.models import ServerSetting
from .logic import spawn_natar_tribe, spawn_ww_building_plans
from ..authentication.models import Player


@app.task
def check_server_timeline():
    try:
        active_server = ServerSetting.objects.get(is_active=True)
    except ServerSetting.DoesNotExist:
        return

    age_days = (datetime.now(timezone.utc) - active_server.start_date.replace(tzinfo=None)).days

    if age_days >= (active_server.duration_days * 0.5) and not Player.objects.filter(username="Natars").exists():
        spawn_natar_tribe()

    if age_days >= (active_server.duration_days * 0.7) and not active_server.ww_unlocked:
        active_server.ww_unlocked = True
        active_server.save()
        spawn_ww_building_plans()