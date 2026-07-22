import datetime
from django.utils import timezone
from django.db import transaction

from .models import TroopMovement, VillageTroop, TroopType, Hero
from apps.game_engine.models import GameLog, ServerSetting, VillageBuilding
from .utils import calculate_travel_seconds
from .tasks import resolve_combat_movement


def _get_protection_message_if_blocked(target_village):
    owner_username = target_village.player.username
    if owner_username in ("Natars", "Farms"):
        return None

    # ✅ FIX: بازیکنی که خودش قبلا حمله/غارت کرده، محافظتش لغو شده است.
    if target_village.player.has_attacked:
        return None

    server_settings = ServerSetting.objects.filter(is_active=True).first()
    protection_days = server_settings.new_player_protection_days if server_settings else 7

    if protection_days <= 0:
        return None

    protection_until = target_village.player.date_joined + datetime.timedelta(days=protection_days)
    now = timezone.now()
    if now < protection_until:
        remaining = protection_until - now
        remaining_days = remaining.days + (1 if remaining.seconds > 0 else 0)
        return (
            f"این بازیکن هنوز در دوره‌ی محافظت تازه‌واردان قرار دارد "
            f"(حدود {remaining_days} روز دیگر تا پایان محافظت باقی مانده)."
        )
    return None


def dispatch_troop_movement(
    player, source_village, target_village, movement_type, troops_payload,
    farm_list_entry=None, send_hero=False, catapult_target_building=None,
):
    ALLOWED_MOVEMENT_TYPES = {'ATTACK', 'RAID', 'REINFORCEMENT', 'SCOUT'}  # ✅ RETURN اینجا مجاز نیست
    if movement_type not in ALLOWED_MOVEMENT_TYPES:
        return False, "نوع عملیات تاکتیکی نامعتبر است."

    if not troops_payload or not any(int(v or 0) > 0 for v in troops_payload.values()):
        return False, "هیچ نیرویی برای ارسال انتخاب نشده است."

    has_rally_point = VillageBuilding.objects.filter(
        village=source_village, building_type__name="محل گردهمایی", level__gt=0
    ).exists()
    if not has_rally_point:
        return False, "برای اعزام هرگونه نیرو، ابتدا باید «محل گردهمایی» را در این دهکده بسازید."

    if movement_type == 'ATTACK' and source_village.id == target_village.id:
        return False, "نمی‌توانید به دهکده خودتان حمله کنید."

    # ✅ چک محافظت تازه‌واردان فقط برای حمله و غارت (پشتیبانی/شناسایی مجاز است)
    if movement_type in ('ATTACK', 'RAID'):
        protection_message = _get_protection_message_if_blocked(target_village)
        if protection_message:
            return False, protection_message

    # ✅ FIX جدید: حمله یا غارت، محافظت تازه‌واردی خودِ مهاجم را فوراً لغو می‌کند
    if movement_type in ('ATTACK', 'RAID') and not player.has_attacked:
        player.has_attacked = True
        player.save(update_fields=['has_attacked'])

    hero_participating = False
    if send_hero:
        # ✅ طبق طراحی بازی: قهرمان می‌تواند همراه حمله، غارت یا پشتیبانی برود؛ فقط همراه شناسایی نمی‌رود.
        if movement_type not in ('ATTACK', 'RAID', 'REINFORCEMENT'):
            return False, "قهرمان فقط می‌تواند همراه حمله، غارت یا پشتیبانی اعزام شود."
        hero = Hero.objects.filter(player=player).first()
        if not hero or not hero.is_alive:
            return False, "قهرمان شما در دسترس نیست (از پای درآمده یا وجود ندارد)."
        if hero.is_on_adventure:
            return False, "قهرمان شما در حال ماجراجویی است و نمی‌تواند همراه این حمله برود."
        if hero.is_away:
            return False, "قهرمان شما هم‌اکنون در یک ماموریت نظامی دیگر است."
        hero_participating = True
        hero.is_away = True
        hero.save()

    sent_troop_ids = [int(tid) for tid, qty in troops_payload.items() if int(qty or 0) > 0]
    troop_types = {t.id: t for t in TroopType.objects.filter(id__in=sent_troop_ids)}
    missing_ids = set(sent_troop_ids) - set(troop_types.keys())
    if missing_ids:
        return False, f"نوع نیروی نامعتبر: {sorted(missing_ids)}"

    slowest_speed = min(t.speed for t in troop_types.values())

    # ✅ اعتبارسنجی هدف منجنیق (اگر ارسال شده)؛ اگر نامعتبر بود، به‌جای رد کردن
    # کل درخواست، به‌صورت خودکار روی «تصادفی» تنظیم می‌شود
    if catapult_target_building and catapult_target_building != 'RANDOM':
        from apps.game_engine.models import BuildingType
        valid_names = set(BuildingType.objects.values_list('name', flat=True))
        if catapult_target_building not in valid_names:
            catapult_target_building = 'RANDOM'

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

        from apps.game_engine.artifacts import get_movement_speed_multiplier  # ✅ جدید
        movement_artifact_multiplier = get_movement_speed_multiplier(player)  # ✅ جدید

        travel_seconds = calculate_travel_seconds(
            source_village, target_village, slowest_speed,
            artifact_speed_multiplier=movement_artifact_multiplier,  # ✅ جدید
        )
        arrival_time = timezone.now() + datetime.timedelta(seconds=travel_seconds)

        movement = TroopMovement.objects.create(
            source_village=source_village,
            target_village=target_village,
            movement_type=movement_type,
            troops_payload=troops_payload,
            arrival_time=arrival_time,
            farm_list_entry=farm_list_entry,
            hero_participating=hero_participating,
            catapult_target_building=catapult_target_building,
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