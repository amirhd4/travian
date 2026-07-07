"""
منطق ساخت «دهکده اولیه» برای بازیکنان تازه ثبت‌نام کرده، و «تاسیس دهکده جدید»
(Colonization) برای بازیکنانی که مهاجر (Settler) کافی دارند.

قبل از این فایل، هیچ کدی وجود نداشت که برای یک بازیکن تازه‌وارد دهکده بسازد؛
بازیکن بعد از ثبت‌نام هیچ Village ای نداشت و کل بازی برایش کار نمی‌کرد. همچنین
هیچ راهی برای تاسیس دهکده دوم/سوم وجود نداشت.

نکته: create_starter_village idempotent است (اگر بازیکن از قبل دهکده داشته
باشد، کاری انجام نمی‌دهد) تا فراخوانی تصادفی دوباره‌اش (مثلا از طریق سیگنال)
مشکلی ایجاد نکند.
"""
import random

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Village, BuildingType, VillageBuilding

# محدوده نقشه برای جستجوی مختصات آزاد. در آینده می‌توان این را از
# ServerSetting گرفت تا با اندازه واقعی نقشه هماهنگ باشد.
MAP_SEARCH_RADIUS = 200
MAX_COORDINATE_ATTEMPTS = 500

# تعداد مهاجر لازم برای تاسیس یک دهکده جدید (مشابه تراوین اصلی)
SETTLERS_REQUIRED = 3

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
    ("بازارچه", 0, False),
    ("دیوار (Wall)", 0, True),
)


def _find_free_coordinates(near_x=None, near_y=None, search_radius=20):
    """
    یک مختصات (x, y) آزاد روی نقشه پیدا می‌کند.

    اگر near_x/near_y داده شود، ابتدا در شعاع نزدیک آن مختصات جستجو می‌کند
    (برای تاسیس دهکده جدید نزدیک دهکده مبدا - قبلا این تابع کاملا تصادفی
    در کل نقشه ۲۰۰×۲۰۰ جستجو می‌کرد و دهکده جدید ممکن بود صدها خانه با
    دهکده مبدا فاصله داشته باشد)؛ در غیر این صورت به جستجوی کاملا تصادفی
    در کل نقشه برمی‌گردد (رفتار قبلی، برای اولین دهکده بازیکن تازه‌وارد).
    """
    if near_x is not None and near_y is not None:
        for _ in range(MAX_COORDINATE_ATTEMPTS):
            x = near_x + random.randint(-search_radius, search_radius)
            y = near_y + random.randint(-search_radius, search_radius)
            if not Village.objects.filter(x_coord=x, y_coord=y).exists():
                return x, y

    for _ in range(MAX_COORDINATE_ATTEMPTS):
        x = random.randint(-MAP_SEARCH_RADIUS, MAP_SEARCH_RADIUS)
        y = random.randint(-MAP_SEARCH_RADIUS, MAP_SEARCH_RADIUS)
        if not Village.objects.filter(x_coord=x, y_coord=y).exists():
            return x, y
    raise RuntimeError(
        "مختصات آزادی روی نقشه پیدا نشد؛ محدوده نقشه را بزرگ‌تر کنید."
    )


def _get_or_create_building_type(name, provides_wall_defense=False, max_level=20):
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
            "max_level": max_level,
        },
    )
    return building_type


def _create_default_buildings(village):
    """چیدمان استاندارد ساختمان‌های یک دهکده تازه (چه دهکده اول، چه کلونی جدید)."""
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

    _create_default_buildings(village)

    return village


def found_new_village(player, source_village, target_x=None, target_y=None, name="دهکده جدید"):
    """
    تاسیس یک دهکده جدید (Colonization) با مصرف ۳ نیروی مهاجر از دهکده مبدا.

    قبل از این تابع، هیچ راهی برای تاسیس دهکده دوم/سوم وجود نداشت؛ سیستم
    چند دهکده‌ای فقط از طریق ادمین جنگو قابل شبیه‌سازی بود.
    """
    from apps.combat.models import VillageTroop

    if source_village.player_id != player.id:
        raise ValidationError("این دهکده متعلق به شما نیست.")

    settler_troops = list(
        VillageTroop.objects.select_for_update().filter(
            village=source_village, troop_type__is_settler=True
        ).select_related('troop_type')
    )
    total_settlers = sum(vt.count for vt in settler_troops)
    if total_settlers < SETTLERS_REQUIRED:
        raise ValidationError(
            f"برای تاسیس دهکده جدید به {SETTLERS_REQUIRED} نیروی مهاجر در دهکده مبدا نیاز دارید "
            f"(در حال حاضر {total_settlers} عدد دارید)."
        )

    if target_x is not None and target_y is not None:
        if Village.objects.filter(x_coord=target_x, y_coord=target_y).exists():
            raise ValidationError("این مختصات قبلا توسط دهکده دیگری اشغال شده است.")
        x, y = target_x, target_y
    else:
        x, y = _find_free_coordinates(near_x=source_village.x_coord, near_y=source_village.y_coord)

    # کسر مهاجرها از دهکده مبدا (به ترتیب از گروه‌های موجود مصرف می‌شود)
    remaining_to_deduct = SETTLERS_REQUIRED
    for vt in settler_troops:
        if remaining_to_deduct <= 0:
            break
        deduct = min(vt.count, remaining_to_deduct)
        vt.count -= deduct
        vt.save()
        remaining_to_deduct -= deduct

    new_village = Village.objects.create(
        player=player,
        name=name or "دهکده جدید",
        x_coord=x,
        y_coord=y,
        is_capital=False,
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

    _create_default_buildings(new_village)

    return new_village