from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from travian_core.celery import app
from apps.game_engine.models import Village, GameLog, VillageBuilding
from .models import TroopMovement, VillageTroop, TroopType
from .engine import calculate_combat, calculate_catapult_damage


def _notify_player(player_id, update_type, payload):
    """ارسال آپدیت زنده به کاربر از طریق وب‌سوکت (در صورت وجود channel layer)."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"player_{player_id}",
        {
            "type": "send_game_update",
            "update_type": update_type,
            "payload": payload,
        }
    )


@app.task
def resolve_combat_movement(movement_id):
    """
    نقطه ورودی اصلی برای «حل کردن» یک حرکت نظامی وقتی زمان رسیدنش فرا می‌رسد.

    قبل از این تابع، هیچ جایی resolve_combat_movement را صدا نمی‌زد؛
    SendTroopsView فقط یک TroopMovement می‌ساخت و همان‌جا رهایش می‌کرد،
    پس هیچ حمله‌ای هرگز به نتیجه نمی‌رسید. حالا این تسک از views.py با
    apply_async(eta=arrival_time) زمان‌بندی می‌شود و خودش هم برای نیروهای
    بازمانده یک حرکت RETURN جدید می‌سازد و زمان‌بندی می‌کند.
    """
    with transaction.atomic():
        try:
            movement = TroopMovement.objects.select_for_update().get(
                id=movement_id, is_completed=False
            )
        except TroopMovement.DoesNotExist:
            # یا قبلا پردازش شده (idempotency) یا پاک شده؛ در هر دو حالت کاری نیست
            return "این حرکت نظامی یافت نشد یا قبلا پردازش شده است."

        if movement.movement_type == 'REINFORCEMENT':
            return _resolve_reinforcement(movement)
        elif movement.movement_type == 'RETURN':
            return _resolve_return(movement)
        else:
            return _resolve_attack_or_raid(movement)


def _resolve_reinforcement(movement):
    target = Village.objects.select_for_update().get(id=movement.target_village_id)

    for troop_id_str, qty in movement.troops_payload.items():
        qty = int(qty)
        if qty <= 0:
            continue
        try:
            troop_type = TroopType.objects.get(id=int(troop_id_str))
        except TroopType.DoesNotExist:
            continue
        village_troop, _ = VillageTroop.objects.select_for_update().get_or_create(
            village=target, troop_type=troop_type, defaults={'count': 0}
        )
        village_troop.count += qty
        village_troop.save()

    movement.is_completed = True
    movement.save()

    description = (
        f"نیروهای پشتیبان از دهکده {movement.source_village.name} "
        f"به دهکده {target.name} رسیدند."
    )
    GameLog.objects.create(village=target, log_type='COMBAT', description=description)
    _notify_player(target.player_id, "REINFORCEMENT_ARRIVED", {
        "message": description, "village_id": target.id
    })
    return description


def _resolve_return(movement):
    """بازگشت بازماندگان حمله/غارت (و غنائم آن‌ها) به دهکده مبدا اصلی."""
    home_village = Village.objects.select_for_update().get(id=movement.target_village_id)

    for troop_id_str, qty in movement.troops_payload.items():
        qty = int(qty)
        if qty <= 0:
            continue
        try:
            troop_type = TroopType.objects.get(id=int(troop_id_str))
        except TroopType.DoesNotExist:
            continue
        village_troop, _ = VillageTroop.objects.select_for_update().get_or_create(
            village=home_village, troop_type=troop_type, defaults={'count': 0}
        )
        village_troop.count += qty
        village_troop.save()

    loot = movement.loot_payload or {}
    if any(loot.values()):
        home_village.wood += int(loot.get('wood', 0))
        home_village.clay += int(loot.get('clay', 0))
        home_village.iron += int(loot.get('iron', 0))
        home_village.crop += int(loot.get('crop', 0))
        home_village.save()

    movement.is_completed = True
    movement.save()

    description = f"نیروهای اعزامی به سلامت به دهکده {home_village.name} بازگشتند."
    if any(loot.values()):
        description += f" غنائم به‌دست‌آمده: {loot}"

    GameLog.objects.create(village=home_village, log_type='COMBAT', description=description)
    _notify_player(home_village.player_id, "TROOPS_RETURNED", {
        "message": description, "village_id": home_village.id
    })
    return description


def _resolve_attack_or_raid(movement):
    source = movement.source_village
    target = Village.objects.select_for_update().get(id=movement.target_village_id)

    # ------- قدرت مهاجم بر اساس اطلاعات واقعی TroopType از دیتابیس -------
    troop_type_cache = {
        t.id: t for t in TroopType.objects.filter(
            id__in=[int(k) for k in movement.troops_payload.keys()]
        )
    }

    attacker_points_attack = 0
    attacker_survivors = {}
    catapult_units_sent = 0

    for troop_id_str, qty in movement.troops_payload.items():
        qty = int(qty)
        if qty <= 0:
            continue
        troop_type = troop_type_cache.get(int(troop_id_str))
        if troop_type is None:
            continue
        attacker_points_attack += qty * troop_type.attack_power
        attacker_survivors[troop_type.id] = qty
        if troop_type.is_siege_weapon:
            catapult_units_sent += qty

    attacker_data = {"points_attack": attacker_points_attack}

    # ------- قدرت مدافع بر اساس نیروهای واقعی مستقر در دهکده مقصد -------
    defender_village_troops = list(
        VillageTroop.objects.select_for_update().filter(village=target).select_related('troop_type')
    )
    defender_points_inf = sum(vt.count * vt.troop_type.defense_infantry for vt in defender_village_troops)
    defender_points_cav = sum(vt.count * vt.troop_type.defense_cavalry for vt in defender_village_troops)

    defender_data = {
        "points_def_infantry": defender_points_inf,
        "points_def_cavalry": defender_points_cav,
    }

    # دیوار دفاعی دهکده مقصد (در صورت وجود) بر اساس فلگ عمومی، نه نام هاردکد شده
    wall_building = VillageBuilding.objects.select_for_update().filter(
        village=target, building_type__provides_wall_defense=True
    ).first()
    wall_level = wall_building.level if wall_building else 0

    combat_result = calculate_combat(
        attacker_data,
        defender_data,
        wall_level=wall_level,
        catapult_target=(catapult_units_sent > 0),
        catapult_count=catapult_units_sent,
    )

    attacker_loss_ratio = combat_result["attacker_loss_percent"] / 100
    defender_loss_ratio = combat_result["defender_loss_percent"] / 100
    victory = combat_result["victory"]

    # ------- اعمال تلفات مهاجم و محاسبه بازماندگان -------
    for troop_id in list(attacker_survivors.keys()):
        qty = attacker_survivors[troop_id]
        remaining = qty - int(round(qty * attacker_loss_ratio))
        attacker_survivors[troop_id] = max(0, remaining)

    # ------- اعمال تلفات مدافع روی رکوردهای واقعی VillageTroop -------
    for vt in defender_village_troops:
        remaining = vt.count - int(round(vt.count * defender_loss_ratio))
        vt.count = max(0, remaining)
        vt.save()

    # ------- تخریب دیوار در صورت پیروزی مهاجم با منجنیق -------
    if victory == "attacker" and wall_building and catapult_units_sent > 0:
        wall_building.level = calculate_catapult_damage(catapult_units_sent, wall_building.level)
        wall_building.is_upgrading = False
        wall_building.save()

    # ------- غارت منابع در صورت پیروزی مهاجم در حرکت از نوع RAID -------
    loot = {"wood": 0, "clay": 0, "iron": 0, "crop": 0}
    if movement.movement_type == "RAID" and victory == "attacker":
        total_capacity = sum(
            qty * troop_type_cache[tid].carry_capacity
            for tid, qty in attacker_survivors.items() if tid in troop_type_cache
        )
        available = {
            "wood": target.wood, "clay": target.clay,
            "iron": target.iron, "crop": target.crop,
        }
        total_available = sum(available.values())
        if total_available > 0 and total_capacity > 0:
            take_total = min(total_capacity, total_available)
            for res_name, res_amount in available.items():
                share = (res_amount / total_available) * take_total
                share = min(res_amount, share)
                loot[res_name] = int(share)
                setattr(target, res_name, res_amount - int(share))
            target.save()

    winner_label = "مهاجم" if victory == "attacker" else "مدافع"
    log_msg = (
        f"نبرد در دهکده {target.name} پایان یافت.\n"
        f"برنده: {winner_label}\n"
        f"تلفات مهاجم: {combat_result['attacker_loss_percent']:.1f}%\n"
        f"تلفات مدافع: {combat_result['defender_loss_percent']:.1f}%"
    )
    if wall_building and catapult_units_sent > 0:
        log_msg += f"\nدیوار دهکده به سطح {wall_building.level} تخریب شد."
    if any(loot.values()):
        log_msg += f"\nمنابع غارت شده: {loot}"

    GameLog.objects.create(village=source, log_type='COMBAT', description=log_msg)
    GameLog.objects.create(village=target, log_type='COMBAT', description=log_msg)

    movement.is_completed = True
    movement.save()

    _notify_player(target.player_id, "COMBAT_RESULT", {
        "message": log_msg, "winner": winner_label, "combat": combat_result
    })
    _notify_player(source.player_id, "COMBAT_RESULT", {
        "message": log_msg, "winner": winner_label, "combat": combat_result
    })

    # ------- زمان‌بندی بازگشت بازماندگان (و غنائم) به دهکده مبدا -------
    survivors_payload = {str(tid): qty for tid, qty in attacker_survivors.items() if qty > 0}
    if survivors_payload:
        travel_duration = movement.arrival_time - movement.start_time
        return_arrival = timezone.now() + travel_duration

        return_movement = TroopMovement.objects.create(
            source_village=target,
            target_village=source,
            movement_type='RETURN',
            troops_payload=survivors_payload,
            loot_payload=loot,
            arrival_time=return_arrival,
        )
        transaction.on_commit(lambda: resolve_combat_movement.apply_async(
            args=[return_movement.id], eta=return_arrival
        ))

    return log_msg