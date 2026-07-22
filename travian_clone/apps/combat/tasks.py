import datetime
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

import random

from travian_core.celery import app
from apps.game_engine.models import Village, GameLog, VillageBuilding, ServerSetting
from .models import (
    TroopMovement, VillageTroop, TroopType, Hero, PlayerHeroItem, VillageAnimal,
    Adventure, TroopUpgrade, CombatReport, TrappedTroop, HeroItem, HeroAuction,
    TroopEvasionSetting,
)
from .engine import calculate_combat, calculate_demolition_by_defender_casualties, troop_population_value
from .hero_utils import resolve_adventure, generate_adventures_for_player
from apps.game_engine.utils import calculate_player_total_population, calculate_morale_multiplier


CRANNY_PROTECTION_PER_LEVEL = 100  # هر سطح مخفیگاه، این مقدار از هر نوع منبع را از غارت محافظت می‌کند

# ✅ ساختمان‌هایی که هرگز نباید هدف منجنیق قرار بگیرند (دیوار جداگانه توسط
# قوچ مدیریت می‌شود، و مزارع منابع اصلا در تراوین اصلی هدف منجنیق نیستند)
_CATAPULT_EXCLUDED_CATEGORIES = ('RESOURCE', 'WALL')
_CATAPULT_EXCLUDED_BUILDING_NAMES = ('شگفتی جهان',)


def _notify_player(player_id, update_type, payload):
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


def _get_equipped_item_bonus_sum(hero, field_name):  # ✅ جدید
    if not hero:
        return 0.0
    return sum(
        getattr(inv.item, field_name, 0) or 0
        for inv in PlayerHeroItem.objects.filter(hero=hero, is_equipped=True).select_related('item')
    )


def _hero_infantry_attack_percent(player, participating):  # ✅ جدید
    if not participating:
        return 0
    hero = Hero.objects.filter(player=player, is_alive=True).first()
    return _get_equipped_item_bonus_sum(hero, 'infantry_attack_bonus_percent')


def _hero_cavalry_attack_percent(player, participating):  # ✅ جدید
    if not participating:
        return 0
    hero = Hero.objects.filter(player=player, is_alive=True).first()
    return _get_equipped_item_bonus_sum(hero, 'cavalry_attack_bonus_percent')


def _hero_infantry_defense_percent(player, village):  # ✅ جدید
    hero = Hero.objects.filter(
        player=player, is_alive=True, home_village=village,
        is_away=False, is_on_adventure=False, participates_in_defense=True,
    ).first()
    return _get_equipped_item_bonus_sum(hero, 'infantry_defense_bonus_percent')


def _hero_cavalry_defense_percent(player, village):  # ✅ جدید
    hero = Hero.objects.filter(
        player=player, is_alive=True, home_village=village,
        is_away=False, is_on_adventure=False, participates_in_defense=True,
    ).first()
    return _get_equipped_item_bonus_sum(hero, 'cavalry_defense_bonus_percent')


def _hero_attack_bonus(player):
    """امتیاز حمله‌ای که قهرمانِ زندهٔ بازیکن به ستون مهاجم اضافه می‌کند (بونوس ثابت،
    نه درصدی - «قدرت مبارزه» + آیتم‌های تجهیز شده + امتیازهای «قدرت مبارزه»)."""
    try:
        hero = Hero.objects.get(player=player, is_alive=True)
    except Hero.DoesNotExist:
        return 0
    equipped_bonus = sum(
        inv.item.attack_bonus
        for inv in PlayerHeroItem.objects.filter(hero=hero, is_equipped=True).select_related('item')
    )
    return hero.level * 50 + hero.fighting_strength_points * 20 + equipped_bonus


def _hero_defense_bonus(player, village):
    try:
        hero = Hero.objects.get(
            player=player, is_alive=True, home_village=village,
            is_away=False, is_on_adventure=False, participates_in_defense=True,
        )
    except Hero.DoesNotExist:
        return 0
    equipped_defense_bonus = sum(
        inv.item.defense_bonus
        for inv in PlayerHeroItem.objects.filter(hero=hero, is_equipped=True).select_related('item')
    )
    return hero.level * 40 + hero.fighting_strength_points * 20 + equipped_defense_bonus


def _hero_off_bonus_percent(player, participating):
    """✅ جدید: بونوس درصدی «امتیاز تهاجمی» قهرمان روی کل قدرت حمله‌ی ستون، فقط
    وقتی قهرمان واقعا همراه همین حمله اعزام شده باشد."""
    if not participating:
        return 0
    try:
        hero = Hero.objects.get(player=player, is_alive=True)
    except Hero.DoesNotExist:
        return 0
    return hero.off_bonus_points * Hero.OFF_DEF_BONUS_PERCENT_PER_POINT


def _hero_def_bonus_percent(player, village):
    """✅ جدید: بونوس درصدی «امتیاز دفاعی» قهرمان روی کل قدرت دفاع دهکده."""
    try:
        hero = Hero.objects.get(
            player=player, is_alive=True, home_village=village,
            is_away=False, is_on_adventure=False, participates_in_defense=True,
        )
    except Hero.DoesNotExist:
        return 0
    return hero.def_bonus_points * Hero.OFF_DEF_BONUS_PERCENT_PER_POINT


def _animal_defense_points(village):
    animals = VillageAnimal.objects.filter(village=village).select_related('animal')
    inf = sum(va.count * va.animal.defense_infantry for va in animals)
    cav = sum(va.count * va.animal.defense_cavalry for va in animals)
    return inf, cav


def _grant_hero_experience(player, amount):
    hero, _ = Hero.objects.get_or_create(player=player)
    if not hero.is_alive:
        return
    bonus_percent = _get_equipped_item_bonus_sum(hero, 'experience_bonus_percent')  # ✅ جدید
    hero.experience += int(round(amount * (1 + bonus_percent / 100)))  # ✅ به‌روزشده
    hero.level = 1 + hero.experience // 100
    hero.save()


def _increment_combat_stats(player_id, attacker_points=0.0, defender_points=0.0):
    """ثبت امتیاز تجمعی مهاجم/مدافع کلی برای رتبه‌بندی و مدال‌ها."""
    if attacker_points <= 0 and defender_points <= 0:
        return
    from apps.game_engine.models import PlayerCombatStats
    stats, _ = PlayerCombatStats.objects.select_for_update().get_or_create(player_id=player_id)
    if attacker_points > 0:
        stats.attacker_kill_points += attacker_points
    if defender_points > 0:
        stats.defender_kill_points += defender_points
    stats.save()


def _is_still_protected(target_village):
    owner_username = target_village.player.username
    if owner_username in ("Natars", "Farms"):
        return False
    # ✅ FIX: همان قانون لغو محافظت با حمله، اینجا هم باید رعایت شود
    if target_village.player.has_attacked:
        return False
    server_settings = ServerSetting.objects.filter(is_active=True).first()
    protection_days = server_settings.new_player_protection_days if server_settings else 7
    if protection_days <= 0:
        return False
    protection_until = target_village.player.date_joined + datetime.timedelta(days=protection_days)
    return timezone.now() < protection_until


@app.task
def resolve_combat_movement(movement_id):
    with transaction.atomic():
        try:
            movement = TroopMovement.objects.select_for_update().get(
                id=movement_id, is_completed=False
            )
        except TroopMovement.DoesNotExist:
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
    from .models import ReinforcementReport

    source = movement.source_village
    target = Village.objects.select_for_update().get(id=movement.target_village_id)

    troop_type_cache = {
        t.id: t for t in TroopType.objects.filter(
            id__in=[int(k) for k in movement.troops_payload.keys()]
        )
    }
    troops_named = {}
    for troop_id_str, qty in movement.troops_payload.items():
        qty = int(qty)
        if qty <= 0:
            continue
        troop_type = troop_type_cache.get(int(troop_id_str))
        if not troop_type:
            continue
        village_troop, _ = VillageTroop.objects.select_for_update().get_or_create(
            village=target, troop_type=troop_type, defaults={'count': 0}
        )
        village_troop.count += qty
        village_troop.save()
        troops_named[troop_type.name] = troops_named.get(troop_type.name, 0) + qty

    hero_note = ""
    hero_sent = movement.hero_participating
    if hero_sent:
        hero = Hero.objects.select_for_update().filter(player=movement.source_village.player).first()
        if hero:
            hero.is_away = False
            hero.save(update_fields=['is_away'])
            hero_note = " قهرمان همراه این نیروها به دهکده‌ی مقصد رسید و اکنون دوباره در دسترس است."

    movement.is_completed = True
    movement.save()

    description = (
        f"نیروهای پشتیبان از دهکده {source.name} "
        f"به دهکده {target.name} رسیدند." + hero_note
    )
    GameLog.objects.create(village=target, log_type='COMBAT', description=description)

    ReinforcementReport.objects.create(
        sender_player=source.player,
        receiver_player=target.player,
        source_village_name=source.name,
        target_village_name=target.name,
        source_coords=f"{source.x_coord}|{source.y_coord}",
        target_coords=f"{target.x_coord}|{target.y_coord}",
        troops_sent=troops_named,
        hero_sent=hero_sent,
    )

    _notify_player(target.player_id, "REINFORCEMENT_ARRIVED", {
        "message": description, "village_id": target.id
    })
    return description


def _resolve_return(movement):
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
    source = movement.source_village
    target = Village.objects.select_for_update().get(id=movement.target_village_id)

    from apps.game_engine.artifacts import get_scout_power_multiplier
    scout_power_multiplier = get_scout_power_multiplier(source.player)

    scout_qty_sent = sum(int(q) for q in movement.troops_payload.values())
    effective_scout_power = scout_qty_sent * scout_power_multiplier

    defending_scouts = VillageTroop.objects.filter(
        village=target, troop_type__is_scout=True
    ).aggregate(total=Sum('count'))['total'] or 0

    caught = defending_scouts >= effective_scout_power * 2

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
        f"وفاداری: {target.loyalty:.0f}٪",
        f"منابع: چوب {int(target.wood)} | خشت {int(target.clay)} | آهن {int(target.iron)} | گندم {int(target.crop)}",
        "نیروهای مستقر: " + (
            ", ".join(f"{name}: {count}" for name, count in troops_report.items())
            if troops_report else "بدون نیرو"
        ),
    ]
    description = "\n".join(report_lines)

    GameLog.objects.create(village=source, log_type='COMBAT', description=description)
    _notify_player(source.player_id, "SCOUT_RESULT", {"message": description, "success": True})

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


def _apply_hero_combat_damage(hero, is_winner):
    """قهرمان در نبردهای واقعی (نه فقط ماجراجویی) هم آسیب می‌بیند و ممکن است از پای درآید."""
    damage = random.randint(2, 8) if is_winner else random.randint(15, 35)
    hero.health = max(0, hero.health - damage)
    hero.last_health_update = timezone.now()
    if hero.health <= 0:
        hero.is_alive = False
    hero.save()
    return damage, (hero.health <= 0)


def _apply_trapper_capture(target_village, attacker_survivors, troop_type_cache, attacker_player):
    """تله‌ی توتونی: وقتی مدافع پیروز می‌شود، بخشی از بازماندگان مهاجم به‌جای بازگشت
    به خانه، اسیر و در دهکده‌ی مدافع نگه‌داری می‌شوند."""
    if target_village.player.tribe != 'TEUTON':
        return ""

    trapper = VillageBuilding.objects.filter(
        village=target_village, building_type__name="تله", level__gt=0
    ).first()
    if not trapper:
        return ""

    capacity = trapper.level * 15
    already_trapped = TrappedTroop.objects.filter(trapper_village=target_village).aggregate(
        total=Sum('count'))['total'] or 0
    free_capacity = capacity - already_trapped
    if free_capacity <= 0:
        return ""

    total_survivors = sum(attacker_survivors.values())
    if total_survivors <= 0:
        return ""

    remaining_to_capture = min(free_capacity, total_survivors)
    captured_names = []

    for tid in list(attacker_survivors.keys()):
        if remaining_to_capture <= 0:
            break
        qty = attacker_survivors[tid]
        if qty <= 0:
            continue
        take = min(qty, remaining_to_capture)
        attacker_survivors[tid] -= take
        remaining_to_capture -= take

        troop_type = troop_type_cache.get(tid)
        if troop_type:
            TrappedTroop.objects.create(
                trapper_village=target_village, original_owner_player=attacker_player,
                troop_type=troop_type, count=take,
            )
            captured_names.append(f"{take}x {troop_type.name}")

    if captured_names:
        return f"🪤 تله‌ی توتونی {', '.join(captured_names)} از نیروهای مهاجم را اسیر کرد."
    return ""


def _resolve_attack_or_raid(movement):
    source = movement.source_village
    target = Village.objects.select_for_update().get(id=movement.target_village_id)

    original_defender_player = target.player
    original_defender_player_id = target.player_id

    troop_type_cache = {
        t.id: t for t in TroopType.objects.filter(
            id__in=[int(k) for k in movement.troops_payload.keys()]
        )
    }

    # ✅ جدید: نیروهای اعزامی به‌صورت اسم‌دار برای گزارش ساختاری
    attacker_troops_sent_named = {}
    for tid_str, qty in movement.troops_payload.items():
        qty = int(qty)
        if qty <= 0:
            continue
        tt = troop_type_cache.get(int(tid_str))
        if tt:
            attacker_troops_sent_named[tt.name] = attacker_troops_sent_named.get(tt.name, 0) + qty

    attacker_upgrade_levels = {
        u.troop_type_id: u.level
        for u in TroopUpgrade.objects.filter(village=source, troop_type_id__in=troop_type_cache.keys())
    }

    attacker_points_attack = 0
    attacker_survivors = {}
    attacker_sent_counts = {}

    ram_units_sent = 0
    catapult_units_sent = 0
    catapult_attack_power = 0

    # ✅ جدید: بونوس تخصصی آیتم‌های قهرمان (فقط وقتی قهرمان همراه این حمله باشد)
    infantry_attack_percent = _hero_infantry_attack_percent(source.player, movement.hero_participating)
    cavalry_attack_percent = _hero_cavalry_attack_percent(source.player, movement.hero_participating)

    for troop_id_str, qty in movement.troops_payload.items():
        qty = int(qty)
        if qty <= 0:
            continue
        troop_type = troop_type_cache.get(int(troop_id_str))
        if troop_type is None:
            continue

        upgrade_multiplier = 1 + (attacker_upgrade_levels.get(troop_type.id, 0) * TroopUpgrade.BONUS_PER_LEVEL)

        # ✅ جدید: اعمال بونوس تخصصی پیاده‌نظام/سوارنظام روی همین نیرو
        is_true_infantry = not (troop_type.is_cavalry or troop_type.is_siege_weapon or
                                troop_type.is_settler or troop_type.is_scout or troop_type.is_chief)
        if troop_type.is_cavalry:
            upgrade_multiplier *= (1 + cavalry_attack_percent / 100)
        elif is_true_infantry:
            upgrade_multiplier *= (1 + infantry_attack_percent / 100)

        attacker_points_attack += qty * troop_type.attack_power * upgrade_multiplier
        attacker_survivors[troop_type.id] = qty
        attacker_sent_counts[troop_type.id] = qty

        if getattr(troop_type, 'is_ram', False):
            ram_units_sent += qty
        if getattr(troop_type, 'is_catapult', False):
            catapult_units_sent += qty
            catapult_attack_power += qty * troop_type.attack_power * upgrade_multiplier
        elif troop_type.is_siege_weapon and not getattr(troop_type, 'is_ram', False):
            catapult_units_sent += qty
            catapult_attack_power += qty * troop_type.attack_power * upgrade_multiplier

    attacking_hero = None
    if movement.hero_participating:
        attacker_points_attack += _hero_attack_bonus(source.player)
        attacking_hero = Hero.objects.filter(player=source.player).first()
        if attacking_hero:
            attacking_hero.is_away = False
            attacking_hero.save()

    off_bonus_percent = _hero_off_bonus_percent(source.player, movement.hero_participating)
    attacker_points_attack *= (1 + off_bonus_percent / 100)

    attacker_data = {"points_attack": attacker_points_attack}

    # ------- قدرت مدافع -------
    # بررسی فرار نیروها (فقط برای اعضای کلوپ طلایی)
    evasion_setting = TroopEvasionSetting.objects.filter(village=target).first()
    troops_evasion_enabled = evasion_setting and evasion_setting.is_enabled

    defender_village_troops = list(
        VillageTroop.objects.select_for_update().filter(village=target).select_related('troop_type')
    )
    # ✅ جدید: عکس فوری نیروهای مدافع قبل از اعمال تلفات
    defender_troops_before_named = {vt.troop_type.name: vt.count for vt in defender_village_troops if vt.count > 0}
    defender_original_counts = {vt.troop_type_id: vt.count for vt in defender_village_troops}

    defender_upgrade_levels = {
        u.troop_type_id: u.level for u in TroopUpgrade.objects.filter(village=target)
    }

    defender_points_inf = 0.0
    defender_points_cav = 0.0

    # ✅ جدید: بونوس تخصصی آیتم‌های قهرمانِ مدافع (اگر در این دهکده و در حال دفاع باشد)
    infantry_defense_percent = _hero_infantry_defense_percent(target.player, target)
    cavalry_defense_percent = _hero_cavalry_defense_percent(target.player, target)

    # اگر فرار نیروها فعال باشد، نیروها از دفاع غیبت می‌کنند
    if troops_evasion_enabled:
        # نیروها فرار می‌کنند و در دفاع شرکت نمی‌کنند
        defender_points_inf = 0.0
        defender_points_cav = 0.0
    else:
        for vt in defender_village_troops:
            multiplier = 1 + (defender_upgrade_levels.get(vt.troop_type_id, 0) * TroopUpgrade.BONUS_PER_LEVEL)

            # ✅ جدید: اعمال بونوس تخصصی روی دفاع خودیِ همین نیرو
            is_true_infantry = not (vt.troop_type.is_cavalry or vt.troop_type.is_siege_weapon or
                                    vt.troop_type.is_settler or vt.troop_type.is_scout or vt.troop_type.is_chief)
            if vt.troop_type.is_cavalry:
                multiplier *= (1 + cavalry_defense_percent / 100)
            elif is_true_infantry:
                multiplier *= (1 + infantry_defense_percent / 100)

            defender_points_inf += vt.count * vt.troop_type.defense_infantry * multiplier
            defender_points_cav += vt.count * vt.troop_type.defense_cavalry * multiplier

    # ✅ جدید: بونوس روحیه بر اساس اختلاف جمعیت
    attacker_population = calculate_player_total_population(source.player)
    defender_population = calculate_player_total_population(target.player)
    morale_multiplier = calculate_morale_multiplier(attacker_population, defender_population)
    defender_points_inf *= morale_multiplier
    defender_points_cav *= morale_multiplier

    defender_data = {
        "points_def_infantry": defender_points_inf,
        "points_def_cavalry": defender_points_cav,
    }

    wall_building = VillageBuilding.objects.select_for_update().filter(
        village=target, building_type__provides_wall_defense=True
    ).first()
    wall_level = wall_building.level if wall_building else 0

    # ✅ جدید: کارگاه سنگ‌تراشی دیوار مدافع را قوی‌تر می‌کند
    stonemason_building = VillageBuilding.objects.filter(
        village=target, building_type__name="کارگاه سنگ‌تراشی"
    ).first()
    stonemason_level = stonemason_building.level if stonemason_building else 0

    combat_result = calculate_combat(
        attacker_data, defender_data, wall_level=wall_level, stonemason_level=stonemason_level
    )

    attacker_loss_ratio = combat_result["attacker_loss_percent"] / 100
    defender_loss_ratio = combat_result["defender_loss_percent"] / 100
    victory = combat_result["victory"]

    for troop_id in list(attacker_survivors.keys()):
        qty = attacker_survivors[troop_id]
        remaining = qty - int(round(qty * attacker_loss_ratio))
        attacker_survivors[troop_id] = max(0, remaining)

    for vt in defender_village_troops:
        remaining = vt.count - int(round(vt.count * defender_loss_ratio))
        vt.count = max(0, remaining)
        vt.save()

    # ✅ جدید: عکس فوری نیروهای مدافع بعد از اعمال تلفات
    defender_troops_after_named = {vt.troop_type.name: vt.count for vt in defender_village_troops if vt.count > 0}

    # ✅ جدید: ارزش جمعیتیِ نیروهای مدافع که توسط مهاجم کشته شدند (امتیاز مهاجم)
    defender_troops_killed_value = 0.0
    for vt in defender_village_troops:
        original_qty = defender_original_counts.get(vt.troop_type_id, 0)
        killed_qty = original_qty - vt.count
        if killed_qty > 0:
            defender_troops_killed_value += killed_qty * troop_population_value(vt.troop_type)

    # ✅ جدید: ارزش جمعیتیِ نیروهای مهاجم که توسط مدافع کشته شدند (امتیاز مدافع)
    attacker_troops_killed_value = 0.0
    for troop_id, sent_qty in attacker_sent_counts.items():
        survived_qty = attacker_survivors.get(troop_id, 0)
        killed_qty = sent_qty - survived_qty
        troop_type = troop_type_cache.get(troop_id)
        if troop_type and killed_qty > 0:
            attacker_troops_killed_value += killed_qty * troop_population_value(troop_type)

    # ------- آسیب قوچ به دیوار -------
    wall_damage_msg = ""
    catapult_damage_msg = ""  # ✅ این خط اضافه شود
    if victory == "attacker" and wall_building and ram_units_sent > 0:
        old_wall_level = wall_building.level

        wall_building.level = calculate_demolition_by_defender_casualties(
            defender_loss_ratio * 100, wall_building.level, is_ww=False
        )
        wall_building.is_upgrading = False
        wall_building.save()
        wall_damage_msg = f"\nقوچ‌ها دیوار دهکده را از سطح {old_wall_level} به سطح {wall_building.level} تخریب کردند."

    # ------- آسیب منجنیق -------
    # محاسبه قدرت کل دفاع مدافع (بدون دیوار) برای آستانه 5%
    total_defender_defense = defender_points_inf + defender_points_cav
    catapult_threshold_met = (
        total_defender_defense > 0
        and attacker_points_attack / total_defender_defense >= 0.05
    )
    if victory == "attacker" and catapult_units_sent > 0 and catapult_threshold_met:
        target_building_name = movement.catapult_target_building
        catapult_building = None

        if target_building_name and target_building_name != 'RANDOM':
            catapult_building = VillageBuilding.objects.select_for_update().filter(
                village=target, building_type__name=target_building_name, level__gt=0
            ).exclude(
                building_type__category__in=_CATAPULT_EXCLUDED_CATEGORIES
            ).exclude(
                building_type__name__in=_CATAPULT_EXCLUDED_BUILDING_NAMES
            ).first()

            # اگر ساختمان هدف مشخص بود ولی پیدا نشد، گزارش "Building not found"
            if catapult_building is None:
                catapult_damage_msg = (
                    f"\nمنجنیق‌ها نتوانستند ساختمان «{target_building_name}» را پیدا کنند؛ "
                    f"هیچ آسیبی وارد نشد."
                )
        else:
            # اگر RANDOM یا None باشد، ساختمان تصادفی انتخاب کن
            candidates = list(
                VillageBuilding.objects.select_for_update().filter(village=target, level__gt=0)
                .exclude(building_type__category__in=_CATAPULT_EXCLUDED_CATEGORIES)
                .exclude(building_type__name__in=_CATAPULT_EXCLUDED_BUILDING_NAMES)
            )
            if candidates:
                catapult_building = random.choice(candidates)

        if catapult_building:
            old_level = catapult_building.level
            # استفاده از فرمول جدید بر اساس درصد تلفات مدافع
            catapult_building.level = calculate_demolition_by_defender_casualties(
                defender_loss_ratio * 100, catapult_building.level, is_ww=False
            )
            catapult_building.is_upgrading = False
            catapult_building.save()
            catapult_damage_msg = (
                f"\nمنجنیق‌ها به ساختمان «{catapult_building.building_type.name}» اصابت کردند "
                f"(سطح {old_level} → {catapult_building.level})."
            )

        # ------- آسیب واقعی به شگفتی جهان (اگر هدف صاحب شگفتی جهان باشد) -------
        # طبق مشخصات §13: تخریب شگفتی جهان فقط توسط منجنیق انجام می‌شود (قوچ فقط به دیوار آسیب می‌زند)
        if victory == "attacker" and (catapult_units_sent > 0 and catapult_threshold_met):
            from apps.world_wonder.models import WorldWonder
            ww_obj = WorldWonder.objects.select_for_update().filter(village=target).first()
            if ww_obj and ww_obj.level > 0:
                old_ww_level = ww_obj.level
                # استفاده از فرمول جدید با مقیاس سخت‌تر برای شگفتی جهان
                ww_obj.level = calculate_demolition_by_defender_casualties(
                    defender_loss_ratio * 100, ww_obj.level, is_ww=True
                )
                ww_obj.save()
                VillageBuilding.objects.filter(
                    village=target, building_type__name="شگفتی جهان"
                ).update(level=ww_obj.level, is_upgrading=False)
                if ww_obj.level < old_ww_level:
                    catapult_damage_msg += (
                        f"\n🏛️ نیروهای محاصره‌ای به شگفتی جهان اصابت کردند "
                        f"(سطح {old_ww_level} → {ww_obj.level})."
                    )

    # ------- غارت منابع -------
    loot = {"wood": 0, "clay": 0, "iron": 0, "crop": 0}
    if movement.movement_type == "RAID" and victory == "attacker":
        cranny_levels_sum = VillageBuilding.objects.filter(
            village=target, building_type__name="مخفیگاه"
        ).aggregate(total=Sum('level'))['total'] or 0
        protected_amount = cranny_levels_sum * CRANNY_PROTECTION_PER_LEVEL

        total_capacity = sum(
            qty * troop_type_cache[tid].carry_capacity
            for tid, qty in attacker_survivors.items() if tid in troop_type_cache
        )
        available = {
            "wood": max(0, target.wood - protected_amount),
            "clay": max(0, target.clay - protected_amount),
            "iron": max(0, target.iron - protected_amount),
            "crop": max(0, target.crop - protected_amount),
        }
        total_available = sum(available.values())
        if total_available > 0 and total_capacity > 0:
            take_total = min(total_capacity, total_available)
            for res_name, res_amount in available.items():
                share = min(res_amount, (res_amount / total_available) * take_total)
                loot[res_name] = int(share)
                setattr(target, res_name, getattr(target, res_name) - int(share))
            target.save()
        else:
            # غارت عادی دهکده
            cranny_levels_sum = VillageBuilding.objects.filter(
                village=target, building_type__name="مخفیگاه"
            ).aggregate(total=Sum('level'))['total'] or 0
            protected_amount = cranny_levels_sum * CRANNY_PROTECTION_PER_LEVEL

            total_capacity = sum(
                qty * troop_type_cache[tid].carry_capacity
                for tid, qty in attacker_survivors.items() if tid in troop_type_cache
            )
            available = {
                "wood": max(0, target.wood - protected_amount),
                "clay": max(0, target.clay - protected_amount),
                "iron": max(0, target.iron - protected_amount),
                "crop": max(0, target.crop - protected_amount),
            }
            total_available = sum(available.values())
            if total_available > 0 and total_capacity > 0:
                take_total = min(total_capacity, total_available)
                for res_name, res_amount in available.items():
                    share = (res_amount / total_available) * take_total
                    share = min(res_amount, share)
                    loot[res_name] = int(share)
                    setattr(target, res_name, getattr(target, res_name) - int(share))
                target.save()

    # ------- تسخیر دهکده -------
    conquered = False
    conquest_blocked_reason = ""
    if victory == "attacker" and movement.movement_type == 'ATTACK':
        chief_ids_sent = [
            int(tid) for tid, qty in movement.troops_payload.items()
            if int(qty) > 0 and troop_type_cache.get(int(tid)) and troop_type_cache[int(tid)].is_chief
        ]
        if chief_ids_sent:
            residence_destroyed = not VillageBuilding.objects.filter(
                village=target, building_type__name="اقامتگاه", level__gt=0
            ).exists()

            still_protected = _is_still_protected(target)

            if residence_destroyed and not still_protected:
                loyalty_reduction = len(chief_ids_sent) * random.randint(20, 35)
                target.loyalty = max(0, target.loyalty - loyalty_reduction)

                for tid in chief_ids_sent:
                    attacker_survivors[tid] = 0

                if target.loyalty <= 0:
                    if target.is_capital:
                        target.loyalty = 1
                        conquest_blocked_reason = "\n👑 این دهکده پایتخت است و هرگز قابل تسخیر نیست."
                    else:
                        target.player = source.player
                        target.loyalty = random.randint(20, 35)
                        conquered = True

                target.save()

                if conquered and target.is_natar_ww_site:
                    _convert_to_ww_site(target)

                if conquered:  # ✅ جدید: تصاحب/دزدیده‌شدن کتیبه در صورت وجود در این دهکده
                    _capture_artifact_if_present(target)
            else:
                for tid in chief_ids_sent:
                    attacker_survivors[tid] = 0
                if still_protected:
                    conquest_blocked_reason = "\n🛡️ این دهکده هنوز در دوره‌ی محافظت تازه‌واردان است؛ چیف اثری نداشت."
                else:
                    conquest_blocked_reason = "\n🛡️ اقامتگاه این دهکده هنوز سرپاست؛ چیف اثری نداشت."

    plan_message = ""
    if victory == "attacker" and movement.movement_type == 'ATTACK' and movement.hero_participating:
        from apps.world_wonder.models import WWBuildingPlan

        all_defenders_dead = not VillageTroop.objects.filter(village=target, count__gt=0).exists()
        available_plan = WWBuildingPlan.objects.filter(holder_village=target).first()

        if all_defenders_dead and available_plan:
            attacker_hero = Hero.objects.filter(player=source.player).first()
            thief_treasury_ok = bool(
                attacker_hero and attacker_hero.home_village and VillageBuilding.objects.filter(
                    village=attacker_hero.home_village, building_type__name="خزانه‌داری", level__gte=10
                ).exists()
            )
            if thief_treasury_ok:
                available_plan.holder_village = attacker_hero.home_village
                available_plan.save()
                plan_message = f" 🗺️ نقشه‌ی ساخت شگفتی جهان با موفقیت به دهکده {attacker_hero.home_village.name} منتقل شد!"
            else:
                plan_message = " ⚠️ نقشه‌ی ساخت پیدا شد اما خزانه‌داری مقصد (سطح ۱۰ یا بالاتر در دهکده‌ی خانگی قهرمان) آماده نبود، پس نقشه برداشته نشد."

    # ✅ جدید: آسیب قهرمان‌ها در نبرد واقعی
    hero_combat_summary = ""
    if movement.hero_participating and attacking_hero and attacking_hero.is_alive:
        dmg, died = _apply_hero_combat_damage(attacking_hero, is_winner=(victory == "attacker"))
        hero_combat_summary += f"\n🦸 قهرمان مهاجم {dmg} آسیب دید" + (" و از پای درآمد!" if died else ".")

    defending_hero = Hero.objects.filter(
        player=target.player, is_alive=True, home_village=target,
        is_away=False, is_on_adventure=False, participates_in_defense=True,
    ).first()
    if defending_hero:
        dmg, died = _apply_hero_combat_damage(defending_hero, is_winner=(victory == "defender"))
        hero_combat_summary += f"\n🦸 قهرمان مدافع {dmg} آسیب دید" + (" و از پای درآمد!" if died else ".")

    # ✅ جدید: تله‌ی توتونی — فقط وقتی مدافع پیروز شده
    trapped_summary = _apply_trapper_capture(target, attacker_survivors, troop_type_cache, source.player) if victory == "defender" else ""

    # ✅ جدید: بازماندگان اسم‌دار (بعد از تله) برای گزارش ساختاری
    attacker_troops_survived_named = {}
    for tid, qty in attacker_survivors.items():
        if qty <= 0:
            continue
        tt = troop_type_cache.get(tid)
        if tt:
            attacker_troops_survived_named[tt.name] = attacker_troops_survived_named.get(tt.name, 0) + qty

    winner_label = "مهاجم" if victory == "attacker" else "مدافع"
    log_msg = (
        f"نبرد در دهکده {target.name} پایان یافت.\n"
        f"برنده: {winner_label}\n"
        f"تلفات مهاجم: {combat_result['attacker_loss_percent']:.1f}%\n"
        f"تلفات مدافع: {combat_result['defender_loss_percent']:.1f}%"
    )
    if troops_evasion_enabled:
        log_msg += "\n⚠️ نیروهای مدافع از طریق قابلیت فرار نیروها (کلوپ طلایی) غیبت کردند."
    log_msg += wall_damage_msg
    log_msg += catapult_damage_msg
    if any(loot.values()):
        log_msg += f"\nمنابع غارت شده: {loot}"
    if victory == "attacker" and any(
            troop_type_cache.get(int(tid), None) and troop_type_cache[int(tid)].is_chief for tid in
            movement.troops_payload):
        log_msg += f"\n👑 وفاداری دهکده هدف اکنون {target.loyalty:.0f} است."
    log_msg += conquest_blocked_reason
    if conquered:
        log_msg += f"\n🏆 دهکده {target.name} با موفقیت تسخیر شد و اکنون متعلق به شماست!"
    log_msg += plan_message
    log_msg += hero_combat_summary  # ✅ جدید
    if trapped_summary:  # ✅ جدید
        log_msg += f"\n{trapped_summary}"

    GameLog.objects.create(village=source, log_type='COMBAT', description=log_msg)
    GameLog.objects.create(village=target, log_type='COMBAT', description=log_msg)

    # ✅ جدید: گزارش ساختاری جنگ
    CombatReport.objects.create(
        attacker_player=source.player,
        defender_player=target.player,
        attacker_village_name=source.name,
        defender_village_name=target.name,
        attacker_coords=f"{source.x_coord}|{source.y_coord}",
        defender_coords=f"{target.x_coord}|{target.y_coord}",
        movement_type=movement.movement_type,
        victory=victory,
        attacker_troops_sent=attacker_troops_sent_named,
        attacker_troops_survived=attacker_troops_survived_named,
        defender_troops_before=defender_troops_before_named,
        defender_troops_after=defender_troops_after_named,
        attacker_loss_percent=combat_result['attacker_loss_percent'],
        defender_loss_percent=combat_result['defender_loss_percent'],
        morale_percent=round(morale_multiplier * 100, 1),
        loot=loot,
        wall_damage_text=wall_damage_msg.strip(),
        catapult_damage_text=catapult_damage_msg.strip(),
        conquered=conquered,
        trapped_summary=trapped_summary,
    )

    # ✅ جدید: به‌روزرسانی امتیاز مهاجم/مدافع کلی برای رتبه‌بندی و مدال‌ها
    _increment_combat_stats(source.player_id, attacker_points=defender_troops_killed_value)
    _increment_combat_stats(original_defender_player_id, defender_points=attacker_troops_killed_value)

    movement.is_completed = True
    movement.save()

    _grant_hero_experience(source.player, 10 if victory == "attacker" else 3)
    _grant_hero_experience(original_defender_player, 10 if victory == "defender" else 3)

    _notify_player(original_defender_player_id, "COMBAT_RESULT", {
        "message": log_msg, "winner": winner_label, "combat": combat_result
    })
    _notify_player(source.player_id, "COMBAT_RESULT", {
        "message": log_msg, "winner": winner_label, "combat": combat_result
    })

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


def _capture_artifact_if_present(captured_village):
    """
    اگر دهکده‌ی تسخیرشده (چه یک دهکده‌ی ناتار نگهبان کتیبه، چه دهکده‌ی هر
    بازیکن دیگری که از قبل صاحب یک کتیبه بوده) صاحب یک کتیبه باشد، با
    تسخیرش کتیبه هم به‌طور خودکار متعلق به مالک جدید می‌شود (چون مالک واقعی
    کتیبه همیشه از طریق holder_village.player خوانده می‌شود، نه یک فیلد
    جداگانه). هر بار تصاحب، طبق قوانین تراوین اصلی، یک تاخیر ۲۴ ساعته‌ی
    جدید قبل از فعال شدن اثر ایجاد می‌کند.
    """
    from apps.game_engine.models import Artifact
    artifact = Artifact.objects.filter(holder_village=captured_village).first()
    if not artifact:
        return

    artifact.captured_at = timezone.now()
    artifact.activates_at = timezone.now() + datetime.timedelta(hours=24)
    artifact.is_activated = False
    artifact.save()

    GameLog.objects.create(
        village=captured_village, log_type='SYSTEM',
        description=(
            f"🏺 کتیبه‌ی «{artifact.name}» با تسخیر این دهکده تصاحب شد؛ "
            f"تا ۲۴ ساعت دیگر فعال می‌شود."
        )
    )


def _convert_to_ww_site(village):
    from apps.game_engine.models import VillageBuilding
    from apps.game_engine.services import _get_or_create_building_type, _get_or_create_empty_building_type, _WALL_DEFS, _DEFAULT_WALL_DEF, _RALLY_POINT_DEF
    from apps.world_wonder.models import WorldWonder

    VillageBuilding.objects.filter(village=village).exclude(building_type__category='RESOURCE').delete()

    ww_building_type = _get_or_create_building_type("شگفتی جهان", category='INFRASTRUCTURE', max_level=100)
    VillageBuilding.objects.create(village=village, building_type=ww_building_type, position=19, level=0)

    empty_type = _get_or_create_empty_building_type()
    for pos in range(20, 39):
        VillageBuilding.objects.get_or_create(village=village, position=pos, defaults={"building_type": empty_type, "level": 0})

    rally_name, rally_level, rally_category = _RALLY_POINT_DEF
    rally_type = _get_or_create_building_type(rally_name, category=rally_category)
    VillageBuilding.objects.get_or_create(village=village, position=39, defaults={"building_type": rally_type, "level": rally_level})

    wall_def = _WALL_DEFS.get(village.player.tribe, _DEFAULT_WALL_DEF)
    wall_name, wall_level, wall_category = wall_def
    wall_type = _get_or_create_building_type(wall_name, provides_wall_defense=True, category=wall_category)
    VillageBuilding.objects.get_or_create(village=village, position=40, defaults={"building_type": wall_type, "level": wall_level})

    trapper_type = _get_or_create_building_type("تله", category='MILITARY')
    VillageBuilding.objects.get_or_create(village=village, position=41, defaults={"building_type": trapper_type, "level": 0})

    village.is_natar_ww_site = False
    village.name = f"شگفتی جهان ({village.x_coord}|{village.y_coord})"
    village.save()


@app.task
def resolve_hero_adventure(hero_id, adventure_id):
    with transaction.atomic():
        try:
            hero = Hero.objects.select_for_update().get(id=hero_id)
            adventure = Adventure.objects.select_for_update().get(
                id=adventure_id,
                is_completed=False
            )
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
    from apps.authentication.models import Player
    for player in Player.objects.filter(is_active=True).exclude(username__in=["Natars", "Farms"]):
        hero = Hero.objects.filter(player=player).select_related('home_village').first()
        if hero and hero.home_village:
            generate_adventures_for_player(player, hero.home_village, count=2)


@app.task
def complete_troop_upgrade(upgrade_id):
    """✅ تکمیل ارتقای آهنگری یک نوع نیرو در یک دهکده."""
    try:
        upgrade = TroopUpgrade.objects.select_for_update().get(id=upgrade_id, is_upgrading=True)
    except TroopUpgrade.DoesNotExist:
        return "ارتقا یافت نشد یا قبلا انجام شده."
    upgrade.level += 1
    upgrade.is_upgrading = False
    upgrade.upgrade_ends_at = None
    upgrade.save()

    GameLog.objects.create(
        village=upgrade.village,
        log_type='BUILDING',
        description=f"ارتقای {upgrade.troop_type.name} در آهنگری به لول {upgrade.level} رسید."
    )
    _notify_player(upgrade.village.player_id, "TROOP_UPGRADE_COMPLETED", {
        "message": f"ارتقای {upgrade.troop_type.name} به لول {upgrade.level} در {upgrade.village.name} تمام شد.",
        "village_id": upgrade.village_id,
    })
    return f"ارتقای {upgrade.troop_type.name} در {upgrade.village.name} به لول {upgrade.level} رسید."


@app.task
def complete_academy_research(research_id):
    """تکمیل تحقیق آکادمی — ثبت نیرو به عنوان تحقیق‌شده."""
    from .models import AcademyResearchQueue, ResearchedTroop
    try:
        queue_item = AcademyResearchQueue.objects.select_for_update().get(id=research_id, is_completed=False)
    except AcademyResearchQueue.DoesNotExist:
        return "تحقیق یافت نشد یا قبلا انجام شده."

    ResearchedTroop.objects.get_or_create(
        village=queue_item.village,
        troop_type=queue_item.troop_type,
    )
    queue_item.is_completed = True
    queue_item.save()

    GameLog.objects.create(
        village=queue_item.village,
        log_type='BUILDING',
        description=f"تحقیق {queue_item.troop_type.name} در آکادمی تمام شد."
    )
    _notify_player(queue_item.village.player_id, "ACADEMY_RESEARCH_COMPLETED", {
        "message": f"تحقیق {queue_item.troop_type.name} در {queue_item.village.name} تمام شد.",
        "village_id": queue_item.village_id,
        "troop_type_id": queue_item.troop_type_id,
    })
    return f"تحقیق {queue_item.troop_type.name} در {queue_item.village.name} تمام شد."


@app.task
def resolve_hero_auction(auction_id):
    try:
        with transaction.atomic():
            auction = HeroAuction.objects.select_for_update().get(id=auction_id, is_completed=False)
    except HeroAuction.DoesNotExist:
        return "این حراجی یافت نشد یا قبلا پردازش شده است."

    auction.is_completed = True
    auction.save()

    if not auction.current_bidder_id:
        return f"حراجی #{auction.id} بدون برنده به پایان رسید."

    hero, _ = Hero.objects.get_or_create(player=auction.current_bidder)
    PlayerHeroItem.objects.create(hero=hero, item=auction.item, is_equipped=False)

    _notify_player(auction.current_bidder_id, "AUCTION_WON", {
        "message": f"شما برنده‌ی حراجی «{auction.item.name}» شدید و به کوله‌پشتی قهرمانتان اضافه شد.",
    })
    return f"حراجی #{auction.id} به {auction.current_bidder.username} رسید."


@app.task
def generate_hero_auctions():
    active_count = HeroAuction.objects.filter(is_completed=False, ends_at__gt=timezone.now()).count()
    candidate_items = list(HeroItem.objects.all())
    if not candidate_items:
        return "هیچ آیتمی برای حراجی وجود ندارد."

    created = 0
    for _ in range(max(0, 5 - active_count)):
        item = random.choice(candidate_items)
        ends_at = timezone.now() + datetime.timedelta(hours=6)
        starting_bid = random.choice([10, 15, 20, 25])
        auction = HeroAuction.objects.create(
            item=item, current_bid=starting_bid, current_bid_currency='gold',
            current_bid_original_amount=starting_bid, ends_at=ends_at,
        )
        resolve_hero_auction.apply_async(args=[auction.id], eta=ends_at)
        created += 1
    return f"{created} حراجی جدید ساخته شد."