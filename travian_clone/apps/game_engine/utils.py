import random
from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import ServerSetting, GameLog, VillageBuilding

# درصد تلفات نیرو در هر ساعتِ مستمرِ قحطی.
STARVATION_LOSS_PERCENT_PER_HOUR = 10

# هر چند واحد منبعِ صرف‌شده در ساخت‌وساز معادل ۱ نفر جمعیت است. این عدد
# صرفا یک ثابت بالانسی است و می‌توانید برای تنظیم دقیق‌تر آن را تغییر دهید.
POPULATION_RESOURCE_DIVISOR = 100


def calculate_crop_upkeep(village):
    """مجموع مصرف گندم (upkeep) تمام نیروهای مستقر و ساختمان‌های ساخته‌شده در این دهکده."""
    from apps.combat.models import VillageTroop
    from .models import VillageBuilding

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
    """
    جمعیتی که یک ساختمان تا سطح فعلی‌اش ایجاد کرده، بر اساس مجموع منابعی
    که صرف رسیدن به این سطح شده (همان فرمول تصاعدی 1.5^level که در محاسبه‌ی
    هزینه‌ی ارتقا هم استفاده می‌شود).

    قبل از این تابع، جمعیت در LeaderboardView صرفا «مجموع سطح همه‌ی
    ساختمان‌ها» بود که هیچ ربطی به فرمول واقعی تراوین (جمعیت متناسب با
    منابع سرمایه‌گذاری‌شده) نداشت.
    """
    if level <= 0:
        return 0
    base_total_cost = (
        building_type.base_wood_cost + building_type.base_clay_cost +
        building_type.base_iron_cost + building_type.base_crop_cost
    )
    total_cost = sum(base_total_cost * (1.5 ** lvl) for lvl in range(level))
    return total_cost / POPULATION_RESOURCE_DIVISOR


def calculate_village_population(village):
    """جمعیت کل یک دهکده: مجموع جمعیت تمام ساختمان‌های ساخته‌شده‌اش."""
    from .models import VillageBuilding
    buildings = VillageBuilding.objects.filter(village=village, level__gt=0).select_related('building_type')
    return int(round(sum(calculate_building_population(b.building_type, b.level) for b in buildings)))


def _apply_starvation(village, elapsed_hours):
    """وقتی گندم دهکده به صفر رسیده و نرخ تولید خالص همچنان منفی است، بخشی از نیروها می‌میرند."""
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
        elapsed_hours_loyalty = (delta_seconds * speed) / 3600
        net_crop_rate = village.prod_crop - calculate_crop_upkeep(village)

        if village.loyalty < 100:
            elapsed_hours_loyalty = (delta_seconds * speed) / 3600
            # ✅ ترمیم وفاداری فقط وقتی اتفاق می‌افتد که عمارت اقامتی سرپا باشد
            residence_exists = VillageBuilding.objects.filter(
                village=village, building_type__name="عمارت اقامتی", level__gt=0
            ).exists()
            if residence_exists:
                village.loyalty = min(100.0, village.loyalty + elapsed_hours_loyalty * 10)  # +۱۰ در هر ساعت

    village.wood = min(village.max_storage, village.wood + (village.prod_wood * delta_seconds * speed / 3600))
    village.clay = min(village.max_storage, village.clay + (village.prod_clay * delta_seconds * speed / 3600))
    village.iron = min(village.max_storage, village.iron + (village.prod_iron * delta_seconds * speed / 3600))

    raw_new_crop = village.crop + (net_crop_rate * delta_seconds * speed / 3600)

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
    """آیا سرور فعال به پایان رسیده (برنده اعلام شده) است؟"""
    active_server = ServerSetting.objects.filter(is_active=True).first()
    return bool(active_server and active_server.is_finished)