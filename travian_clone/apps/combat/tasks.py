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
    Adventure, TroopUpgrade,
)
from .engine import calculate_combat, calculate_catapult_damage
from .hero_utils import resolve_adventure, generate_adventures_for_player


CRANNY_PROTECTION_PER_LEVEL = 100  # هر سطح مخفیگاه، این مقدار از هر نوع منبع را از غارت محافظت می‌کند

# ✅ ساختمان‌هایی که هرگز نباید هدف منجنیق قرار بگیرند (دیوار جداگانه توسط
# قوچ مدیریت می‌شود، و مزارع منابع اصلا در تراوین اصلی هدف منجنیق نیستند)
_CATAPULT_EXCLUDED_CATEGORIES = ('RESOURCE', 'WALL')


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
    """امتیاز دفاعی قهرمان؛ فقط وقتی قهرمان دقیقا در همین دهکده مستقر است،
    در ماموریت/ماجراجویی نیست، و گزینه‌ی «مشارکت در دفاع» را غیرفعال نکرده باشد."""
    try:
        hero = Hero.objects.get(
            player=player, is_alive=True, home_village=village,
            is_away=False, is_on_adventure=False, participates_in_defense=True,
        )
    except Hero.DoesNotExist:
        return 0
    return hero.level * 40 + hero.fighting_strength_points * 20


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
    hero.experience += amount
    hero.level = 1 + hero.experience // 100
    hero.save()


def _is_still_protected(target_village):
    """بررسی مضاعف محافظت تازه‌واردان در لحظه‌ی نتیجه‌گیری نبرد (علاوه بر چک اولیه
    هنگام دیسپچ) - برای اطمینان کامل، چون بین لحظه‌ی اعزام و لحظه‌ی رسیدن ممکن
    است زمان زیادی گذشته باشد و این تابع همیشه وضعیت لحظه‌ی فعلی را چک می‌کند."""
    owner_username = target_village.player.username
    if owner_username in ("Natars", "Farms"):
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

    # ✅ ضرایب ارتقای آهنگری مهاجم (بر اساس دهکده‌ی مبدا)، یک‌بار خوانده می‌شود
    attacker_upgrade_levels = {
        u.troop_type_id: u.level
        for u in TroopUpgrade.objects.filter(village=source, troop_type_id__in=troop_type_cache.keys())
    }

    attacker_points_attack = 0
    attacker_survivors = {}

    # ✅ تفکیک کامل قوچ (همیشه هدفش دیوار است) از منجنیق (هدفش قابل انتخاب است)
    ram_units_sent = 0
    catapult_units_sent = 0

    for troop_id_str, qty in movement.troops_payload.items():
        qty = int(qty)
        if qty <= 0:
            continue
        troop_type = troop_type_cache.get(int(troop_id_str))
        if troop_type is None:
            continue

        upgrade_multiplier = 1 + (attacker_upgrade_levels.get(troop_type.id, 0) * TroopUpgrade.BONUS_PER_LEVEL)
        attacker_points_attack += qty * troop_type.attack_power * upgrade_multiplier
        attacker_survivors[troop_type.id] = qty

        if getattr(troop_type, 'is_ram', False):
            ram_units_sent += qty
        if getattr(troop_type, 'is_catapult', False):
            catapult_units_sent += qty
        elif troop_type.is_siege_weapon and not getattr(troop_type, 'is_ram', False):
            # نیروهای محاصره‌ای قدیمی seed شده که هنوز is_ram/is_catapult ندارند:
            # با فرض این‌که منجنیق‌اند در نظر گرفته می‌شوند تا رفتار قبلی حفظ شود.
            catapult_units_sent += qty

    # امتیاز قهرمان مهاجم (بونوس ثابت + بونوس درصدی امتیاز تهاجمی)
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
    defender_village_troops = list(
        VillageTroop.objects.select_for_update().filter(village=target).select_related('troop_type')
    )
    defender_upgrade_levels = {
        u.troop_type_id: u.level for u in TroopUpgrade.objects.filter(village=target)
    }

    defender_points_inf = 0.0
    defender_points_cav = 0.0
    for vt in defender_village_troops:
        multiplier = 1 + (defender_upgrade_levels.get(vt.troop_type_id, 0) * TroopUpgrade.BONUS_PER_LEVEL)
        defender_points_inf += vt.count * vt.troop_type.defense_infantry * multiplier
        defender_points_cav += vt.count * vt.troop_type.defense_cavalry * multiplier

    animal_inf, animal_cav = _animal_defense_points(target)
    defender_points_inf += animal_inf
    defender_points_cav += animal_cav

    hero_defense_flat = _hero_defense_bonus(target.player, target)
    defender_points_inf += hero_defense_flat
    defender_points_cav += hero_defense_flat

    def_bonus_percent = _hero_def_bonus_percent(target.player, target)
    defender_points_inf *= (1 + def_bonus_percent / 100)
    defender_points_cav *= (1 + def_bonus_percent / 100)

    defender_data = {
        "points_def_infantry": defender_points_inf,
        "points_def_cavalry": defender_points_cav,
    }

    wall_building = VillageBuilding.objects.select_for_update().filter(
        village=target, building_type__provides_wall_defense=True
    ).first()
    wall_level = wall_building.level if wall_building else 0

    combat_result = calculate_combat(attacker_data, defender_data, wall_level=wall_level)

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

    # ------- ✅ آسیب قوچ به دیوار (همیشه، مستقل از منجنیق) -------
    wall_damage_msg = ""
    if victory == "attacker" and wall_building and ram_units_sent > 0:
        old_wall_level = wall_building.level
        wall_building.level = calculate_catapult_damage(ram_units_sent, wall_building.level)
        wall_building.is_upgrading = False
        wall_building.save()
        wall_damage_msg = f"\nقوچ‌ها دیوار دهکده را از سطح {old_wall_level} به سطح {wall_building.level} تخریب کردند."

    # ------- ✅ آسیب منجنیق به ساختمان انتخابی یا تصادفی (مستقل از قوچ) -------
    catapult_damage_msg = ""
    if victory == "attacker" and catapult_units_sent > 0:
        target_building_name = movement.catapult_target_building
        catapult_building = None

        if target_building_name and target_building_name != 'RANDOM':
            catapult_building = VillageBuilding.objects.select_for_update().filter(
                village=target, building_type__name=target_building_name, level__gt=0
            ).exclude(building_type__category__in=_CATAPULT_EXCLUDED_CATEGORIES).first()

        if catapult_building is None:
            candidates = list(
                VillageBuilding.objects.select_for_update().filter(village=target, level__gt=0)
                .exclude(building_type__category__in=_CATAPULT_EXCLUDED_CATEGORIES)
            )
            if candidates:
                catapult_building = random.choice(candidates)

        if catapult_building:
            old_level = catapult_building.level
            catapult_building.level = calculate_catapult_damage(catapult_units_sent, catapult_building.level)
            catapult_building.is_upgrading = False
            catapult_building.save()
            catapult_damage_msg = (
                f"\nمنجنیق‌ها به ساختمان «{catapult_building.building_type.name}» اصابت کردند "
                f"(سطح {old_level} → {catapult_building.level})."
            )

    # ------- غارت منابع (فقط در حرکت از نوع RAID و پیروزی مهاجم) -------
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
                share = (res_amount / total_available) * take_total
                share = min(res_amount, share)
                loot[res_name] = int(share)
                setattr(target, res_name, getattr(target, res_name) - int(share))
            target.save()

    # ------- ✅ تسخیر دهکده با چیف/سناتور/رئیس - حالا برای هر دهکده‌ای (نه فقط ناتار) -------
    conquered = False
    conquest_blocked_reason = ""
    if victory == "attacker" and movement.movement_type == 'ATTACK':
        chief_ids_sent = [
            int(tid) for tid, qty in movement.troops_payload.items()
            if int(qty) > 0 and troop_type_cache.get(int(tid)) and troop_type_cache[int(tid)].is_chief
        ]
        if chief_ids_sent:
            # عمارت اقامتی باید تخریب و ناموجود باشد تا وفاداری اصلا کم شود
            residence_destroyed = not VillageBuilding.objects.filter(
                village=target, building_type__name="عمارت اقامتی", level__gt=0
            ).exists()

            # ✅ محافظت تازه‌واردان: چک مضاعف در لحظه‌ی نتیجه‌گیری
            still_protected = _is_still_protected(target)

            if residence_destroyed and not still_protected:
                loyalty_reduction = len(chief_ids_sent) * random.randint(20, 35)
                target.loyalty = max(0, target.loyalty - loyalty_reduction)

                for tid in chief_ids_sent:
                    attacker_survivors[tid] = 0

                if target.loyalty <= 0:
                    if target.is_capital:
                        # ✅ پایتخت هرگز تسخیر نمی‌شود (دقیقا مثل تراوین اصلی)
                        target.loyalty = 1
                        conquest_blocked_reason = "\n👑 این دهکده پایتخت است و هرگز قابل تسخیر نیست."
                    else:
                        target.player = source.player
                        target.loyalty = random.randint(20, 35)
                        conquered = True

                target.save()

                if conquered and target.is_natar_ww_site:
                    _convert_to_ww_site(target)
            else:
                for tid in chief_ids_sent:
                    attacker_survivors[tid] = 0
                if still_protected:
                    conquest_blocked_reason = "\n🛡️ این دهکده هنوز در دوره‌ی محافظت تازه‌واردان است؛ چیف اثری نداشت."
                else:
                    conquest_blocked_reason = "\n🛡️ عمارت اقامتی این دهکده هنوز سرپاست؛ چیف اثری نداشت."

    plan_message = ""
    if victory == "attacker" and movement.movement_type == 'ATTACK' and movement.hero_participating:
        from apps.world_wonder.models import WWBuildingPlan

        all_defenders_dead = not VillageTroop.objects.filter(village=target, count__gt=0).exists()
        available_plan = WWBuildingPlan.objects.filter(holder_village=target).first()

        if all_defenders_dead and catapult_units_sent > 0 and available_plan:
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

    winner_label = "مهاجم" if victory == "attacker" else "مدافع"
    log_msg = (
        f"نبرد در دهکده {target.name} پایان یافت.\n"
        f"برنده: {winner_label}\n"
        f"تلفات مهاجم: {combat_result['attacker_loss_percent']:.1f}%\n"
        f"تلفات مدافع: {combat_result['defender_loss_percent']:.1f}%"
    )
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

    GameLog.objects.create(village=source, log_type='COMBAT', description=log_msg)
    GameLog.objects.create(village=target, log_type='COMBAT', description=log_msg)

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


def _convert_to_ww_site(village):
    from apps.game_engine.models import VillageBuilding
    from apps.game_engine.services import _get_or_create_building_type
    from apps.world_wonder.models import WorldWonder

    VillageBuilding.objects.filter(village=village).exclude(building_type__category='RESOURCE').delete()

    ww_building_type = _get_or_create_building_type("شگفتی جهان", category='INFRASTRUCTURE', max_level=100)
    VillageBuilding.objects.create(village=village, building_type=ww_building_type, position=19, level=0)
    WorldWonder.objects.get_or_create(village=village)

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