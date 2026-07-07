import math
from .models import VillageBuilding, ServerSetting, ResourceTrade

MERCHANT_BASE_COUNT = 2               # تعداد تاجر پایه حتی بدون ساخت بازارچه
MERCHANT_PER_LEVEL = 1                # هر سطح بازارچه، یک تاجر اضافه می‌کند
MERCHANT_CAPACITY = 500               # ظرفیت حمل هر تاجر (واحد منبع)
MERCHANT_SPEED_TILES_PER_HOUR = 16    # سرعت میانگین تاجر روی نقشه


def get_marketplace_level(village):
    building = VillageBuilding.objects.filter(
        village=village, building_type__name="بازارچه"
    ).first()
    return building.level if building else 0


def get_total_merchants(village):
    return MERCHANT_BASE_COUNT + get_marketplace_level(village) * MERCHANT_PER_LEVEL


def get_busy_merchants(village):
    """تعداد تاجرهایی که الان یا در راه مقصدند یا هنوز از سفر برنگشته‌اند."""
    active_trades = ResourceTrade.objects.filter(source_village=village, is_completed=False)
    return sum(t.merchants_used for t in active_trades)


def get_available_merchants(village):
    return max(0, get_total_merchants(village) - get_busy_merchants(village))


def calculate_merchant_travel_seconds(source_village, target_village):
    distance = math.sqrt(
        (source_village.x_coord - target_village.x_coord) ** 2 +
        (source_village.y_coord - target_village.y_coord) ** 2
    )
    server_settings = ServerSetting.objects.filter(is_active=True).first()
    speed_multiplier = server_settings.troop_speed if server_settings else 1
    if speed_multiplier <= 0:
        speed_multiplier = 1
    effective_speed = MERCHANT_SPEED_TILES_PER_HOUR * speed_multiplier
    hours = distance / effective_speed
    return max(10, hours * 3600)