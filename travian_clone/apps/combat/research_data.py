"""
Research costs and prerequisites for the Academy system.
Each troop type (except basic infantry) must be researched before training/upgrading.
"""

from apps.combat.models import TroopType

# Research costs: {troop_type_id: (wood, clay, iron, crop, time_seconds)}
RESEARCH_COSTS = {
    # ROMAN
    2: (160, 100, 150, 50, 1800),     # محافظ نیزه‌دار (Praetorian)
    3: (100, 120, 60, 40, 2400),       # کاراگاه (Scout)
    4: (300, 250, 200, 80, 3600),      # شوالیه سوار (Equites Legati)
    5: (450, 300, 200, 120, 4800),     # قوچ آهنین (Battering Ram)
    6: (500, 650, 350, 100, 6000),     # منجنیق (Onager)
    7: (15000, 12000, 20000, 10000, 18000),  # سناتور (Senator)
    # GAUL
    10: (160, 100, 150, 50, 1800),     # شمشیرزن گلی (Swordman)
    11: (120, 100, 40, 30, 2400),      # ردیاب گلی (Pathfinder)
    12: (300, 250, 200, 80, 3600),     # سوار زوبین‌انداز (Theutates)
    13: (450, 300, 200, 60, 4800),     # قوچ گلی (Ram)
    14: (500, 650, 350, 60, 6000),     # بالیستا گلی (Trebuchet)
    15: (15000, 12000, 20000, 10000, 18000),  # رئیس (Chieftain)
    # TEUTON
    18: (80, 50, 60, 30, 1800),        # نیزه‌دار توتونی (Spearman)
    19: (120, 80, 40, 30, 2400),       # کاراگاه توتونی (Scout)
    20: (300, 250, 200, 80, 3600),     # سوار پالادین (Paladin)
    21: (450, 300, 200, 80, 4800),     # قوچ توتونی (Ram)
    22: (500, 650, 350, 120, 6000),    # کاتاپولت توتونی (Catapult)
    23: (15000, 12000, 20000, 10000, 18000),  # رئیس توتونی (Chief)
}

# Research prerequisites: {troop_type_id: (min_academy_level, {building_name: min_level})}
RESEARCH_PREREQUISITES = {
    # ROMAN
    2: (1, {}),                          # Praetorian - Academy 1
    3: (1, {}),                          # Scout - Academy 1
    4: (3, {'اصطبل': 1}),               # Equites Legati - Academy 3 + Stable 1
    5: (5, {'کارگاه': 1}),              # Ram - Academy 5 + Workshop 1
    6: (10, {'کارگاه': 5}),             # Onager - Academy 10 + Workshop 5
    7: (10, {'اقامتگاه': 5}),           # Senator - Academy 10 + Residence 5
    # GAUL
    10: (1, {}),                         # Swordman - Academy 1
    11: (1, {}),                         # Pathfinder - Academy 1
    12: (3, {'اصطبل': 1}),              # Theutates - Academy 3 + Stable 1
    13: (5, {'کارگاه': 1}),             # Ram - Academy 5 + Workshop 1
    14: (10, {'کارگاه': 5}),            # Trebuchet - Academy 10 + Workshop 5
    15: (10, {'اقامتگاه': 5}),          # Chieftain - Academy 10 + Residence 5
    # TEUTON
    18: (1, {}),                         # Spearman - Academy 1
    19: (1, {}),                         # Scout - Academy 1
    20: (3, {'اصطبل': 1}),              # Paladin - Academy 3 + Stable 1
    21: (5, {'کارگاه': 1}),             # Ram - Academy 5 + Workshop 1
    22: (10, {'کارگاه': 5}),            # Catapult - Academy 10 + Workshop 5
    23: (10, {'اقامتگاه': 5}),          # Chief - Academy 10 + Residence 5
}

# Troops that don't need research (basic infantry per tribe)
# ROMAN position 1 = id varies, GAUL position 1, TEUTON position 1
# These are determined by the is_basic check below

TRIBE_BASIC_TROOP_OFFSET = {
    'ROMAN': 1,   # g1 = گرزدار
    'GAUL': 9,    # g9 = جنگجوی نیزه‌دار گل
    'TEUTON': 17, # g17 = کلوب‌دار توتونی
}


def get_troop_position_in_tribe(troop_type):
    """Return the position (1-8) of a troop within its tribe."""
    tribe_offsets = {'ROMAN': 1, 'GAUL': 9, 'TEUTON': 17}
    offset = tribe_offsets.get(troop_type.tribe, 1)
    return troop_type.id - offset + 1


def is_troop_basic(troop_type):
    """Check if a troop is the basic infantry (no research needed)."""
    return get_troop_position_in_tribe(troop_type) == 1


def is_troop_researchable(troop_type):
    """Check if a troop type requires research."""
    return troop_type.id in RESEARCH_COSTS


def get_research_cost(troop_type_id):
    """Return (wood, clay, iron, crop, time_seconds) for research, or None."""
    return RESEARCH_COSTS.get(troop_type_id)


def get_research_prerequisites(troop_type_id):
    """Return (min_academy_level, {building_name: min_level}) or None."""
    return RESEARCH_PREREQUISITES.get(troop_type_id)


def check_research_prerequisites(village, troop_type_id, academy_level):
    """
    Check if research prerequisites are met for a troop type.
    Returns (met: bool, error_message: str or None).
    """
    prereqs = get_research_prerequisites(troop_type_id)
    if not prereqs:
        return True, None

    min_academy, building_reqs = prereqs

    if academy_level < min_academy:
        return False, f"آکادمی باید حداقل سطح {min_academy} باشد."

    for building_name, min_level in building_reqs.items():
        from apps.game_engine.models import VillageBuilding
        vb = VillageBuilding.objects.filter(
            village=village, building_type__name=building_name
        ).first()
        current_level = vb.level if vb else 0
        if current_level < min_level:
            return False, f"{building_name} باید حداقل سطح {min_level} باشد."

    return True, None


def calculate_research_time(base_time_seconds, academy_level):
    """Calculate actual research time based on Academy level."""
    return max(1, int(base_time_seconds / (1 + academy_level * 0.05)))
