from django.utils import timezone
from .models import ServerSetting


def update_village_resources(village):
    """محاسبه منابع بر اساس زمان سپری شده از آخرین آپدیت"""
    now = timezone.now()
    delta_seconds = (now - village.last_update).total_seconds()

    # دریافت ضریب سرعت سرور
    settings = ServerSetting.objects.get(is_active=True)
    speed = settings.server_speed

    # محاسبه تولید (تقسیم بر ۳۶۰۰ برای تبدیل نرخ ساعتی به ثانیه‌ای)
    village.wood = min(village.max_storage, village.wood + (village.prod_wood * delta_seconds * speed / 3600))
    village.clay = min(village.max_storage, village.clay + (village.prod_clay * delta_seconds * speed / 3600))
    village.iron = min(village.max_storage, village.iron + (village.prod_iron * delta_seconds * speed / 3600))
    village.crop = min(village.max_granary, village.crop + (village.prod_crop * delta_seconds * speed / 3600))

    village.last_update = now
    village.save()