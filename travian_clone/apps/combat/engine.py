TROOP_POPULATION_DIVISOR = 30  # ✅ جدید


def troop_population_value(troop_type):
    """
    ارزش «جمعیتی» تقریبی هر واحد از این نوع نیرو - برای محاسبه‌ی امتیاز
    مهاجم/مدافع در رتبه‌بندی‌ها و مدال‌ها. هرچه نیرو گران‌تر باشد (منابع
    بیشتری خورده)، کشتنش یا از دست دادنش ارزش بیشتری دارد - دقیقا مثل
    فرمول جمعیتِ ساختمان‌ها (calculate_building_population) اما با
    مقیاس مخصوص نیرو.
    """
    total_cost = (
        troop_type.wood_cost + troop_type.clay_cost +
        troop_type.iron_cost + troop_type.crop_cost
    )
    return total_cost / TROOP_POPULATION_DIVISOR


def calculate_demolition_by_defender_casualties(defender_loss_percent, target_current_level, is_ww=False):
    """
    فرمول تخریب ساختمان بر اساس درصد تلفات مدافع (طبق مشخصات §13).

    - آستانه: حداقل 5% تلفات مدافع برای شروع تخریب
    - در 5%: تخریب پایه 2 سطح
    - بین 5%-70%: مقیاس متناسب
    - در 70%: تخریب 100% (تخریب کامل ساختمان)
    - برای شگفتی جهان: تخریب سخت‌تر (10% = 10% از کل سطوح)

    Args:
        defender_loss_percent: درصد تلفات مدافع (0-100)
        target_current_level: سطح فعلی ساختمان هدف
        is_ww: آیا ساختمان شگفتی جهان است؟

    Returns:
        سطح جدید ساختمان بعد از تخریب
    """
    if defender_loss_percent < 5:
        return target_current_level

    if is_ww:
        # تخریب شگفتی جهان: مقیاس سخت‌تر
        # 10% تلفات = 10% از کل سطوح تخریب
        demolition_percent = defender_loss_percent / 100
        levels_destroyed = target_current_level * demolition_percent
    else:
        # ساختمان‌های معمولی: مقیاس متناسب
        # 5% تلفات = 2 سطح تخریب
        # 70% تلفات = تخریب کامل
        if defender_loss_percent >= 70:
            return 0
        # مقیاس خطی از 2 سطح (در 5%) تا کامل (در 70%)
        scale = (defender_loss_percent - 5) / (70 - 5)
        levels_destroyed = 2 + scale * (target_current_level - 2)

    new_level = target_current_level - int(round(levels_destroyed))
    return max(0, new_level)


def calculate_combat(
        attacker_troops,
        defender_troops,
        wall_level=0,
):
    """
    محاسبه‌ی نتیجه‌ی خام نبرد (برنده + درصد تلفات هر طرف).

    ⚠️ توجه: محاسبه‌ی آسیب به دیوار (توسط قوچ) و آسیب به ساختمان‌های دیگر
    (توسط منجنیق) دیگر داخل این تابع انجام نمی‌شود - چون منجنیق باید
    بتواند یک ساختمان مشخص یا تصادفی را هدف بگیرد که این انتخاب باید در
    سطح بالاتر (apps/combat/tasks.py) مدیریت شود. اینجا فقط نتیجه‌ی خالص
    نبرد (برد/باخت و درصد تلفات) محاسبه می‌شود.
    """
    wall_bonus = 1 + (wall_level * 0.03)

    total_attack = attacker_troops["points_attack"]

    total_defense = (
        defender_troops["points_def_infantry"] +
        defender_troops["points_def_cavalry"]
    ) * wall_bonus

    if total_attack > total_defense:
        victory = "attacker"
        attacker_loss_ratio = (
            (total_defense / total_attack) ** 0.7
            if total_attack else 0
        )
        defender_loss_ratio = 1.0
    else:
        victory = "defender"
        attacker_loss_ratio = 1.0
        defender_loss_ratio = (
            (total_attack / total_defense) ** 0.7
            if total_defense else 0
        )

    return {
        "victory": victory,
        "attacker_loss_percent": attacker_loss_ratio * 100,
        "defender_loss_percent": defender_loss_ratio * 100,
    }