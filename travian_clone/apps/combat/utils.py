import math

from apps.game_engine.models import ServerSetting


def calculate_travel_seconds(source_village, target_village, slowest_speed_tiles_per_hour, artifact_speed_multiplier=1.0):
    """
    محاسبه‌ی زمان سفر (به ثانیه) بر اساس فاصله واقعی بین دو دهکده روی نقشه،
    سرعت کندترین نیروی اعزامی، ضریب سرعت نیرو در تنظیمات سرور، و (در صورت
    وجود) ضریب کتیبه‌ی «چکمه خدایان» بازیکن مبدا.
    """
    distance = math.sqrt(
        (source_village.x_coord - target_village.x_coord) ** 2 +
        (source_village.y_coord - target_village.y_coord) ** 2
    )

    server_settings = ServerSetting.objects.filter(is_active=True).first()
    troop_speed_multiplier = server_settings.troop_speed if server_settings else 1
    if troop_speed_multiplier <= 0:
        troop_speed_multiplier = 1

    effective_speed = max(1, slowest_speed_tiles_per_hour) * troop_speed_multiplier * artifact_speed_multiplier  # ✅

    hours = distance / effective_speed
    seconds = hours * 3600

    return max(10, seconds)


def get_required_training_building(troop_type):
    if troop_type.is_siege_weapon:
        return "کارگاه"
    if troop_type.is_chief:
        return "عمارت اقامتی"
    if troop_type.is_cavalry:
        return "اصطبل"
    return "پادگان"