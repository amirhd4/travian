import random
import math
import datetime
from django.utils import timezone

from .models import Adventure, PlayerHeroItem, HeroItem, Hero


# ضرایب سختی هر ماجراجویی: قدرت هیولا، پاداش تجربه، شانس یافتن آیتم، حداقل سطح لازم
DIFFICULTY_SETTINGS = {
    'EASY':   {"monster_power": 30,  "xp_reward": 20, "item_chance": 0.25, "min_hero_level": 0},
    'NORMAL': {"monster_power": 70,  "xp_reward": 45, "item_chance": 0.40, "min_hero_level": 3},
    'HARD':   {"monster_power": 130, "xp_reward": 90, "item_chance": 0.60, "min_hero_level": 7},
}

ADVENTURE_SEARCH_RADIUS = 15
HERO_TRAVEL_SPEED_TILES_PER_HOUR = 8   # سرعت پای پیاده‌ی قهرمان (بدون اسب) روی نقشه
HEALTH_REGEN_PERCENT_PER_HOUR = 5      # درصد بازیابی سلامتی در هر ساعت وقتی در خانه است


def _hero_combat_power(hero):
    """قدرت نبرد قهرمان: پایه بر اساس سطح + بونوس آیتم‌های تجهیز شده."""
    equipped_bonus = sum(
        inv.item.attack_bonus
        for inv in PlayerHeroItem.objects.filter(hero=hero, is_equipped=True).select_related('item')
    )
    return 20 + (hero.level * 15) + equipped_bonus


def sync_hero_health(hero):
    """
    بازیابی تدریجی سلامتی قهرمان با گذر زمان (فقط وقتی در ماجراجویی نیست و زنده است).
    قبل از این تابع، health یک عدد ثابت بود که هیچ‌وقت به‌صورت خودکار ترمیم
    نمی‌شد؛ یعنی بعد از یک شکست، قهرمان برای همیشه زخمی می‌ماند.
    """
    now = timezone.now()
    if hero.is_on_adventure or not hero.is_alive:
        return hero

    elapsed_hours = (now - hero.last_health_update).total_seconds() / 3600
    if elapsed_hours <= 0:
        return hero

    hero.health = min(100, hero.health + elapsed_hours * HEALTH_REGEN_PERCENT_PER_HOUR)
    hero.last_health_update = now
    hero.save(update_fields=["health", "last_health_update"])
    return hero


def generate_adventures_for_player(player, home_village, count=2):
    """در صورت کمبود ماجراجویی فعال برای بازیکن، مورد جدید در اطراف دهکده‌ی او می‌سازد."""
    active_count = Adventure.objects.filter(
        player=player, is_completed=False, expires_at__gt=timezone.now()
    ).count()

    for _ in range(max(0, count - active_count)):
        angle = random.uniform(0, 2 * math.pi)
        distance = random.randint(2, ADVENTURE_SEARCH_RADIUS)
        x = home_village.x_coord + int(distance * math.cos(angle))
        y = home_village.y_coord + int(distance * math.sin(angle))
        difficulty = random.choices(['EASY', 'NORMAL', 'HARD'], weights=[0.5, 0.35, 0.15])[0]
        Adventure.objects.create(
            player=player, x_coord=x, y_coord=y, difficulty=difficulty,
            expires_at=timezone.now() + datetime.timedelta(hours=12),
        )


def calculate_travel_seconds_to_point(home_village, x, y):
    distance = math.sqrt((home_village.x_coord - x) ** 2 + (home_village.y_coord - y) ** 2)
    hours = distance / HERO_TRAVEL_SPEED_TILES_PER_HOUR
    return max(30, hours * 3600)


def _get_equipped_item_bonus_sum(hero, field_name):  # ✅ جدید
    return sum(
        getattr(inv.item, field_name, 0) or 0
        for inv in PlayerHeroItem.objects.filter(hero=hero, is_equipped=True).select_related('item')
    )


def get_hero_training_speed_bonus_percent(player, troop_type):  # ✅ جدید
    """
    بونوس درصدی کاهش زمان آموزش از آیتم‌های تخصصی قهرمان، بر اساس اینکه نیروی
    موردنظر پیاده‌نظام است یا سوارنظام. سلاح‌های محاصره‌ای/مهاجر/جاسوس/رئیس
    مشمول این بونوس نمی‌شوند.
    """
    hero = Hero.objects.filter(player=player, is_alive=True).first()
    if not hero:
        return 0

    is_true_infantry = not (troop_type.is_cavalry or troop_type.is_siege_weapon or
                             troop_type.is_settler or troop_type.is_scout or troop_type.is_chief)

    if troop_type.is_cavalry:
        field_name = 'cavalry_training_speed_percent'
    elif is_true_infantry:
        field_name = 'infantry_training_speed_percent'
    else:
        return 0

    return _get_equipped_item_bonus_sum(hero, field_name)


def resolve_adventure(hero, adventure):
    """نبرد قهرمان با هیولای ماجراجویی؛ نتیجه بر اساس نسبت قدرت با کمی شانس تصادفی."""
    settings_ = DIFFICULTY_SETTINGS[adventure.difficulty]
    hero_power = _hero_combat_power(hero)
    luck = random.uniform(0.85, 1.15)
    success = (hero_power * luck) >= settings_["monster_power"]

    result = {"success": success, "found_item": None, "xp_gained": 0}

    if success:
        damage_taken = random.randint(5, 20)
        xp_bonus_percent = _get_equipped_item_bonus_sum(hero, 'experience_bonus_percent')
        xp_gained = int(round(settings_["xp_reward"] * (1 + xp_bonus_percent / 100)))
        hero.experience += xp_gained
        result["xp_gained"] = xp_gained

        if random.random() < settings_["item_chance"]:
            candidate_items = list(HeroItem.objects.all())
            if candidate_items:
                item = random.choice(candidate_items)
                PlayerHeroItem.objects.create(hero=hero, item=item, is_equipped=False)
                result["found_item"] = item.name
    else:
        damage_taken = random.randint(30, 55)

    hero.health = max(0, hero.health - damage_taken)
    result["damage_taken"] = damage_taken
    result["hero_died"] = hero.health <= 0

    if result["hero_died"]:
        hero.is_alive = False

    hero.level = 1 + hero.experience // 100
    hero.is_on_adventure = False
    hero.adventure_returns_at = None
    hero.last_health_update = timezone.now()
    hero.save()

    adventure.is_completed = True
    adventure.save()

    return result