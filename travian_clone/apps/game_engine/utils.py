import random
from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import ServerSetting, GameLog, VillageBuilding, Village


STARVATION_LOSS_PERCENT_PER_HOUR = 10
POPULATION_RESOURCE_DIVISOR = 100

# ✅ نرخ ترمیم وفاداری توسط اقامتگاه (امتیاز در ساعت) - قبلا اشتباهاً ۱ بود
LOYALTY_REGEN_PER_HOUR = 10


def calculate_crop_upkeep(village):
    from apps.combat.models import VillageTroop

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
    if level <= 0:
        return 0
    base_total_cost = (
        building_type.base_wood_cost + building_type.base_clay_cost +
        building_type.base_iron_cost + building_type.base_crop_cost
    )
    total_cost = sum(base_total_cost * (1.5 ** lvl) for lvl in range(level))
    return total_cost / POPULATION_RESOURCE_DIVISOR


def calculate_village_population(village):
    buildings = VillageBuilding.objects.filter(village=village, level__gt=0).select_related('building_type')
    return int(round(sum(calculate_building_population(b.building_type, b.level) for b in buildings)))


def _apply_starvation(village, elapsed_hours):
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


def _get_hero_resource_bonus(village):
    """
    اگر قهرمانِ زنده و در دسترسِ صاحب این دهکده، این دهکده را به‌عنوان خانه انتخاب کرده
    باشد و در ماموریت/ماجراجویی نباشد، نرخ اضافه‌ی تولید منابع (بر ساعت) و نوع منبع
    هدف را برمی‌گرداند. قبل از این، امتیاز «منابع» قهرمان اصلا هیچ اثری نداشت.
    """
    from apps.combat.models import Hero

    try:
        hero = Hero.objects.get(home_village=village, is_alive=True)
    except Hero.DoesNotExist:
        return None, 0

    if hero.is_away or hero.is_on_adventure:
        return None, 0

    if hero.resource_points <= 0:
        return None, 0

    rate_per_hour = hero.resource_points * Hero.RESOURCE_UNITS_PER_POINT_PER_HOUR
    return hero.resource_production_type, rate_per_hour


def _get_oasis_bonus_multipliers(village):
    multipliers = {'wood': 1.0, 'clay': 1.0, 'iron': 1.0, 'crop': 1.0}
    for oasis in village.oases.all():
        pct = oasis.bonus_percent / 100
        if oasis.bonus_resource == 'all':
            for key in multipliers:
                multipliers[key] += pct
        else:
            multipliers[oasis.bonus_resource] += pct
    return multipliers


MILL_BONUS_PERCENT_PER_LEVEL = 3  # ✅ جدید: هر سطح آسیاب، تولید گندم را ۳٪ افزایش می‌دهد


def _get_mill_multiplier(village):
    mill = VillageBuilding.objects.filter(village=village, building_type__name="آسیاب").first()
    level = mill.level if mill else 0
    return 1 + (level * MILL_BONUS_PERCENT_PER_LEVEL / 100)


def update_village_resources(village):
    """محاسبه منابع بر اساس زمان سپری‌شده از آخرین آپدیت + بررسی قحطی گندم."""
    now = timezone.now()
    delta_seconds = (now - village.last_update).total_seconds()
    if delta_seconds <= 0:
        return

    settings = ServerSetting.objects.filter(is_active=True).first()
    speed = settings.server_speed if settings else 1

    oasis_mult = _get_oasis_bonus_multipliers(village)
    mill_mult = _get_mill_multiplier(village)  # ✅ جدید

    net_crop_rate = (village.prod_crop * oasis_mult['crop'] * mill_mult) - calculate_crop_upkeep(village)

    if village.loyalty < 100:
        residence_exists = VillageBuilding.objects.filter(
            village=village, building_type__name="اقامتگاه", level__gt=0
        ).exists()
        if residence_exists:
            elapsed_hours_loyalty = (delta_seconds * speed) / 3600
            village.loyalty = min(100.0, village.loyalty + elapsed_hours_loyalty * LOYALTY_REGEN_PER_HOUR)

    hero_resource_type, hero_rate_per_hour = _get_hero_resource_bonus(village)

    def _hero_extra(resource_key):
        if hero_resource_type == resource_key:
            return hero_rate_per_hour * delta_seconds * speed / 3600
        return 0

    gold_mult = _get_gold_resource_bonus_multipliers(village)

    village.wood = min(village.max_storage, village.wood + (village.prod_wood * oasis_mult['wood'] * gold_mult['wood'] * delta_seconds * speed / 3600) + _hero_extra('wood'))
    village.clay = min(village.max_storage, village.clay + (village.prod_clay * oasis_mult['clay'] * gold_mult['clay'] * delta_seconds * speed / 3600) + _hero_extra('clay'))
    village.iron = min(village.max_storage, village.iron + (village.prod_iron * oasis_mult['iron'] * gold_mult['iron'] * delta_seconds * speed / 3600) + _hero_extra('iron'))

    raw_new_crop = village.crop + (net_crop_rate * gold_mult['crop'] * delta_seconds * speed / 3600) + _hero_extra('crop')

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
    active_server = ServerSetting.objects.filter(is_active=True).first()
    return bool(active_server and active_server.is_finished)


CULTURE_POINT_DIVISOR = 500


def calculate_building_culture_points(building_type, level):
    """تولید امتیاز فرهنگی در ساعت برای یک ساختمان مشخص در سطح مشخص.
    فرمول ساده‌شده: هرچه ساختمان گران‌تر/سطح بالاتر، امتیاز فرهنگی بیشتری در ساعت می‌دهد."""
    if level <= 0:
        return 0
    base_total_cost = (
        building_type.base_wood_cost + building_type.base_clay_cost +
        building_type.base_iron_cost + building_type.base_crop_cost
    )
    total_cost = sum(base_total_cost * (1.5 ** lvl) for lvl in range(level))
    points = total_cost / CULTURE_POINT_DIVISOR

    if building_type.name == "قصر":
        points *= 1.5

    return points


def calculate_player_culture_points_per_hour(player):
    villages = Village.objects.filter(player=player, is_farm_village=False)
    buildings = VillageBuilding.objects.filter(
        village__in=villages, level__gt=0
    ).select_related('building_type')
    return sum(calculate_building_culture_points(b.building_type, b.level) for b in buildings)


def required_culture_points_for_nth_village(n):
    """امتیاز فرهنگی تجمیعی لازم برای تاسیس n اُمین دهکده (n=2 یعنی دومین دهکده)."""
    if n <= 1:
        return 0
    return 200 * ((n - 1) ** 2)


def calculate_player_total_population(player):
    """جمعیت کل بازیکن روی همه‌ی دهکده‌هایش (برای محاسبه‌ی بونوس روحیه)."""
    buildings = VillageBuilding.objects.filter(
        village__player=player, village__is_farm_village=False, level__gt=0
    ).select_related('building_type')
    return int(round(sum(calculate_building_population(b.building_type, b.level) for b in buildings)))


def calculate_morale_multiplier(attacker_population, defender_population):
    """اگر جمعیت مهاجم خیلی بیشتر از مدافع باشد، مدافع بونوس دفاعی (روحیه) می‌گیرد
    تا حساب‌های بزرگ نتوانند بی‌محدودیت حساب‌های کوچک را فارم کنند."""
    if attacker_population <= 0 or defender_population <= 0:
        return 1.0
    if attacker_population <= defender_population:
        return 1.0
    ratio = defender_population / attacker_population
    multiplier = 1 / (0.2 + 0.8 * ratio)
    return round(min(3.0, max(1.0, multiplier)), 3)


STORAGE_LEVEL_MULTIPLIER = 1.2  # هر سطح، ظرفیت را ۲۰٪ افزایش می‌دهد


def calculate_storage_capacity(base_capacity, level):
    if level <= 0:
        return base_capacity
    return int(base_capacity * (STORAGE_LEVEL_MULTIPLIER ** level))


def recalculate_village_capacities(village):
    """بعد از هر ارتقای انبار/سیلوی غله باید صدا زده شود تا ظرفیت واقعی به‌روز شود."""
    server_settings = ServerSetting.objects.filter(is_active=True).first()
    base_storage = server_settings.starting_max_storage if server_settings else 800
    base_granary = server_settings.starting_max_granary if server_settings else 800

    warehouse = VillageBuilding.objects.filter(village=village, building_type__name="انبار").first()
    granary = VillageBuilding.objects.filter(village=village, building_type__name="سیلوی غله").first()

    village.max_storage = calculate_storage_capacity(base_storage, warehouse.level if warehouse else 0)
    village.max_granary = calculate_storage_capacity(base_granary, granary.level if granary else 0)
    village.save(update_fields=['max_storage', 'max_granary'])


def _get_gold_resource_bonus_multipliers(village):
    """✅ جدید: بونوس‌های طلایی فعال (به تفکیک منبع، یا حالت 'all') را می‌خواند."""
    from django.core.cache import cache
    multipliers = {'wood': 1.0, 'clay': 1.0, 'iron': 1.0, 'crop': 1.0}
    if cache.get(f"resource_bonus_{village.id}_all"):
        for key in multipliers:
            multipliers[key] += 0.25
        return multipliers
    for key in ('wood', 'clay', 'iron', 'crop'):
        if cache.get(f"resource_bonus_{village.id}_{key}"):
            multipliers[key] += 0.25
    return multipliers


def get_effective_production_rates(village):
    settings = ServerSetting.objects.filter(is_active=True).first()
    speed = settings.server_speed if settings else 1

    oasis_mult = _get_oasis_bonus_multipliers(village)
    gold_mult = _get_gold_resource_bonus_multipliers(village)
    mill_mult = _get_mill_multiplier(village)
    hero_resource_type, hero_rate_per_hour = _get_hero_resource_bonus(village)

    def hero_bonus(key):
        return hero_rate_per_hour if hero_resource_type == key else 0

    return {
        'wood': speed * (village.prod_wood * oasis_mult['wood'] * gold_mult['wood'] + hero_bonus('wood')),
        'clay': speed * (village.prod_clay * oasis_mult['clay'] * gold_mult['clay'] + hero_bonus('clay')),
        'iron': speed * (village.prod_iron * oasis_mult['iron'] * gold_mult['iron'] + hero_bonus('iron')),
        'crop': speed * (village.prod_crop * oasis_mult['crop'] * gold_mult['crop'] * mill_mult + hero_bonus('crop')),
    }


RESOURCE_FIELD_MAX_LEVEL_NON_CAPITAL = 10


def get_effective_max_level(village, building_type):
    """
    سقف واقعی سطح یک ساختمان مشخص، برای یک دهکده‌ی مشخص.
    طبق قوانین تراوین اصلی: مزارع منابع (دسته RESOURCE) در دهکده‌های غیر
    پایتخت فقط تا سطح ۱۰ ارتقا می‌یابند؛ در پایتخت و برای سایر ساختمان‌ها
    (در همه‌ی دهکده‌ها)، سقف همان building_type.max_level (پیش‌فرض ۲۰) است.
    """
    if building_type.category == 'RESOURCE' and not village.is_capital:
        return min(building_type.max_level, RESOURCE_FIELD_MAX_LEVEL_NON_CAPITAL)
    return building_type.max_level


MAIN_BUILDING_SPEED_BONUS_PERCENT_PER_LEVEL = 5
MAIN_BUILDING_MAX_SPEED_BONUS_PERCENT = 70


def get_main_building_speed_multiplier(village):
    main_building = VillageBuilding.objects.filter(
        village=village, building_type__name="ساختمان اصلی"
    ).first()
    level = main_building.level if main_building else 0
    reduction_percent = min(
        MAIN_BUILDING_MAX_SPEED_BONUS_PERCENT,
        level * MAIN_BUILDING_SPEED_BONUS_PERCENT_PER_LEVEL,
    )
    return 1 - (reduction_percent / 100)


EMBASSY_BASE_ALLIANCE_CAPACITY = 3  # ✅ جدید: حداقل ظرفیت پایه به‌ازای هر عضو، حتی بدون سفارت‌خانه
EMBASSY_CAPACITY_PER_LEVEL = 3      # هر سطح سفارت‌خانه‌ی هر عضو، ظرفیت اتحاد را به این میزان افزایش می‌دهد


def get_player_best_embassy_level(player):
    """✅ جدید: بالاترین سطح سفارت‌خانه‌ی این بازیکن در بین همه‌ی دهکده‌هایش."""
    return VillageBuilding.objects.filter(
        village__player=player, building_type__name="سفارتخانه"
    ).order_by('-level').values_list('level', flat=True).first() or 0


def get_alliance_capacity(alliance):
    """
    ✅ جدید: ظرفیت کل اتحاد بر اساس مجموع سطح سفارت‌خانه‌ی همه‌ی اعضای فعلی.
    قبلا سفارت‌خانه هیچ اثری روی ظرفیت اتحاد نداشت و هر تعداد عضو بدون
    محدودیت می‌توانستند بپیوندند.
    """
    from .models import AllianceMember
    members = AllianceMember.objects.filter(alliance=alliance).select_related('player')
    total = 0
    for m in members:
        total += EMBASSY_BASE_ALLIANCE_CAPACITY + (get_player_best_embassy_level(m.player) * EMBASSY_CAPACITY_PER_LEVEL)
    return total