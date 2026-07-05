from django.utils import timezone
from .models import ServerSetting


def calculate_crop_upkeep(village):
    """
    مجموع مصرف گندم (upkeep) تمام نیروهای مستقر و ساختمان‌های ساخته‌شده
    در این دهکده. قبل از این تابع، مصرف گندم نیروها اصلا محاسبه نمی‌شد و
    produce_crop به صورت خام و بدون کسر upkeep به منابع اضافه می‌شد.

    ایمپورت apps.combat.models به صورت محلی انجام می‌شود تا وابستگی چرخه‌ای
    بین اپ game_engine و combat (که خودش از game_engine.models وارد می‌کند)
    ایجاد نشود.
    """
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


def update_village_resources(village):
    """محاسبه منابع بر اساس زمان سپری شده از آخرین آپدیت"""
    now = timezone.now()
    delta_seconds = (now - village.last_update).total_seconds()
    if delta_seconds <= 0:
        return

    # دریافت ضریب سرعت سرور
    settings = ServerSetting.objects.get(is_active=True)
    speed = settings.server_speed

    # نرخ خالص تولید گندم = تولید خام منهای مصرف نیروها و ساختمان‌ها
    net_crop_rate = village.prod_crop - calculate_crop_upkeep(village)

    # محاسبه تولید (تقسیم بر ۳۶۰۰ برای تبدیل نرخ ساعتی به ثانیه‌ای)
    village.wood = min(village.max_storage, village.wood + (village.prod_wood * delta_seconds * speed / 3600))
    village.clay = min(village.max_storage, village.clay + (village.prod_clay * delta_seconds * speed / 3600))
    village.iron = min(village.max_storage, village.iron + (village.prod_iron * delta_seconds * speed / 3600))
    village.crop = max(0, min(village.max_granary, village.crop + (net_crop_rate * delta_seconds * speed / 3600)))

    village.last_update = now
    village.save()