"""
منطق ساخت «دهکده اولیه» برای بازیکنان تازه ثبت‌نام کرده.

قبل از این فایل، هیچ کدی وجود نداشت که برای یک بازیکن تازه‌وارد دهکده بسازد؛
بازیکن بعد از ثبت‌نام هیچ Village ای نداشت و کل بازی برایش کار نمی‌کرد.

نکته: این تابع idempotent است (اگر بازیکن از قبل دهکده داشته باشد، کاری
انجام نمی‌دهد) تا فراخوانی تصادفی دوباره‌اش (مثلا از طریق سیگنال) مشکلی
ایجاد نکند.
"""
import random

from django.db import transaction

from .models import Village, BuildingType, VillageBuilding

# محدوده نقشه برای جستجوی مختصات آزاد. در آینده می‌توان این را از
# ServerSetting گرفت تا با اندازه واقعی نقشه هماهنگ باشد.
MAP_SEARCH_RADIUS = 200
MAX_COORDINATE_ATTEMPTS = 500

# چیدمان ساده‌شده جایگاه‌های دهکده: ۴ چوب‌بری + ۴ گودال خاک‌رس + ۴ معدن آهن
# + ۶ مزرعه گندم (جمعا ۱۸ جایگاه منبع، دقیقا مثل تراوین اصلی) + ۶ ساختمان
# مرکزی پایه (ساختمان اصلی، انبار، سیلوی غله، محل گردهمایی، پادگان، دیوار).
_RESOURCE_FIELD_DEFS = (
    ("چوب‌بری", 4),
    ("گودال خاک رس", 4),
    ("معدن آهن", 4),
    ("مزرعه گندم", 6),
)

# (نام ساختمان, سطح اولیه, آیا نقش دیوار دفاعی دارد)
_CENTER_BUILDING_DEFS = (
    ("ساختمان اصلی", 1, False),
    ("انبار", 1, False),
    ("سیلوی غله", 1, False),
    ("محل گردهمایی", 1, False),
    ("پادگان", 0, False),
    ("دیوار (Wall)", 0, True),
)


def _find_free_coordinates():
    """یک مختصات (x, y) آزاد روی نقشه پیدا می‌کند."""
    for _ in range(MAX_COORDINATE_ATTEMPTS):
        x = random.randint(-MAP_SEARCH_RADIUS, MAP_SEARCH_RADIUS)
        y = random.randint(-MAP_SEARCH_RADIUS, MAP_SEARCH_RADIUS)
        if not Village.objects.filter(x_coord=x, y_coord=y).exists():
            return x, y
    raise RuntimeError(
        "مختصات آزادی روی نقشه پیدا نشد؛ محدوده نقشه را بزرگ‌تر کنید."
    )


def _get_or_create_building_type(name, provides_wall_defense=False):
    building_type, _ = BuildingType.objects.get_or_create(
        name=name,
        defaults={
            "description": "",
            "base_wood_cost": 50,
            "base_clay_cost": 50,
            "base_iron_cost": 50,
            "base_crop_cost": 50,
            "base_build_time": 120,
            "crop_upkeep": 1,
            "provides_wall_defense": provides_wall_defense,
        },
    )
    return building_type


@transaction.atomic
def create_starter_village(player, name="دهکده اول"):
    """
    برای یک بازیکن دهکده اولیه می‌سازد (اگر از قبل نداشته باشد) و آن را
    به عنوان پایتخت علامت‌گذاری می‌کند. این تابع هم از سیگنال ثبت‌نام
    فراخوانی می‌شود و هم می‌تواند برای بازیکنان قدیمی که دهکده ندارند
    به صورت دستی (مثلا از طریق manage.py shell) اجرا شود.
    """
    existing = Village.objects.filter(player=player).order_by('id').first()
    if existing:
        return existing

    x, y = _find_free_coordinates()

    village = Village.objects.create(
        player=player,
        name=name,
        x_coord=x,
        y_coord=y,
        is_capital=True,
        wood=750.0,
        clay=750.0,
        iron=750.0,
        crop=750.0,
        prod_wood=20,
        prod_clay=20,
        prod_iron=20,
        prod_crop=20,
        max_storage=800,
        max_granary=800,
    )

    position = 1
    for type_name, level, is_wall in _CENTER_BUILDING_DEFS:
        building_type = _get_or_create_building_type(type_name, provides_wall_defense=is_wall)
        VillageBuilding.objects.create(
            village=village,
            building_type=building_type,
            position=position,
            level=level,
        )
        position += 1

    for type_name, count in _RESOURCE_FIELD_DEFS:
        building_type = _get_or_create_building_type(type_name)
        for _ in range(count):
            VillageBuilding.objects.create(
                village=village,
                building_type=building_type,
                position=position,
                level=1,
            )
            position += 1

    return village