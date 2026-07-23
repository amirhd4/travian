"""
Research costs and prerequisites for the Academy system.
Each troop type (except basic infantry) must be researched before training/upgrading.

Troop IDs (from seed_game_data.py):
  ROMAN:  1=گرزدار(Legionnaire), 2=محافظ نیزه‌دار(Praetorian), 3=امپراتوری(Imperian),
          4=کاراگاه(Scout), 5=شوالیه سوار(Equites Imperatoris), 6=سوار سناتور(Equites Caesaris),
          7=قوچ آهنین(Battering Ram), 8=منجنیق(Onager), 9=سناتور(Senator), 10=مهاجر(Settler)
  GAUL:   11=جنگجوی نیزه‌دار گل(Phalanx), 12=شمشیرزن گلی(Swordsman), 13=ردیاب گلی(Pathfinder),
          14=سوار زوبین‌انداز(Theutates Thunder), 15=سوار دروید(Druidrider), 16=سوار هیدوان(Haeduan),
          17=قوچ گلی(Battering Ram), 18=بالیستا گلی(Ballista), 19=رئیس(Chieftain), 20=مهاجر گلی(Settler)
  TEUTON: 21=کلوب‌دار توتونی(Clubswinger), 22=نیزه‌دار توتونی(Spearman), 23=تبردار توتونی(Axeman),
          24=کاراگاه توتونی(Scout), 25=سوار پالادین(Paladin), 26=شوالیه توتونی(Teutonic Knight),
          27=قوچ توتونی(Battering Ram), 28=کاتاپولت توتونی(Catapult), 29=رئیس توتونی(Chief), 30=مهاجر توتونی(Settler)
"""

from apps.combat.models import TroopType

# ═══════════════════════════════════════════════════════════════
# Research costs: {troop_type_id: (wood, clay, iron, crop, time_seconds)}
# Source: GameEngine/Data/resdata.php ($r2-$r9, $r12-$r19, $r22-$r29)
# ═══════════════════════════════════════════════════════════════
RESEARCH_COSTS = {
    # ── ROMAN ──
    2: (700, 620, 1480, 580, 7080),       # محافظ نیزه‌دار (Praetorian)
    3: (1000, 740, 1880, 640, 7560),       # امپراتوری (Imperian)
    4: (940, 740, 360, 400, 5880),         # کاراگاه (Equites Legati / Scout)
    5: (3400, 1860, 2760, 760, 9720),      # شوالیه سوار (Equites Imperatoris)
    6: (3400, 2660, 6600, 1240, 12360),    # سوار سناتور (Equites Caesaris)
    7: (5500, 1540, 4200, 580, 15600),     # قوچ آهنین (Battering Ram)
    8: (5800, 5500, 5000, 700, 28800),     # منجنیق (Fire Catapult / Onager)
    9: (15880, 13800, 36400, 22660, 24475),  # سناتور (Senator)
    # ── GAUL ──
    12: (940, 700, 1680, 520, 6120),       # شمشیرزن گلی (Swordsman)
    13: (1120, 700, 360, 400, 5880),       # ردیاب گلی (Pathfinder)
    14: (2200, 1900, 2040, 520, 9240),     # سوار زوبین‌انداز (Theutates Thunder)
    15: (2260, 1420, 2440, 880, 9480),     # سوار دروید (Druidrider)
    16: (3100, 2580, 5600, 1180, 11160),   # سوار هیدوان (Haeduan)
    17: (5800, 2320, 2840, 610, 16800),    # قوچ گلی (Battering Ram)
    18: (5860, 5900, 5240, 700, 28800),    # بالیستا گلی (Ballista)
    19: (15880, 22900, 25200, 22660, 24475),  # رئیس (Chieftain)
    # ── TEUTON ──
    22: (970, 380, 880, 400, 5160),        # نیزه‌دار توتونی (Spearman)
    23: (1010, 940, 1390, 650, 5400),      # تبردار توتونی (Axeman)
    24: (1220, 800, 550, 510, 5160),       # کاراگاه توتونی (Scout)
    25: (1310, 1205, 1080, 500, 9480),     # سوار پالادین (Paladin)
    26: (1200, 1480, 1640, 450, 11160),    # شوالیه توتونی (Teutonic Knight)
    27: (2250, 1330, 835, 230, 16800),     # قوچ توتونی (Battering Ram)
    28: (1135, 1710, 770, 130, 28800),     # کاتاپولت توتونی (Catapult)
    29: (18250, 13500, 20400, 16480, 19425),  # رئیس توتونی (Chief)
}

# ═══════════════════════════════════════════════════════════════
# Research prerequisites: {troop_type_id: (min_academy_level, {building_name: min_level})}
# Source: Technology.php::meetRRequirement()
# ═══════════════════════════════════════════════════════════════
RESEARCH_PREREQUISITES = {
    # ── ROMAN ──
    2: (1, {}),                              # Praetorian — Academy 1
    3: (5, {'آهنگری': 1}),                   # Imperian — Academy 5 + Blacksmith 1
    4: (5, {'اصطبل': 1}),                    # Equites Legati — Academy 5 + Stable 1
    5: (5, {'اصطبل': 5}),                    # Equites Imperatoris — Academy 5 + Stable 5
    6: (5, {'اصطبل': 10}),                   # Equites Caesaris — Academy 5 + Stable 10
    7: (10, {'کارگاه': 1}),                  # Battering Ram — Academy 10 + Workshop 1
    8: (15, {'کارگاه': 10}),                 # Fire Catapult — Academy 15 + Workshop 10
    9: (20, {'میدان تجمع': 10}),             # Senator — Academy 20 + Rally Point 10
    # ── GAUL ──
    12: (3, {'آهنگری': 1}),                  # Swordsman — Academy 3 + Blacksmith 1
    13: (5, {'اصطبل': 1}),                   # Pathfinder — Academy 5 + Stable 1
    14: (5, {'اصطبل': 3}),                   # Theutates Thunder — Academy 5 + Stable 3
    15: (5, {'اصطبل': 5}),                   # Druidrider — Academy 5 + Stable 5
    16: (15, {'اصطبل': 10}),                 # Haeduan — Academy 15 + Stable 10
    17: (10, {'کارگاه': 1}),                 # Battering Ram — Academy 10 + Workshop 1
    18: (15, {'کارگاه': 10}),                # Ballista — Academy 15 + Workshop 10
    19: (20, {'میدان تجمع': 10}),            # Chieftain — Academy 20 + Rally Point 10
    # ── TEUTON ──
    22: (1, {'آهنگری': 3}),                  # Spearman — Academy 1 + Blacksmith 3
    23: (3, {'پادگان': 1}),                  # Axeman — Academy 3 + Barracks 1
    24: (1, {'ساختمان اصلی': 5}),            # Scout — Academy 1 + Main Building 5
    25: (5, {'اصطبل': 5}),                   # Paladin — Academy 5 + Stable 5
    26: (15, {'اصطبل': 10}),                 # Teutonic Knight — Academy 15 + Stable 10
    27: (10, {'کارگاه': 1}),                 # Battering Ram — Academy 10 + Workshop 1
    28: (15, {'کارگاه': 10}),                # Catapult — Academy 15 + Workshop 10
    29: (20, {'میدان تجمع': 5}),             # Chief — Academy 20 + Rally Point 5
}

# ═══════════════════════════════════════════════════════════════
# Troop descriptions (Persian) — displayed in Academy
# ═══════════════════════════════════════════════════════════════
TROOP_DESCRIPTIONS = {
    # ── ROMAN ──
    1: "سرباز پایه رومی با سپر و شمشیر. متعادل در حمله و دفاع، مناسب برای نبردهای اولیه و دفاع از روستا.",
    2: "محافظ نخبه امپراتوری رومی با دفاع بسیار بالا در برابر پیاده‌نظام. سنگربانان امپراتور که هرگز عقب نمی‌نشینند.",
    3: "سرباز تهاجمی رومی با قدرت حمله بالا و زره فولادی. نیروی اصلی حملات رومی که با شمشیر دو دستی می‌جنگد.",
    4: "اسب سبک سواره رومی برای شناسایی و ارسال پیام. سرعت بالا اما بدون قدرت حمله، مناسب برای اطلاعات‌رسانی.",
    5: "سواره سبک رومی با حمله قوی و سرعت مناسب. شوالیه‌های سواره که با نیزه و شمشیر حمله می‌کنند.",
    6: "سواره سنگین رومی با قدرت حمله و دفاع بسیار بالا. زره‌پوشان سزار که خطوط دشمن را در هم می‌شکنند.",
    7: "قورچ آهنین برای تخریب دیوارهای دشمن. ضروری برای حمله به شهرهای مستحکم و شکستن استحکامات.",
    8: "منجنیق آتشین برای تخریب ساختمان‌ها و دیوارها. قدرت تخریب بسیار بالا اما زمان آموزش طولانی.",
    9: "سناتور رومی، رهبر سیاسی قبیله. با سخنوری و نفوذ خود می‌تواند وفاداری روستاهای دشمن را کاهش دهد.",
    10: "مهاجران رومی برای تأسیس روستای جدید. هر گروه مهاجران یک روستای جدید در سرزمینی نو تأسیس می‌کند.",
    # ── GAUL ──
    11: "سرباز پایه گولی با نیزه بلند و سپر چوبی. دفاع بالا در برابر سواره، مناسب برای تشکیل خط دفاعی.",
    12: "شمشیرزن گولی با حمله قوی و سرعت مناسب. جنگجویان آزادی که با شمشیر بلند گولی می‌جنگند.",
    13: "اسب سبک گولی برای شناسایی. سریع‌ترین نیروی شناسایی در بازی که از جنگل‌های گالیا عبور می‌کند.",
    14: "سواره سبک گولی با حمله قوی و سرعت بسیار بالا. رعد و برق گالیا که دشمن را غافلگیر می‌کنند.",
    15: "سواره دفاعی گولی با دفاع بسیار بالا در برابر پیاده‌نظام. درویدهای مقدس با قدرت جادویی.",
    16: "سواره سنگین گولی با قدرت حمله و دفاع بالا. شوالیه‌های هیدوان که از خاندان‌های اشرافی گالی هستند.",
    17: "قورچ گولی برای تخریب دیوارها. دفاع بالا در برابر سواره به لطف سپرهای بزرگ چوبی.",
    18: "بالیستای گولی برای تخریب ساختمان‌ها و دیوارها. ماشین جنگی با دقت بالا و قدرت تخریب چشمگیر.",
    19: "رئیس قبیله گولی، رهبر سیاسی و نظامی. با نفوذ و تجربه خود می‌تواند وفاداری روستاهای دشمن را کاهش دهد.",
    20: "مهاجران گولی برای تأسیس روستای جدید. خانواده‌های گولی که به دنبال سرزمینی جدید هستند.",
    # ── TEUTON ──
    21: "سرباز پایه توتنی با گرز سنگین. حمله بالا و هزینه کم، مناسب برای حملات گروهی اولیه و غارت منابع.",
    22: "نیزه‌دار توتنی با دفاع بسیار بالا در برابر سواره. خط اول دفاع توتن‌ها در برابر حملات سواره.",
    23: "تبردار توتنی با حمله قوی و سرعت مناسب. جنگجویان وحشی که با تبر دو دستی خطوط دشمن را می‌شکنند.",
    24: "جاسوس توتنی برای شناسایی و اطلاعات. سرعت متوسط اما دفاع مناسب، مناسب برای کشف نیروهای دشمن.",
    25: "سواره توتنی با دفاع بالا و حمله مناسب. پالادین‌های مقدس با زره سنگین و شمشیر قدرتمند.",
    26: "شوالیه توتنی با قدرت حمله بسیار بالا. قوی‌ترین نیروی تهاجمی توتن‌ها که با شمشیر و نیزه می‌جنگند.",
    27: "قورچ توتنی برای تخریب دیوارها. حمله بالا در برابر ساختمان‌ها به لطف وزن سنگین آهنی.",
    28: "کاتاپولت توتنی برای تخریب ساختمان‌ها و دیوارها. ماشین جنگی با قدرت تخریب بسیار بالا.",
    29: "رئیس توتنی، رهبر سیاسی قبیله. با قدرت و نفوذ خود می‌تواند وفاداری روستاهای دشمن را کاهش دهد.",
    30: "مهاجران توتنی برای تأسیس روستای جدید. قبیله‌های توتنی که به دنبال سرزمینی جدید هستند.",
}

# ═══════════════════════════════════════════════════════════════
# Basic troop per tribe (no research needed)
# ═══════════════════════════════════════════════════════════════
TRIBE_BASIC_TROOP_OFFSET = {
    'ROMAN': 1,   # گرزدار (Legionnaire)
    'GAUL': 11,   # جنگجوی نیزه‌دار گل (Phalanx)
    'TEUTON': 21, # کلوب‌دار توتونی (Clubswinger)
}


def get_troop_position_in_tribe(troop_type):
    """Return the position (1-10) of a troop within its tribe."""
    offset = TRIBE_BASIC_TROOP_OFFSET.get(troop_type.tribe, 1)
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


def get_troop_description(troop_type_id):
    """Return Persian description for a troop type, or None."""
    return TROOP_DESCRIPTIONS.get(troop_type_id)


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
