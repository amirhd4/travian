"""
منطق ساخت (spawn) دهکده‌های نگهبانِ کتیبه، و محاسبه‌ی ضریب اثر هر کتیبه
برای یک بازیکن مشخص (که در سراسر ماژول‌های combat استفاده می‌شود).
"""
import random
from django.utils import timezone

from apps.authentication.models import Player
from .models import Village, Artifact
from .services import _find_free_coordinates, _create_resource_fields_only

ARTIFACT_DEFAULTS = [
    {"name": "چشمان عقاب", "effect_type": Artifact.EFFECT_SCOUT_POWER, "multiplier": 10.0},
    {"name": "جنگ‌آموز", "effect_type": Artifact.EFFECT_TRAINING_SPEED, "multiplier": 2.0},
    {"name": "چکمه خدایان", "effect_type": Artifact.EFFECT_MOVEMENT_SPEED, "multiplier": 2.0},
]

ARTIFACT_GUARD_STRENGTH_RANGE = (300, 700)


def spawn_artifact_sites():
    """برای هرکدام از کتیبه‌های پیش‌فرض (اگر قبلا ساخته نشده)، یک دهکده‌ی
    ویرانه‌ی ناتار (قابل تسخیر با سناتور/رئیس، دقیقا مثل دهکده‌های شگفتی
    جهان) می‌سازد و کتیبه را در آن قرار می‌دهد."""
    natar_player, _ = Player.objects.get_or_create(username="Natars", email="natars@game.com")

    for defaults in ARTIFACT_DEFAULTS:
        if Artifact.objects.filter(name=defaults["name"]).exists():
            continue

        x, y = _find_free_coordinates()
        village = Village.objects.create(
            player=natar_player,
            name=f"دهکده کتیبه ({x}|{y})",
            x_coord=x, y_coord=y,
            is_capital=False,
            is_natar_artifact_site=True,
            loyalty=100,
            wood=500.0, clay=500.0, iron=500.0, crop=500.0,
            prod_wood=15, prod_clay=15, prod_iron=15, prod_crop=15,
            max_storage=600, max_granary=600,
        )
        # فقط مزارع منابع (بدون عمارت اقامتی) -> دقیقا مثل دهکده‌های ویرانه‌ی
        # شگفتی جهان، یعنی همیشه بدون نیاز به تخریب چیزی قابل تسخیر است.
        _create_resource_fields_only(village)
        _spawn_artifact_guard(village)

        Artifact.objects.create(
            name=defaults["name"],
            effect_type=defaults["effect_type"],
            multiplier=defaults["multiplier"],
            holder_village=village,
        )


def _spawn_artifact_guard(village):
    from apps.combat.models import TroopType, VillageTroop
    natar_infantry, _ = TroopType.objects.get_or_create(
        name="نگهبان ناتار", tribe="NATAR",
        defaults={
            "attack_power": 40, "defense_infantry": 50, "defense_cavalry": 50,
            "speed": 0, "carry_capacity": 0,
            "wood_cost": 0, "clay_cost": 0, "iron_cost": 0, "crop_cost": 0,
            "crop_upkeep": 0, "base_train_time": 0,
        }
    )
    VillageTroop.objects.create(
        village=village, troop_type=natar_infantry,
        count=random.randint(*ARTIFACT_GUARD_STRENGTH_RANGE),
    )


# ---------------------------------------------------------------------------
# محاسبه‌ی ضریب اثر هر نوع کتیبه برای یک بازیکن مشخص
# ---------------------------------------------------------------------------

def _active_artifacts_for_player(player, effect_type):
    now = timezone.now()

    direct = Artifact.objects.filter(
        holder_village__player=player,
        effect_type=effect_type,
        activates_at__isnull=False,
        activates_at__lte=now,
    )
    if direct.exists():
        return direct

    if not Artifact.objects.filter(effect_type=effect_type, is_alliance_wide=True).exists():
        return Artifact.objects.none()

    from apps.game_engine.models import AllianceMember
    membership = AllianceMember.objects.filter(player=player).select_related('alliance').first()
    if not membership:
        return Artifact.objects.none()

    ally_ids = AllianceMember.objects.filter(alliance=membership.alliance).values_list('player_id', flat=True)
    return Artifact.objects.filter(
        holder_village__player_id__in=ally_ids,
        effect_type=effect_type,
        is_alliance_wide=True,
        activates_at__isnull=False,
        activates_at__lte=now,
    )


def get_artifact_multiplier(player, effect_type):
    """بیشترین ضریب کتیبه‌ی فعال از این نوع که به این بازیکن تعلق می‌گیرد (پیش‌فرض ۱)."""
    best = 1.0
    for artifact in _active_artifacts_for_player(player, effect_type):
        best = max(best, artifact.multiplier)
    return best


def get_scout_power_multiplier(player):
    return get_artifact_multiplier(player, Artifact.EFFECT_SCOUT_POWER)


def get_training_speed_multiplier(player):
    return get_artifact_multiplier(player, Artifact.EFFECT_TRAINING_SPEED)


def get_movement_speed_multiplier(player):
    return get_artifact_multiplier(player, Artifact.EFFECT_MOVEMENT_SPEED)