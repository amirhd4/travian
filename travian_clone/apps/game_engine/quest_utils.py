from django.db.models import Max, Sum
from django.utils import timezone

from .models import Village, VillageBuilding, ResourceTrade, QuestDefinition, PlayerQuestProgress


def _max_building_level(player, building_names):
    return VillageBuilding.objects.filter(
        village__player=player, building_type__name__in=building_names
    ).aggregate(m=Max('level'))['m'] or 0


def _current_quest_value(player, quest):
    """مقدار فعلی بازیکن برای شرط این کوئست، جهت مقایسه با condition_target."""
    condition = quest.condition_type

    if condition == 'MAIN_BUILDING_LEVEL':
        return _max_building_level(player, ["ساختمان اصلی"])
    if condition == 'WAREHOUSE_LEVEL':
        return _max_building_level(player, ["انبار"])
    if condition == 'GRANARY_LEVEL':
        return _max_building_level(player, ["سیلوی غله"])
    if condition == 'RESOURCE_FIELD_LEVEL':
        return _max_building_level(player, ["چوب‌بری", "گودال خاک رس", "معدن آهن", "مزرعه گندم"])
    if condition == 'RALLY_POINT_LEVEL':
        return _max_building_level(player, ["محل گردهمایی"])
    if condition == 'BARRACKS_LEVEL':
        return _max_building_level(player, ["پادگان"])
    if condition == 'MARKETPLACE_LEVEL':
        return _max_building_level(player, ["بازارچه"])
    if condition == 'WALL_LEVEL':
        return _max_building_level(player, ["دیوار"])

    if condition == 'TROOP_COUNT':
        from apps.combat.models import VillageTroop
        return VillageTroop.objects.filter(village__player=player).aggregate(s=Sum('count'))['s'] or 0

    if condition == 'TRADE_SENT':
        return 1 if ResourceTrade.objects.filter(source_village__player=player).exists() else 0

    if condition == 'MOVEMENT_SENT':
        from apps.combat.models import TroopMovement
        exists = TroopMovement.objects.filter(
            source_village__player=player
        ).exclude(movement_type='RETURN').exists()
        return 1 if exists else 0

    if condition == 'SECOND_VILLAGE':
        return Village.objects.filter(player=player).count()

    if condition == 'HERO_ADVENTURE':
        from apps.combat.models import Adventure
        return 1 if Adventure.objects.filter(player=player, is_completed=True).exists() else 0

    return 0


def sync_quest_progress(player):
    """
    وضعیت تمام کوئست‌های فعال بازیکن را بر اساس داده‌ی واقعی و لحظه‌ای بازی
    دوباره محاسبه می‌کند و در صورت برآورده‌شدن شرط، کوئست را completed
    علامت می‌زند. خروجی: لیستی از (quest, progress, current_value).
    """
    quests = QuestDefinition.objects.filter(is_active=True).order_by('order')
    progress_map = {
        p.quest_id: p
        for p in PlayerQuestProgress.objects.filter(player=player, quest__in=quests)
    }

    result = []
    for quest in quests:
        progress = progress_map.get(quest.id)
        if not progress:
            progress = PlayerQuestProgress.objects.create(player=player, quest=quest)

        if not progress.is_completed:
            current_value = _current_quest_value(player, quest)
            if current_value >= quest.condition_target:
                progress.is_completed = True
                progress.completed_at = timezone.now()
                progress.save()
        else:
            current_value = quest.condition_target

        result.append((quest, progress, current_value))

    return result


def claim_quest_reward(player, quest_id):
    """اهدای پاداش یک کوئست تکمیل‌شده به پایتخت (یا اولین دهکده‌ی) بازیکن."""
    try:
        progress = PlayerQuestProgress.objects.select_related('quest').get(player=player, quest_id=quest_id)
    except PlayerQuestProgress.DoesNotExist:
        return False, "کوئست یافت نشد."

    if not progress.is_completed:
        return False, "این کوئست هنوز تکمیل نشده است."
    if progress.is_reward_claimed:
        return False, "پاداش این کوئست قبلا دریافت شده است."

    village = Village.objects.filter(player=player).order_by('-is_capital', 'id').first()
    if not village:
        return False, "دهکده‌ای برای دریافت پاداش یافت نشد."

    quest = progress.quest
    village.wood = min(village.max_storage, village.wood + quest.reward_wood)
    village.clay = min(village.max_storage, village.clay + quest.reward_clay)
    village.iron = min(village.max_storage, village.iron + quest.reward_iron)
    village.crop = min(village.max_granary, village.crop + quest.reward_crop)
    village.save()

    if quest.reward_gold:
        player.gold_coins += quest.reward_gold
        player.save()

    progress.is_reward_claimed = True
    progress.save()

    return True, "پاداش دریافت شد."