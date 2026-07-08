from django.core.exceptions import ValidationError
from django.utils import timezone
import datetime
from apps.authentication.models import Player
from apps.game_engine.models import Village, AllianceMember
from apps.combat.models import TroopMovement
from .models import WWBuildingPlan


def trigger_natar_attack_wave(target_village, ww_level):
    try:
        natar_player = Player.objects.get(username="Natars")
        natar_capital = Village.objects.get(player=natar_player, name="Natar Capital")
    except (Player.DoesNotExist, Village.DoesNotExist):
        return

    arrival = timezone.now() + datetime.timedelta(hours=1)

    payload = {
        "natar_infantry": ww_level * 1000,
        "natar_cavalry": ww_level * 500,
        "natar_catapult": ww_level * 50
    }

    TroopMovement.objects.create(
        source_village=natar_capital,
        target_village=target_village,
        movement_type='ATTACK',
        troops_payload=payload,
        arrival_time=arrival
    )
    print(f"Natar attack triggered for WW level {ww_level} on {target_village.name}")


def validate_ww_upgrade(player, village, current_level):
    """
    بررسی پیش‌نیاز ارتقای شگفتی جهان: باید حداقل یک نقشه‌ی ساخت در یک
    دهکده با خزانه‌داری سطح ۱۰+ داشته باشی. قبل از این تابع، این بررسی
    فقط یک فیلد بولین (has_ww_plan) بدون هیچ ارتباطی با واقعیت بازی بود.
    """
    has_valid_plan = WWBuildingPlan.objects.filter(
        holder_village__player=player,
        holder_village__buildings__building_type__name="خزانه‌داری",
        holder_village__buildings__level__gte=10,
    ).exists()

    if not has_valid_plan:
        raise ValidationError(
            "برای ارتقای شگفتی جهان، باید نقشه‌ی ساخت را در یک دهکده با خزانه‌داری سطح ۱۰ یا بالاتر نگه دارید."
        )

    if current_level >= 50:
        membership = AllianceMember.objects.filter(player=player).first()
        if not membership:
            raise ValidationError("برای ارتقای بالای ۵۰، عضویت در یک اتحاد الزامی است.")

        alliance_member_ids = AllianceMember.objects.filter(
            alliance=membership.alliance
        ).exclude(player=player).values_list('player_id', flat=True)

        has_second_plan = WWBuildingPlan.objects.filter(
            holder_village__player_id__in=alliance_member_ids
        ).exists()

        if not has_second_plan:
            raise ValidationError("برای ارتقای بالای ۵۰، داشتن نقشه‌ی دوم در اتحاد الزامی است.")

    next_level = current_level + 1
    if next_level % 5 == 0 or next_level >= 95:
        trigger_natar_attack_wave(village, next_level)