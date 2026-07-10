import random
from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import ServerSetting, GameLog, VillageBuilding

STARVATION_LOSS_PERCENT_PER_HOUR = 10
POPULATION_RESOURCE_DIVISOR = 100

# ✅ نرخ ترمیم وفاداری توسط عمارت اقامتی (امتیاز در ساعت) - قبلا اشتباهاً ۱ بود
LOYALTY_REGEN_PER_HOUR = 10


def calculate_crop_upkeep(village):
    from apps.combat.models import VillageTroop

    troop_upkeep = sum(
        vt.count * vt.troop_type.crop_upkeep
        for vt in VillageTroop.objects.filter(village=village).select_related('troop_type')
    )
    building_upkeep = sum(
        b.building_type.crop_upkeep
        for b in VillageBuilding.objects.filter(village=village, level__gt=0).select_related('building_type')
    )
    return troop_upkeep + building_upkeep


def calculate_building_population(building_type, level):
    if level <= 0:
        return 0
    base_total_cost = (
        building_type.base_wood_cost + building_type.base_clay_cost +
        building_type.base_iron_cost + building_type.base_crop_cost
    )
    total_cost = sum(base_total_cost * (1.5 ** lvl) for lvl in range(level))
    return total_cost / POPULATION_RESOURCE_DIVISOR


def calculate_village_population(village):
    buildings = VillageBuilding.objects.filter(village=village, level__gt=0).select_related('building_type')
    return int(round(sum(calculate_building_population(b.building_type, b.level) for b in buildings)))


def _apply_starvation(village, elapsed_hours):
    from apps.combat.models import VillageTroop

    total_lost = 0
    with transaction.atomic():
        troops = list(
            VillageTroop.objects.select_for_update()
            .filter(village=village, count__gt=0)
            .select_related('troop_type')
        )
        if not troops:
            return

        loss_ratio = min(1.0, (STARVATION_LOSS_PERCENT_PER_HOUR / 100) * elapsed_hours)
        if loss_ratio <= 0:
            return

        random.shuffle(troops)
        for vt in troops:
            lost = min(vt.count, int(round(vt.count * loss_ratio)))
            if lost > 0:
                vt.count -= lost
                vt.save()
                total_lost += lost

    if total_lost <= 0:
        return

    GameLog.objects.create(
        village=village,
        log_type='SYSTEM',
        description=f"⚠️ قحطی گندم باعث مرگ {total_lost} نیرو در دهکده {village.name} شد!",
    )

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"player_{village.player_id}",
            {
                "type": "send_game_update",
                "update_type": "FAMINE_WARNING",
                "payload": {
                    "message": (
                        f"⚠️ قحطی گندم در دهکده {village.name} باعث مرگ {total_lost} نیرو شد! "
                        "فورا تولید گندم را افزایش دهید یا تعداد نیرو را کاهش دهید."
                    ),
                    "village_id": village.id,
                    "troops_lost": total_lost,
                },
            }
        )


def _get_hero_resource_bonus(village):
    """
    اگر قهرمانِ زنده و در دسترسِ صاحب این دهکده، این دهکده را به‌عنوان خانه انتخاب کرده
    باشد و در ماموریت/ماجراجویی نباشد، نرخ اضافه‌ی تولید منابع (بر ساعت) و نوع منبع
    هدف را برمی‌گرداند. قبل از این، امتیاز «منابع» قهرمان اصلا هیچ اثری نداشت.
    """
    from apps.combat.models import Hero

    try:
        hero = Hero.objects.get(home_village=village, is_alive=True)
    except Hero.DoesNotExist:
        return None, 0

    if hero.is_away or hero.is_on_adventure:
        return None, 0

    if hero.resource_points <= 0:
        return None, 0

    rate_per_hour = hero.resource_points * Hero.RESOURCE_UNITS_PER_POINT_PER_HOUR
    return hero.resource_production_type, rate_per_hour


def update_village_resources(village):
    """محاسبه منابع بر اساس زمان سپری‌شده از آخرین آپدیت + بررسی قحطی گندم."""
    now = timezone.now()
    delta_seconds = (now - village.last_update).total_seconds()
    if delta_seconds <= 0:
        return

    settings = ServerSetting.objects.get(is_active=True)
    speed = settings.server_speed

    net_crop_rate = village.prod_crop - calculate_crop_upkeep(village)

    if village.loyalty < 100:
        # ✅ ترمیم وفاداری فقط وقتی اتفاق می‌افتد که عمارت اقامتی این دهکده سرپا باشد
        # (طبق قانون: اگر عمارت اقامتی با منجنیق تخریب و نابود شده باشد، وفاداری
        # دیگر خودبه‌خود ترمیم نمی‌شود)
        residence_exists = VillageBuilding.objects.filter(
            village=village, building_type__name="عمارت اقامتی", level__gt=0
        ).exists()
        if residence_exists:
            elapsed_hours_loyalty = (delta_seconds * speed) / 3600
            village.loyalty = min(100.0, village.loyalty + elapsed_hours_loyalty * LOYALTY_REGEN_PER_HOUR)

    # ✅ بونوس منابع قهرمان (امتیازهای «منابع» که در صفحه‌ی قهرمان توزیع شده‌اند)
    hero_resource_type, hero_rate_per_hour = _get_hero_resource_bonus(village)

    def _hero_extra(resource_key):
        if hero_resource_type == resource_key:
            return hero_rate_per_hour * delta_seconds * speed / 3600
        return 0

    village.wood = min(village.max_storage, village.wood + (village.prod_wood * delta_seconds * speed / 3600) + _hero_extra('wood'))
    village.clay = min(village.max_storage, village.clay + (village.prod_clay * delta_seconds * speed / 3600) + _hero_extra('clay'))
    village.iron = min(village.max_storage, village.iron + (village.prod_iron * delta_seconds * speed / 3600) + _hero_extra('iron'))

    raw_new_crop = village.crop + (net_crop_rate * delta_seconds * speed / 3600) + _hero_extra('crop')

    if raw_new_crop < 0 and net_crop_rate < 0:
        elapsed_hours = (delta_seconds * speed) / 3600
        village.crop = 0
        village.last_update = now
        village.save()
        _apply_starvation(village, elapsed_hours)
        return

    village.crop = max(0, min(village.max_granary, raw_new_crop))
    village.last_update = now
    village.save()


def is_server_finished():
    active_server = ServerSetting.objects.filter(is_active=True).first()
    return bool(active_server and active_server.is_finished)