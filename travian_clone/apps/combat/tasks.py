from celery import shared_task
from django.db import transaction
from apps.game_engine.models import Village, GameLog
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


@shared_task
def resolve_combat_movement(source_id, target_id, movement_type, troops_payload):
    channel_layer = get_channel_layer()

    with transaction.atomic():
        try:
            source = Village.objects.select_for_update().get(id=source_id)
            target = Village.objects.select_for_update().get(id=target_id)
        except (Village.DoesNotExist):
            return "خطا: دهکده‌ها یافت نشدند."

        # دیتای قدرت نیروها (۱: گرزدار، ۲: نیزه‌دار)
        troop_stats = {
            '1': {'offense': 40, 'def_infantry': 20, 'name': 'گرزدار'},
            '2': {'offense': 10, 'def_infantry': 35, 'name': 'نیزه‌دار'}
        }

        # ۱. محاسبه کل قدرت هجومی مهاجم
        total_offense = 0
        for t_id, qty in troops_payload.items():
            total_offense += qty * troop_stats[str(t_id)]['offense']

        # ۲. محاسبه کل قدرت دفاعی مدافع
        target_troops = target.troops if isinstance(target.troops, dict) else {'1': 0, '2': 0}
        total_defense = 0
        for t_id, qty in target_troops.items():
            total_defense += int(qty) * troop_stats[str(t_id)]['def_infantry']

        # ۳. فرمول جنگی تراوین (الگوریتم تعیین برنده و تلفات)
        # اگر دفاع قوی‌تر باشد، مهاجم تمام نیروهایش را از دست می‌دهد و مدافع بر اساس نسبت قدرت صدمه می‌بیند.
        if total_defense >= total_offense:
            attacker_losses_ratio = 1.0
            defender_losses_ratio = (total_offense / total_defense) if total_defense > 0 else 0
            winner = "مدافع"
        else:
            defender_losses_ratio = 1.0
            attacker_losses_ratio = (total_defense / total_offense) if total_offense > 0 else 0
            winner = "مهاجم"

        # اعمال تلفات به مدافع
        new_target_troops = {}
        for t_id, qty in target_troops.items():
            remained = int(qty) - int(int(qty) * defender_losses_ratio)
            new_target_troops[t_id] = max(0, remained)
        target.troops = new_target_troops
        target.save()

        # ثبت گزارش برای هر دو بازیکن
        log_msg = f"نبرد بزرگ در دهکده {target.name} رخ داد. پیروز میدان: {winner}."
        GameLog.objects.create(village=source, log_type='COMBAT', description=log_msg)
        GameLog.objects.create(village=target, log_type='COMBAT', description=log_msg)

        # ارسال سیگنال زنده به فرانت‌آند بازیکن از طریق ریل سوکت
        async_to_sync(channel_layer.group_send)(
            f'player_{target.player.id}',
            {
                'type': 'send_game_update',
                'update_type': 'COMBAT_RESULT',
                'payload': {'message': log_msg, 'winner': winner}
            }
        )

    return f"نبرد با موفقیت به نفع {winner} به پایان رسید."