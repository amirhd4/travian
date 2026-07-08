import datetime
from django.utils import timezone
from django.db import transaction

from .models import TroopMovement, VillageTroop, TroopType
from apps.game_engine.models import GameLog
from .utils import calculate_travel_seconds
from .tasks import resolve_combat_movement


def dispatch_troop_movement(player, source_village, target_village, movement_type, troops_payload, farm_list_entry=None):
    """
    منطق مشترک اعزام نیرو (حمله/غارت/پشتیبانی/شناسایی). هم SendTroopsView و
    هم اجرای لیست مزرعه (FarmListRunView) از این تابع استفاده می‌کنند تا
    اعتبارسنجی و کسر نیرو یک‌بار نوشته شود و در دو جا تکرار نشود.

    خروجی: (موفق: bool, پیام خطا یا شیء TroopMovement)
    """
    from apps.game_engine.utils import is_server_finished
    if is_server_finished():
        return False, "این سرور به پایان رسیده و دیگر امکان اعزام نیرو وجود ندارد."

    valid_types = dict(TroopMovement.MOVEMENT_TYPES)
    if movement_type not in valid_types:
        return False, "نوع عملیات تاکتیکی نامعتبر است."

    if not troops_payload or not any(int(v or 0) > 0 for v in troops_payload.values()):
        return False, "هیچ نیرویی برای ارسال انتخاب نشده است."

    if movement_type == 'ATTACK' and source_village.id == target_village.id:
        return False, "نمی‌توانید به دهکده خودتان حمله کنید."

    sent_troop_ids = [int(tid) for tid, qty in troops_payload.items() if int(qty or 0) > 0]
    troop_types = {t.id: t for t in TroopType.objects.filter(id__in=sent_troop_ids)}
    missing_ids = set(sent_troop_ids) - set(troop_types.keys())
    if missing_ids:
        return False, f"نوع نیروی نامعتبر: {sorted(missing_ids)}"

    slowest_speed = min(t.speed for t in troop_types.values())

    with transaction.atomic():
        for troop_id_str, count_to_send in troops_payload.items():
            count_to_send = int(count_to_send or 0)
            if count_to_send <= 0:
                continue
            try:
                village_troop = VillageTroop.objects.select_for_update().get(
                    village=source_village, troop_type_id=int(troop_id_str)
                )
            except VillageTroop.DoesNotExist:
                return False, f"شما این نوع نیرو (شناسه {troop_id_str}) را در دهکده ندارید."

            if village_troop.count < count_to_send:
                return False, f"نیروی کافی برای شناسه {troop_id_str} ندارید."

            village_troop.count -= count_to_send
            village_troop.save()

        travel_seconds = calculate_travel_seconds(source_village, target_village, slowest_speed)
        arrival_time = timezone.now() + datetime.timedelta(seconds=travel_seconds)

        movement = TroopMovement.objects.create(
            source_village=source_village,
            target_village=target_village,
            movement_type=movement_type,
            troops_payload=troops_payload,
            arrival_time=arrival_time,
            farm_list_entry=farm_list_entry,
        )

        GameLog.objects.create(
            village=source_village,
            log_type='COMBAT',
            description=f"اعزام نیرو ({movement.get_movement_type_display()}) به سمت دهکده {target_village.name} انجام شد."
        )

        transaction.on_commit(lambda: resolve_combat_movement.apply_async(
            args=[movement.id], eta=arrival_time
        ))

    return True, movement