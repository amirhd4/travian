from datetime import datetime, timedelta, timezone
from .models import ServerSetting, Village, VillageBuilding
from .tasks.game_tasks import process_game_event
from apps.game_engine.models import  GameLog
from apps.combat.models import TroopType, VillageTroop


def schedule_game_event(village_id, event_type, base_duration_seconds, details):
    settings = ServerSetting.objects.get(is_active=True)
    actual_duration = base_duration_seconds / settings.server_speed

    if actual_duration <= 0.1:
        # حالت سرعت نجومی: اجرای آنی
        execute_immediate_event(village_id, event_type, details)
    else:
        # حالت نرمال: ارسال به صف Celery
        run_time = datetime.now(timezone.utc) + timedelta(seconds=actual_duration)
        process_game_event.apply_async(args=[village_id, event_type, details], eta=run_time)


def execute_immediate_event(village_id, event_type, details):
    try:
        village = Village.objects.get(id=village_id)
    except Village.DoesNotExist:
        return

    if event_type == "BUILDING_UPGRADE":
        building_id = details.get('building_id')
        next_level = details.get('next_level')
        try:
            building = VillageBuilding.objects.get(id=building_id)
            building.level = next_level
            building.is_upgrading = False
            building.upgrade_end_time = None
            building.save()

            # ثبت سیستم لاگ برای ارتقای ساختمان
            GameLog.objects.create(
                village=village,
                log_type='BUILDING',
                description=f"ساختمان {building.building_type.name} با موفقیت به سطح {next_level} ارتقا یافت."
            )
        except VillageBuilding.DoesNotExist:
            pass

    elif event_type == "TROOP_RECRUITMENT":
        troop_id = details.get('troop_id')
        count = details.get('count')
        queue_id = details.get('queue_id')
        try:
            troop_type = TroopType.objects.get(id=troop_id)
            village_troop, _ = VillageTroop.objects.get_or_create(village=village, troop_type=troop_type)
            village_troop.count += count
            village_troop.save()

            # ثبت لاگ برای ساخت نیرو
            GameLog.objects.create(
                village=village,
                log_type='SYSTEM',
                description=f"تعداد {count} نیروی {troop_type.name} در دهکده ساخته شد."
            )

            if queue_id:
                from apps.combat.models import TrainingQueue
                TrainingQueue.objects.filter(id=queue_id).update(is_completed=True)
        except TroopType.DoesNotExist:
            pass