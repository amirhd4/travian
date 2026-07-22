from travian_core.celery import app

from datetime import datetime, timezone
from django.utils import timezone as dj_timezone

from apps.game_engine.models import ServerSetting
from .logic import spawn_natar_tribe, spawn_ww_building_plans
from ..authentication.models import Player


@app.task
def check_server_timeline():
    try:
        active_server = ServerSetting.objects.get(is_active=True)
    except ServerSetting.DoesNotExist:
        return
    if active_server.is_finished:
        return

    age_days = (dj_timezone.now() - active_server.start_date).days

    if age_days >= (active_server.duration_days * 0.5) and not Player.objects.filter(username="Natars").exists():
        spawn_natar_tribe()

    if (age_days >= (active_server.duration_days * (active_server.artifact_release_duration_percent / 100))
            and not active_server.artifacts_unlocked):
        active_server.artifacts_unlocked = True
        active_server.save()

    if (age_days >= (active_server.duration_days * (active_server.catapult_release_duration_percent / 100))
            and not active_server.catapult_unlocked):
        active_server.catapult_unlocked = True
        active_server.save()

        from apps.game_engine.artifacts import spawn_artifact_sites
        spawn_artifact_sites()

    if age_days >= (active_server.duration_days * 0.7) and not active_server.ww_unlocked:
        active_server.ww_unlocked = True
        active_server.save()
        spawn_ww_building_plans()

    _check_for_winner(active_server)


def _check_for_winner(active_server):
    """
    بررسی می‌کند آیا شگفتی جهانی به سطح ۱۰۰ رسیده است؛ اگر بله، برنده را
    اعلام کرده و سرور را می‌بندد. قبل از این تابع، حتی اگر یک بازیکن WW
    را به سطح ۱۰۰ می‌رساند، هیچ اتفاق رسمی‌ای نمی‌افتاد و سرور بی‌نهایت
    ادامه پیدا می‌کرد.
    """
    from apps.world_wonder.models import WorldWonder
    from apps.game_engine.models import AllianceMember, PlayerCombatStats
    from apps.authentication.models import Player
    from apps.game_engine.utils import calculate_player_total_population

    winning_ww = WorldWonder.objects.filter(level__gte=100).order_by('last_upgraded').first()
    if not winning_ww:
        return

    winner_player = winning_ww.village.player
    membership = AllianceMember.objects.filter(player=winner_player).select_related('alliance').first()

    active_server.is_finished = True
    active_server.finished_at = datetime.now(timezone.utc)
    active_server.winner_player = winner_player
    active_server.winner_alliance = membership.alliance if membership else None

    # محاسبه عناوین پایان بازی
    _compute_endgame_titles(active_server)

    active_server.save()

    _broadcast_server_end(winning_ww, winner_player, membership.alliance if membership else None)


def _compute_endgame_titles(active_server):
    """محاسبه و ذخیره عناوین پایان بازی: بزرگترین امپراتوری، برترین مهاجم، برترین مدافع."""
    from apps.authentication.models import Player
    from apps.game_engine.models import PlayerCombatStats
    from apps.game_engine.utils import calculate_player_total_population

    players = Player.objects.filter(is_active=True).exclude(username__in=["Natars", "Farms"])

    # بزرگترین امپراتوری (بیشترین جمعیت)
    max_population = 0
    greatest_empire = None
    for player in players:
        pop = calculate_player_total_population(player)
        if pop > max_population:
            max_population = pop
            greatest_empire = player
    active_server.greatest_empire_player = greatest_empire

    # برترین مهاجم
    top_attacker = PlayerCombatStats.objects.filter(
        player__in=players
    ).order_by('-attacker_kill_points').first()
    active_server.top_attacker_player = top_attacker.player if top_attacker else None

    # برترین مدافع
    top_defender = PlayerCombatStats.objects.filter(
        player__in=players
    ).order_by('-defender_kill_points').first()
    active_server.top_defender_player = top_defender.player if top_defender else None


def _broadcast_server_end(winning_ww, winner_player, winner_alliance):
    """اعلان زنده (وب‌سوکت) + ثبت پیام درون‌بازی برای همه‌ی بازیکنان."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from apps.authentication.models import Player
    from apps.game_engine.models import Message, ServerSetting

    alliance_text = f" (اتحاد {winner_alliance.tag})" if winner_alliance else ""
    message_text = (
        f"🏆 بازی به پایان رسید! بازیکن {winner_player.username}{alliance_text} با رساندن شگفتی جهان "
        f"در دهکده «{winning_ww.village.name}» به سطح {winning_ww.level}، برنده‌ی این سرور شد."
    )

    # اضافه کردن عناوین پایان بازی
    server_settings = ServerSetting.objects.filter(is_active=True).first()
    if server_settings:
        titles = []
        if server_settings.greatest_empire_player:
            titles.append(f"👑 بزرگترین امپراتوری: {server_settings.greatest_empire_player.username}")
        if server_settings.top_attacker_player:
            titles.append(f"⚔️ برترین مهاجم: {server_settings.top_attacker_player.username}")
        if server_settings.top_defender_player:
            titles.append(f"🛡️ برترین مدافع: {server_settings.top_defender_player.username}")
        if titles:
            message_text += "\n\n" + "\n".join(titles)

    players = list(Player.objects.filter(is_active=True).exclude(username="Natars"))

    Message.objects.bulk_create([
        Message(sender=winner_player, receiver=p, subject="🏆 پایان بازی", body=message_text)
        for p in players if p.id != winner_player.id
    ])

    channel_layer = get_channel_layer()
    if channel_layer:
        for p in players:
            async_to_sync(channel_layer.group_send)(
                f"player_{p.id}",
                {
                    "type": "send_game_update",
                    "update_type": "SERVER_FINISHED",
                    "payload": {"message": message_text, "winner": winner_player.username},
                }
            )

@app.task
def regen_natar_village_loyalty():
    from apps.game_engine.models import Village
    natar_villages = Village.objects.filter(player__username="Natars", loyalty__lt=100)
    for village in natar_villages:
        village.loyalty = min(100, village.loyalty + 10)
        village.save(update_fields=['loyalty'])