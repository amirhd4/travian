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

from .models import Village, BuildingType, VillageBuilding, ServerSetting

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

# ساختمان‌های داخل شهر (Dorf2) که در جایگاه‌های ۱۹ تا ۳۸ قرار می‌گیرند.
# قبل از این لیست، فقط ۷ ساختمان تعریف شده بود و ۱۳ جایگاه از این ۲۰ تا
# (که VillageMap.jsx از قبل مختصاتشان را رزرو کرده بود) اصلا هیچ رکوردی
# در دیتابیس نداشتند - یعنی برای بازیکن حتی قابل مشاهده هم نبودند.
_CITY_BUILDING_DEFS = (
    ("ساختمان اصلی", 1, 'INFRASTRUCTURE'),
    ("انبار", 1, 'INFRASTRUCTURE'),
    ("سیلوی غله", 1, 'INFRASTRUCTURE'),
    ("پادگان", 0, 'MILITARY'),
    ("اصطبل", 0, 'MILITARY'),
    ("کارگاه", 0, 'MILITARY'),
    ("بازارچه", 0, 'INFRASTRUCTURE'),
    ("سفارتخانه", 0, 'INFRASTRUCTURE'),
    ("خزانه‌داری", 0, 'INFRASTRUCTURE'),
    ("آکادمی", 0, 'MILITARY'),
    ("عمارت اقامتی", 0, 'INFRASTRUCTURE'),
    ("تالار شهر", 0, 'INFRASTRUCTURE'),
    ("مخفیگاه", 0, 'INFRASTRUCTURE'),
    ("مخفیگاه", 0, 'INFRASTRUCTURE'),
    ("آهنگری", 0, 'MILITARY'),
    ("کارگاه سنگ‌تراشی", 0, 'INFRASTRUCTURE'),
    ("عمارت قهرمان", 0, 'INFRASTRUCTURE'),
    ("آبشخور اسب", 0, 'MILITARY'),
    ("اداره تجارت", 0, 'INFRASTRUCTURE'),
    ("پادگان بزرگ", 0, 'MILITARY'),
)

# این دو جایگاه ثابت و ویژه‌اند (دقیقا مثل تراوین اصلی): محل گردهمایی
# همیشه جایگاه ۳۹ و دیوار همیشه جایگاه ۴۰ است.
_RALLY_POINT_DEF = ("محل گردهمایی", 1, 'INFRASTRUCTURE')
_WALL_DEF = ("دیوار (Wall)", 0, 'WALL')


def _find_free_coordinates(near_x=None, near_y=None, search_radius=20, quadrant=None):
    """
    یک مختصات (x, y) آزاد روی نقشه پیدا می‌کند.

    - اگر near_x/near_y داده شود: ابتدا نزدیک آن مختصات جستجو می‌کند
      (برای تاسیس دهکده جدید نزدیک دهکده مبدا).
    - اگر quadrant داده شود (NE/NW/SE/SW): جستجو به همان ربع نقشه محدود
      می‌شود (برای گزینه‌ی «محل شروع» در ثبت‌نام).
    - در غیر این صورت، جستجوی کاملا تصادفی در کل نقشه انجام می‌شود.
    """
    if near_x is not None and near_y is not None:
        for _ in range(MAX_COORDINATE_ATTEMPTS):
            x = near_x + random.randint(-search_radius, search_radius)
            y = near_y + random.randint(-search_radius, search_radius)
            if not Village.objects.filter(x_coord=x, y_coord=y).exists():
                return x, y

    quadrant_ranges = {
        'NE': ((1, MAP_SEARCH_RADIUS), (1, MAP_SEARCH_RADIUS)),
        'NW': ((-MAP_SEARCH_RADIUS, -1), (1, MAP_SEARCH_RADIUS)),
        'SE': ((1, MAP_SEARCH_RADIUS), (-MAP_SEARCH_RADIUS, -1)),
        'SW': ((-MAP_SEARCH_RADIUS, -1), (-MAP_SEARCH_RADIUS, -1)),
    }
    if quadrant in quadrant_ranges:
        x_range, y_range = quadrant_ranges[quadrant]
        for _ in range(MAX_COORDINATE_ATTEMPTS):
            x = random.randint(*x_range)
            y = random.randint(*y_range)
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

def _get_or_create_building_type(name, provides_wall_defense=False, max_level=20, category='INFRASTRUCTURE'):
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
            "category": category,
        },
    )
    return building_type


def _create_default_buildings(village):
    """
    چیدمان استاندارد ساختمان‌های یک دهکده تازه (چه دهکده اول، چه کلونی جدید).

    جایگاه ۱ تا ۱۸: مزارع منابع (Dorf1).
    جایگاه ۱۹ تا ۳۸: ساختمان‌های داخل شهر (Dorf2).
    جایگاه ۳۹: محل گردهمایی (رزرو ثابت).
    جایگاه ۴۰: دیوار (رزرو ثابت).
    این چیدمان دقیقا با مختصات تعریف‌شده در VillageMap.jsx (DORF1_SLOTS و
    DORF2_SLOTS) هماهنگ است.
    """
    position = 1
    for type_name, count in _RESOURCE_FIELD_DEFS:
        building_type = _get_or_create_building_type(type_name, category='RESOURCE')
        for _ in range(count):
            VillageBuilding.objects.create(
                village=village, building_type=building_type, position=position, level=1,
            )
            position += 1

    position = 19
    for type_name, level, category in _CITY_BUILDING_DEFS:
        building_type = _get_or_create_building_type(type_name, category=category)
        VillageBuilding.objects.create(
            village=village, building_type=building_type, position=position, level=level,
        )
        position += 1

    rally_name, rally_level, rally_category = _RALLY_POINT_DEF
    rally_type = _get_or_create_building_type(rally_name, category=rally_category)
    VillageBuilding.objects.create(village=village, building_type=rally_type, position=39, level=rally_level)

    wall_name, wall_level, wall_category = _WALL_DEF
    wall_type = _get_or_create_building_type(wall_name, provides_wall_defense=True, category=wall_category)
    VillageBuilding.objects.create(village=village, building_type=wall_type, position=40, level=wall_level)


@transaction.atomic
def create_starter_village(player, name="دهکده اول", starting_quadrant='RANDOM'):
    existing = Village.objects.filter(player=player).order_by('id').first()
    if existing:
        return existing

    server_settings = ServerSetting.objects.filter(is_active=True).first()
    max_storage = server_settings.starting_max_storage if server_settings else 800
    max_granary = server_settings.starting_max_granary if server_settings else 800

    quadrant = starting_quadrant if starting_quadrant in ('NE', 'NW', 'SE', 'SW') else None
    x, y = _find_free_coordinates(quadrant=quadrant)

    village = Village.objects.create(
        player=player, name=name, x_coord=x, y_coord=y, is_capital=True,
        wood=750.0, clay=750.0, iron=750.0, crop=750.0,
        prod_wood=20, prod_clay=20, prod_iron=20, prod_crop=20,
        max_storage=max_storage, max_granary=max_granary,
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

    server_settings = ServerSetting.objects.filter(is_active=True).first()
    max_storage = server_settings.starting_max_storage if server_settings else 800
    max_granary = server_settings.starting_max_granary if server_settings else 800

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
        max_storage=max_storage,
        max_granary=max_granary,
    )

    _create_default_buildings(new_village)

    return new_village


def _create_resource_fields_only(village):
    """فقط مزارع منابع (بدون هیچ ساختمان مرکزی) می‌سازد - برای دهکده‌های
    ویرانه‌ی ناتار که بعدا محل شگفتی جهان می‌شوند."""
    position = 1
    for type_name, count in _RESOURCE_FIELD_DEFS:
        building_type = _get_or_create_building_type(type_name, category='RESOURCE')
        for _ in range(count):
            VillageBuilding.objects.create(village=village, building_type=building_type, position=position, level=1)
            position += 1