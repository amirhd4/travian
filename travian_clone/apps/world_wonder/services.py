from django.core.exceptions import ValidationError
from django.utils import timezone
import datetime
from apps.authentication.models import Player
from apps.game_engine.models import Village
from apps.combat.models import TroopMovement


def trigger_natar_attack_wave(target_village, ww_level):
    try:
        natar_player = Player.objects.get(username="Natars")
        natar_capital = Village.objects.get(player=natar_player, name="Natar Capital")
    except (Player.DoesNotExist, Village.DoesNotExist):
        # اگر ناتارها هنوز در نقشه اسپاون نشده‌اند، کاری انجام نده
        return

        # TODOs: better calculate time (here is 1h for example)
        # محاسبه زمان رسیدن حمله (فعلاً برای نمونه ۱ ساعت در نظر گرفته شده)
    arrival = timezone.now() + datetime.timedelta(hours=1)

    # ساخت محموله حمله سنگین بر اساس لول شگفتی جهان
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
    if current_level >= 50:
        if not player.alliance_id:
            raise ValidationError("برای ارتقای بالای ۵۰، عضویت در یک اتحاد الزامی است.")

        has_second_plan = Player.objects.filter(
            alliance_id=player.alliance_id,
            has_ww_plan=True
        ).exclude(id=player.id).exists()

        if not has_second_plan:
            raise ValidationError("برای ارتقای بالای ۵۰، داشتن نقشه دوم در اتحاد الزامی است.")

    next_level = current_level + 1
    if next_level % 5 == 0 or next_level >= 95:
        trigger_natar_attack_wave(village, next_level)