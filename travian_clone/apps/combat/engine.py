def calculate_catapult_damage(catapults, target_current_level):
    """
    فرمول کاهش سطح یک ساختمان (دیوار یا هر ساختمان دیگر) بر اساس تعداد
    واحدهای محاصره‌ای (قوچ یا منجنیق) اعزامی و سطح فعلی آن ساختمان.
    این تابع برای هم «قوچ روی دیوار» و هم «منجنیق روی ساختمان انتخابی»
    یکسان استفاده می‌شود (دقیقا مثل تراوین اصلی که هر دو از یک فرمول
    استفاده می‌کنند، فقط هدفشان فرق دارد).
    """
    needed_catapults = round(
        ((2 * (target_current_level ** 2) - 2 * target_current_level + 2) / 8)
    )

    reduction = int(
        catapults / (needed_catapults + 1) * target_current_level
    )

    return max(0, target_current_level - reduction)


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