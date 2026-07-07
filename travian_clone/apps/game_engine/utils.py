import random
from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import ServerSetting, GameLog

# درصد تلفات نیرو در هر ساعتِ مستمرِ قحطی. عمدا قابل تنظیم گذاشته شده
# چون بالانس دقیق آن به سرعت سرور و سبک بازی شما بستگی دارد.
STARVATION_LOSS_PERCENT_PER_HOUR = 10


def calculate_crop_upkeep(village):
    """
    مجموع مصرف گندم (upkeep) تمام نیروهای مستقر و ساختمان‌های ساخته‌شده
    در این دهکده.

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


def _apply_starvation(village, elapsed_hours):
    """
    وقتی گندم دهکده به صفر رسیده و نرخ تولید خالص همچنان منفی است، بخشی از
    نیروهای مستقر به‌طور تصادفی از گشنگی می‌میرند - دقیقا مثل مکانیک قحطی
    (Famine) در تراوین اصلی.

    قبل از این تابع، crop فقط در صفر clamp می‌شد و هیچ پیامدی برای بازیکن
    نداشت؛ یعنی می‌شد نامحدود سرباز ساخت بدون هیچ نگرانی از تامین غذا.

    توجه: این پیاده‌سازی عمدا ساده و «شدید» است (تناسب مستقیم با ساعت‌های
    سپری‌شده در قحطی)؛ اگر یک بازیکن مدت طولانی آنلاین نشود و قحطی ادامه‌دار
    باشد، ممکن است کل ارتش را از دست بدهد. برای بالانس ملایم‌تر،
    STARVATION_LOSS_PERCENT_PER_HOUR را کم کنید یا یک سقف حداکثر تلفات در
    هر فراخوانی اضافه کنید.
    """
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

    village.wood = min(village.max_storage, village.wood + (village.prod_wood * delta_seconds * speed / 3600))
    village.clay = min(village.max_storage, village.clay + (village.prod_clay * delta_seconds * speed / 3600))
    village.iron = min(village.max_storage, village.iron + (village.prod_iron * delta_seconds * speed / 3600))

    raw_new_crop = village.crop + (net_crop_rate * delta_seconds * speed / 3600)

    if raw_new_crop < 0 and net_crop_rate < 0:
        # قحطی: گندم منفی می‌شود؛ نیروها گرسنگی می‌کشند و بخشی می‌میرند
        elapsed_hours = (delta_seconds * speed) / 3600
        village.crop = 0
        village.last_update = now
        village.save()
        _apply_starvation(village, elapsed_hours)
        return

    village.crop = max(0, min(village.max_granary, raw_new_crop))
    village.last_update = now
    village.save()