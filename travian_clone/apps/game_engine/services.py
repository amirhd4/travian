"""
منطق ساخت «دهکده اولیه» برای بازیکنان تازه ثبت‌نام کرده، و «تاسیس دهکده جدید»
(Colonization) برای بازیکنانی که مهاجر (Settler) کافی دارند.
"""
import random

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Village, BuildingType, VillageBuilding, ServerSetting, Oasis

MAP_SEARCH_RADIUS = 200
MAX_COORDINATE_ATTEMPTS = 500

SETTLERS_REQUIRED = 3
# MAX_VILLAGES = 3

FIELD_DISTRIBUTIONS = {
    'NORMAL': {
        "چوب‌بری": 4, "گودال خاک رس": 4, "معدن آهن": 4, "مزرعه گندم": 6,
    },
    'CROPPER_9': {
        "چوب‌بری": 3, "گودال خاک رس": 3, "معدن آهن": 3, "مزرعه گندم": 9,
    },
    'CROPPER_15': {
        "چوب‌بری": 1, "گودال خاک رس": 1, "معدن آهن": 1, "مزرعه گندم": 15,
    },
}

FIELD_DISTRIBUTION_WEIGHTS = {
    'NORMAL': 85,
    'CROPPER_9': 11,
    'CROPPER_15': 4,
}

# ساختمان‌های داخل شهر (Dorf2) که در جایگاه‌های ۱۹ تا ۳۸ قرار می‌گیرند.
# ✅ یکی از سه «مخفیگاه» تکراری با «آهنگری» (ارتقای نیرو تا لول ۲۰) جایگزین شد
# تا مجموع اسلات‌ها همچنان ۴۰ باقی بماند.
# _CITY_BUILDING_DEFS = (
#     ("ساختمان اصلی", 1, 'INFRASTRUCTURE'),
#     ("انبار", 1, 'INFRASTRUCTURE'),
#     ("سیلوی غله", 1, 'INFRASTRUCTURE'),
#     ("پادگان", 0, 'MILITARY'),
#     ("اصطبل", 0, 'MILITARY'),
#     ("کارگاه", 0, 'MILITARY'),
#     ("بازارچه", 0, 'INFRASTRUCTURE'),
#     ("سفارتخانه", 0, 'INFRASTRUCTURE'),
#     ("خزانه‌داری", 0, 'INFRASTRUCTURE'),
#     ("آکادمی", 0, 'MILITARY'),
#     ("اقامتگاه", 0, 'INFRASTRUCTURE'),
#     ("تالار شهر", 0, 'INFRASTRUCTURE'),
#     ("مخفیگاه", 0, 'INFRASTRUCTURE'),
#     ("مخفیگاه", 0, 'INFRASTRUCTURE'),
#     ("آهنگری", 0, 'MILITARY'),
#     ("کارگاه سنگ‌تراشی", 0, 'INFRASTRUCTURE'),
#     ("عمارت قهرمان", 0, 'INFRASTRUCTURE'),
#     ("آبشخور اسب", 0, 'MILITARY'),
#     ("اداره تجارت", 0, 'INFRASTRUCTURE'),
#     ("پادگان بزرگ", 0, 'MILITARY'),
# )


_CITY_BUILDING_DEFS = (
    ("ساختمان اصلی", 1, 'INFRASTRUCTURE'),
    ("انبار", 1, 'INFRASTRUCTURE'),
    ("سیلوی غله", 1, 'INFRASTRUCTURE'),

    ("پادگان", 0, 'MILITARY'),
    ("اصطبل", 0, 'MILITARY'),
    ("کارگاه", 0, 'MILITARY'),
    ("آهنگری", 0, 'MILITARY'),
    ("آکادمی", 0, 'MILITARY'),

    ("بازارچه", 0, 'INFRASTRUCTURE'),
    ("سفارتخانه", 0, 'INFRASTRUCTURE'),
    ("خزانه‌داری", 0, 'INFRASTRUCTURE'),
    ("اقامتگاه", 0, 'INFRASTRUCTURE'),
    ("قصر", 0, 'INFRASTRUCTURE'),
    ("تالار شهر", 0, 'INFRASTRUCTURE'),

    ("مخفیگاه", 0, 'INFRASTRUCTURE'),
    ("آسیاب", 0, 'INFRASTRUCTURE'),
    ("کارگاه سنگ‌تراشی", 0, 'INFRASTRUCTURE'),
    ("عمارت قهرمان", 0, 'INFRASTRUCTURE'),
)

_RALLY_POINT_DEF = ("محل گردهمایی", 1, 'INFRASTRUCTURE')
_WALL_DEF = ("دیوار", 0, 'WALL')


def _find_free_coordinates(near_x=None, near_y=None, search_radius=20, quadrant=None):
    def _is_occupied(x, y):
        # ✅ FIX: قبلا فقط Village چک می‌شد؛ نتیجه‌اش این بود که دهکده‌ی جدید
        # می‌توانست دقیقا روی مختصات یک اوسیس موجود ساخته شود.
        return (
            Village.objects.filter(x_coord=x, y_coord=y).exists() or
            Oasis.objects.filter(x_coord=x, y_coord=y).exists()
        )

    if near_x is not None and near_y is not None:
        for _ in range(MAX_COORDINATE_ATTEMPTS):
            x = near_x + random.randint(-search_radius, search_radius)
            y = near_y + random.randint(-search_radius, search_radius)
            if not _is_occupied(x, y):
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
            if not _is_occupied(x, y):
                return x, y

    for _ in range(MAX_COORDINATE_ATTEMPTS):
        x = random.randint(-MAP_SEARCH_RADIUS, MAP_SEARCH_RADIUS)
        y = random.randint(-MAP_SEARCH_RADIUS, MAP_SEARCH_RADIUS)
        if not _is_occupied(x, y):
            return x, y
    raise RuntimeError("مختصات آزادی روی نقشه پیدا نشد؛ محدوده نقشه را بزرگ‌تر کنید.")


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


def _pick_field_distribution():
    """یک نوع توزیع زمین (عادی/۹ گندمی/۱۵ گندمی) با احتمال وزن‌دار انتخاب می‌کند."""
    keys = list(FIELD_DISTRIBUTION_WEIGHTS.keys())
    weights = list(FIELD_DISTRIBUTION_WEIGHTS.values())
    return random.choices(keys, weights=weights, k=1)[0]


def _create_default_buildings(village, distribution_key='NORMAL'):
    if VillageBuilding.objects.filter(village=village).exists():
        return
    position = 1
    field_defs = FIELD_DISTRIBUTIONS.get(distribution_key, FIELD_DISTRIBUTIONS['NORMAL'])
    for type_name, count in field_defs.items():
        building_type = _get_or_create_building_type(type_name, category='RESOURCE')
        for _ in range(count):
            VillageBuilding.objects.create(
                village=village, building_type=building_type, position=position, level=1,
            )
            position += 1

    position = 19
    for type_name, level, category in _CITY_BUILDING_DEFS:
        # ✅ FIX: طبق تراوین اصلی، مخفی‌گاه حداکثر سطح ۱۰ دارد (نه ۲۰).
        max_level_override = 10 if type_name == "مخفیگاه" else 20
        building_type = _get_or_create_building_type(type_name, category=category, max_level=max_level_override)
        if building_type.max_level != max_level_override:
            building_type.max_level = max_level_override
            building_type.save(update_fields=['max_level'])
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

    trapper_type = _get_or_create_building_type("تله", category='MILITARY')
    VillageBuilding.objects.create(village=village, building_type=trapper_type, position=41, level=0)


def _get_starting_capacities():
    """✅ ظرفیت شروع انبار/سیلو را از تنظیمات سرور فعال می‌خواند (قابل تنظیم برای هر سرور)."""
    server_settings = ServerSetting.objects.filter(is_active=True).first()
    if server_settings:
        return server_settings.starting_max_storage, server_settings.starting_max_granary
    return 800, 800


@transaction.atomic
def create_starter_village(player, name="دهکده اول", starting_quadrant='RANDOM'):
    existing = Village.objects.filter(player=player).order_by('id').first()
    if existing:
        return existing

    max_storage, max_granary = _get_starting_capacities()

    quadrant = starting_quadrant if starting_quadrant in ('NE', 'NW', 'SE', 'SW') else None
    x, y = _find_free_coordinates(quadrant=quadrant)

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
        prod_crop=50,
        max_storage=max_storage,
        max_granary=max_granary,
    )

    _create_default_buildings(village)

    return village


def found_new_village(player, source_village, target_x=None, target_y=None, name="دهکده جدید"):
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

    from .utils import required_culture_points_for_nth_village
    current_village_count = Village.objects.filter(player=player, is_farm_village=False).count()
    target_village_number = current_village_count + 1
    required_cp = required_culture_points_for_nth_village(target_village_number)
    if player.culture_points < required_cp:
        raise ValidationError(
            f"برای تاسیس دهکده‌ی شماره {target_village_number} به {int(required_cp)} امتیاز فرهنگی نیاز دارید "
            f"(در حال حاضر {int(player.culture_points)} امتیاز دارید)."
        )

    # if current_village_count >= MAX_VILLAGES:
    #     raise ValidationError(
    #         f"شما به حداکثر {MAX_VILLAGES} دهکده رسیده‌اید و امکان تاسیس دهکده جدید وجود ندارد."
    #     )

    if target_x is not None and target_y is not None:
        if Village.objects.filter(x_coord=target_x, y_coord=target_y).exists():
            raise ValidationError("این مختصات قبلا توسط دهکده دیگری اشغال شده است.")
        x, y = target_x, target_y
    else:
        x, y = _find_free_coordinates(near_x=source_village.x_coord, near_y=source_village.y_coord)

    remaining_to_deduct = SETTLERS_REQUIRED
    for vt in settler_troops:
        if remaining_to_deduct <= 0:
            break
        deduct = min(vt.count, remaining_to_deduct)
        vt.count -= deduct
        vt.save()
        remaining_to_deduct -= deduct

    max_storage, max_granary = _get_starting_capacities()

    distribution_key = _pick_field_distribution()

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

    _create_default_buildings(village, distribution_key=distribution_key)

    return new_village


def abandon_village(player, village):
    if village.player_id != player.id:
        raise ValidationError("این دهکده متعلق به شما نیست.")
    if village.is_capital:
        raise ValidationError("امکان رها کردن دهکده پایتخت وجود ندارد.")
    non_farm_count = Village.objects.filter(
        player=player, is_farm_village=False
    ).count()
    if non_farm_count <= 1:
        raise ValidationError("امکان رها کردن آخرین دهکده وجود ندارد.")
    village.delete()


def _create_resource_fields_only(village, distribution_key='NORMAL'):
    if VillageBuilding.objects.filter(village=village).exists():
        return
    position = 1
    field_defs = FIELD_DISTRIBUTIONS.get(distribution_key, FIELD_DISTRIBUTIONS['NORMAL'])
    for type_name, count in field_defs.items():
        building_type = _get_or_create_building_type(type_name, category='RESOURCE')
        for _ in range(count):
            VillageBuilding.objects.create(village=village, building_type=building_type, position=position, level=1)
            position += 1