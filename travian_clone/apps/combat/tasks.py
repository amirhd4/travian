


from celery import shared_task
from django.db import transaction
from apps.game_engine.models import Village, GameLog
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from travian_clone.apps.combat.engine import calculate_combat
from apps.game_engine.models import Village, GameLog


@shared_task
def resolve_combat_movement(
        source_id,
        target_id,
        movement_type,
        troops_payload,
        catapult_target=None,
        catapult_count=0,
):

    channel_layer = get_channel_layer()

    with transaction.atomic():

        try:

            source = Village.objects.select_for_update().get(id=source_id)
            target = Village.objects.select_for_update().get(id=target_id)

        except Village.DoesNotExist:
            return "خطا: دهکده پیدا نشد."

        troop_stats = {

            "1": {
                "name": "گرزدار",
                "offense": 40,
                "def_infantry": 20,
                "def_cavalry": 5,
            },

            "2": {
                "name": "نیزه‌دار",
                "offense": 10,
                "def_infantry": 35,
                "def_cavalry": 60,
            },

        }

        # --------------------
        # قدرت مهاجم
        # --------------------

        attacker_attack = 0

        for troop_id, qty in troops_payload.items():

            troop = troop_stats[str(troop_id)]

            attacker_attack += qty * troop["offense"]

        attacker_data = {
            "points_attack": attacker_attack
        }

        # --------------------
        # قدرت مدافع
        # --------------------

        village_troops = (
            target.troops
            if isinstance(target.troops, dict)
            else {}
        )

        defender_inf = 0
        defender_cav = 0

        for troop_id, qty in village_troops.items():

            troop = troop_stats.get(str(troop_id))

            if troop is None:
                continue

            defender_inf += int(qty) * troop["def_infantry"]
            defender_cav += int(qty) * troop["def_cavalry"]

        defender_data = {

            "points_def_infantry": defender_inf,
            "points_def_cavalry": defender_cav,

        }

        wall_level = getattr(target, "wall_level", 0)

        combat = calculate_combat(

            attacker_data,
            defender_data,
            wall_level,
            catapult_target,
            catapult_count,

        )

        attacker_loss = combat["attacker_loss_percent"] / 100
        defender_loss = combat["defender_loss_percent"] / 100

        # --------------------
        # اعمال تلفات مدافع
        # --------------------

        new_target_troops = {}

        for troop_id, qty in village_troops.items():

            remain = int(qty) - int(int(qty) * defender_loss)

            new_target_troops[troop_id] = max(0, remain)

        target.troops = new_target_troops

        # --------------------
        # تخریب ساختمان
        # --------------------

        if catapult_target:

            demolished_to = combat["building_demolished_to"]

            if hasattr(target, catapult_target):

                setattr(
                    target,
                    catapult_target,
                    demolished_to
                )

        target.save()

        winner = (
            "مهاجم"
            if combat["victory"] == "attacker"
            else "مدافع"
        )

        log_msg = (
            f"نبرد در دهکده {target.name} پایان یافت.\n"
            f"برنده: {winner}\n"
            f"تلفات مهاجم: {combat['attacker_loss_percent']:.1f}%\n"
            f"تلفات مدافع: {combat['defender_loss_percent']:.1f}%"
        )

        if catapult_target:

            log_msg += (
                f"\n{catapult_target} "
                f"به سطح "
                f"{combat['building_demolished_to']} "
                f"تخریب شد."
            )

        GameLog.objects.create(

            village=source,
            log_type="COMBAT",
            description=log_msg,

        )

        GameLog.objects.create(

            village=target,
            log_type="COMBAT",
            description=log_msg,

        )

        async_to_sync(channel_layer.group_send)(

            f"player_{target.player.id}",

            {

                "type": "send_game_update",

                "update_type": "COMBAT_RESULT",

                "payload": {

                    "winner": winner,
                    "message": log_msg,
                    "combat": combat,

                },

            },

        )

    return log_msg