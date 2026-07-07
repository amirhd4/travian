from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from travian_core.celery import app
from apps.game_engine.models import Village, GameLog, VillageBuilding
from .models import TroopMovement, VillageTroop, TroopType, Hero, PlayerHeroItem, VillageAnimal, Adventure
from .engine import calculate_combat, calculate_catapult_damage
from .hero_utils import resolve_adventure, generate_adventures_for_player

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


def _hero_attack_bonus(player):
    """امتیاز حمله‌ای که قهرمانِ زندهٔ بازیکن به ستون مهاجم اضافه می‌کند."""
    try:
        hero = Hero.objects.get(player=player, is_alive=True)
    except Hero.DoesNotExist:
        return 0
    equipped_bonus = sum(
        inv.item.attack_bonus
        for inv in PlayerHeroItem.objects.filter(hero=hero, is_equipped=True).select_related('item')
    )
    return hero.level * 50 + equipped_bonus


def _hero_defense_bonus(player, village):
    """امتیاز دفاعی قهرمان، فقط وقتی که قهرمان دقیقا در همین دهکده مستقر است."""
    try:
        hero = Hero.objects.get(player=player, is_alive=True, home_village=village)
    except Hero.DoesNotExist:
        return 0
    return hero.level * 40


def _animal_defense_points(village):
    """امتیاز دفاعی حیوانات نگهبانی که بازیکن با طلا برای این دهکده خریده است."""
    animals = VillageAnimal.objects.filter(village=village).select_related('animal')
    inf = sum(va.count * va.animal.defense_infantry for va in animals)
    cav = sum(va.count * va.animal.defense_cavalry for va in animals)
    return inf, cav


def _grant_hero_experience(player, amount):
    """تجربه ساده بعد از نبرد؛ هر ۱۰۰ تجربه یک سطح."""
    hero, _ = Hero.objects.get_or_create(player=player)
    if not hero.is_alive:
        return
    hero.experience += amount
    hero.level = 1 + hero.experience // 100
    hero.save()


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
        elif movement.movement_type == 'SCOUT':
            return _resolve_scout(movement)
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


def _resolve_scout(movement):
    """
    ماموریت شناسایی. قبل از این تابع، سیستم جاسوسی اصلا وجود نداشت.

    منطق ساده‌شده: اگر جمع جاسوس‌های دفاعی مستقر در دهکده هدف حداقل دو
    برابر تعداد جاسوس‌های اعزامی باشد، ماموریت شکست می‌خورد و جاسوسان
    مهاجم از بین می‌روند. در غیر این صورت، گزارش کاملی از منابع و نیروهای
    دهکده هدف تهیه و برای مهاجم ارسال می‌شود و جاسوسان زنده به خانه برمی‌گردند.
    """
    source = movement.source_village
    target = Village.objects.select_for_update().get(id=movement.target_village_id)

    scout_qty_sent = sum(int(q) for q in movement.troops_payload.values())

    defending_scouts = VillageTroop.objects.filter(
        village=target, troop_type__is_scout=True
    ).aggregate(total=Sum('count'))['total'] or 0

    caught = defending_scouts >= scout_qty_sent * 2

    movement.is_completed = True
    movement.save()

    if caught:
        description = (
            f"ماموریت شناسایی به دهکده {target.name} شکست خورد؛ "
            f"جاسوسان شما توسط پدافند دشمن شکار شدند."
        )
        GameLog.objects.create(village=source, log_type='COMBAT', description=description)
        _notify_player(source.player_id, "SCOUT_RESULT", {"message": description, "success": False})
        return description

    target_troops = list(VillageTroop.objects.filter(village=target).select_related('troop_type'))
    troops_report = {vt.troop_type.name: vt.count for vt in target_troops if vt.count > 0}

    report_lines = [
        f"گزارش شناسایی از دهکده {target.name} ({target.x_coord}|{target.y_coord}):",
        f"منابع: چوب {int(target.wood)} | خشت {int(target.clay)} | آهن {int(target.iron)} | گندم {int(target.crop)}",
        "نیروهای مستقر: " + (
            ", ".join(f"{name}: {count}" for name, count in troops_report.items())
            if troops_report else "بدون نیرو"
        ),
    ]
    description = "\n".join(report_lines)

    GameLog.objects.create(village=source, log_type='COMBAT', description=description)
    _notify_player(source.player_id, "SCOUT_RESULT", {"message": description, "success": True})

    # بازگشت جاسوسان زنده به دهکده مبدا
    travel_duration = movement.arrival_time - movement.start_time
    return_arrival = timezone.now() + travel_duration
    return_movement = TroopMovement.objects.create(
        source_village=target,
        target_village=source,
        movement_type='RETURN',
        troops_payload=movement.troops_payload,
        arrival_time=return_arrival,
    )
    transaction.on_commit(lambda: resolve_combat_movement.apply_async(
        args=[return_movement.id], eta=return_arrival
    ))

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

    # امتیاز قهرمان مهاجم (در صورت زنده بودن)
    attacker_points_attack += _hero_attack_bonus(source.player)

    attacker_data = {"points_attack": attacker_points_attack}

    # ------- قدرت مدافع بر اساس نیروهای واقعی مستقر در دهکده مقصد -------
    defender_village_troops = list(
        VillageTroop.objects.select_for_update().filter(village=target).select_related('troop_type')
    )
    defender_points_inf = sum(vt.count * vt.troop_type.defense_infantry for vt in defender_village_troops)
    defender_points_cav = sum(vt.count * vt.troop_type.defense_cavalry for vt in defender_village_troops)

    # امتیاز دفاعی حیوانات نگهبان خریداری‌شده با طلا
    animal_inf, animal_cav = _animal_defense_points(target)
    defender_points_inf += animal_inf
    defender_points_cav += animal_cav

    # امتیاز دفاعی قهرمان مدافع (فقط اگر قهرمان دقیقا در این دهکده مستقر باشد)
    hero_defense = _hero_defense_bonus(target.player, target)
    defender_points_inf += hero_defense
    defender_points_cav += hero_defense

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

    # تجربه ساده برای قهرمان‌های دو طرف (برنده بیشتر، بازنده کمتر)
    _grant_hero_experience(source.player, 10 if victory == "attacker" else 3)
    _grant_hero_experience(target.player, 10 if victory == "defender" else 3)

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


@app.task
def resolve_hero_adventure(hero_id, adventure_id):
    """نتیجه‌گیری ماجراجویی قهرمان در لحظه‌ی بازگشت (زمان‌بندی‌شده از StartAdventureView)."""
    try:
        hero = Hero.objects.select_for_update().get(id=hero_id)
        adventure = Adventure.objects.get(id=adventure_id, is_completed=False)
    except (Hero.DoesNotExist, Adventure.DoesNotExist):
        return "ماجراجویی یافت نشد یا قبلا پردازش شده است."

    with transaction.atomic():
        result = resolve_adventure(hero, adventure)

    if result["success"]:
        message = f"قهرمان شما با موفقیت از ماجراجویی بازگشت و {result['xp_gained']} تجربه کسب کرد."
        if result["found_item"]:
            message += f" آیتم «{result['found_item']}» پیدا شد! 🎁"
    else:
        message = f"قهرمان شما در ماجراجویی شکست خورد و {result['damage_taken']} آسیب دید."
    if result.get("hero_died"):
        message += " ⚠️ قهرمان از پای درآمد و نیاز به استراحت طولانی برای احیا دارد."

    _notify_player(hero.player_id, "ADVENTURE_RESULT", {"message": message, **result})
    return message


@app.task
def generate_adventures_for_all_players():
    """هر چند ساعت یک‌بار (طبق CELERY_BEAT_SCHEDULE) برای هر بازیکن ماجراجویی جدید می‌سازد."""
    from apps.authentication.models import Player
    for player in Player.objects.filter(is_active=True).exclude(username="Natars"):
        hero = Hero.objects.filter(player=player).select_related('home_village').first()
        if hero and hero.home_village:
            generate_adventures_for_player(player, hero.home_village, count=2)