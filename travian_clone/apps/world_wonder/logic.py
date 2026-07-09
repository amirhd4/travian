import random
from apps.game_engine.models import Village
from apps.game_engine.services import _find_free_coordinates, _create_resource_fields_only
from apps.authentication.models import Player
from apps.combat.models import TroopType, VillageTroop

NATAR_WW_SITE_COUNT = 12
NATAR_PLAN_GUARD_COUNT = 6


def spawn_natar_tribe():
    natar_user, created = Player.objects.get_or_create(username="Natars", email="natars@game.com")
    Village.objects.get_or_create(
        player=natar_user,
        name="Natar Capital",
        x_coord=0,
        y_coord=0
    )


def spawn_ww_building_plans():
    """
    قبل از این تابع، «باز شدن شگفتی جهان» فقط یعنی has_ww_plan روی ۵۰
    بازیکن برتر (بر اساس طلا) True می‌شد - که هیچ ربطی به مکانیک واقعی
    نقشه‌ی ساخت تراوین (حمله به دهکده‌ی نگهبان، منجنیق، حضور قهرمان،
    خزانه‌داری سطح ۱۰) نداشت.

    این نسخه، ۱۲ «دهکده‌ی ویرانه» (قابل تسخیر با سناتور؛ بعد از تسخیر
    محل ساخت شگفتی جهان می‌شود) و ۴ «دهکده‌ی نقشه‌ی ساخت» (غیرقابل تسخیر،
    فقط قابل غارت برای گرفتن نقشه) برای ناتارها می‌سازد.
    """
    natar_player = Player.objects.get(username="Natars")

    for _ in range(NATAR_WW_SITE_COUNT):
        x, y = _find_free_coordinates()
        village = Village.objects.create(
            player=natar_player,
            name=f"دهکده ویرانه ({x}|{y})",
            x_coord=x, y_coord=y,
            is_capital=False,
            is_natar_ww_site=True,
            loyalty=100,
            wood=750.0, clay=750.0, iron=750.0, crop=750.0,
            prod_wood=20, prod_clay=20, prod_iron=20, prod_crop=20,
            max_storage=800, max_granary=800,
        )
        _create_resource_fields_only(village)
        _spawn_natar_defense(village, strength=random.randint(200, 500))

    for _ in range(NATAR_PLAN_GUARD_COUNT):
        x, y = _find_free_coordinates()
        village = Village.objects.create(
            player=natar_player,
            name=f"نقشه ساخت ({x}|{y})",
            x_coord=x, y_coord=y,
            is_capital=False,
            is_natar_plan_guard=True,
            loyalty=100,
            wood=0, clay=0, iron=0, crop=0,
            prod_wood=0, prod_clay=0, prod_iron=0, prod_crop=0,
            max_storage=0, max_granary=0,
        )
        _spawn_natar_defense(village, strength=random.randint(800, 1500))
        village.ww_plans.create()


def _spawn_natar_defense(village, strength):
    natar_infantry, _ = TroopType.objects.get_or_create(
        name="نگهبان ناتار", tribe="NATAR",
        defaults={
            "attack_power": 40, "defense_infantry": 50, "defense_cavalry": 50,
            "speed": 0, "carry_capacity": 0,
            "wood_cost": 0, "clay_cost": 0, "iron_cost": 0, "crop_cost": 0,
            "crop_upkeep": 0, "base_train_time": 0,
        }
    )
    VillageTroop.objects.create(village=village, troop_type=natar_infantry, count=strength)