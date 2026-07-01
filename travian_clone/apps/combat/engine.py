import math


def calculate_combat(attacker_troops, defender_troops, wall_level, catapult_target=None, catapult_count=0):
    # اعمال بونوس دیوار شهر به دفاع (هر لول ۳ درصد) [cite: 88]
    wall_bonus = 1.0 + (wall_level * 0.03)
    total_defense = (defender_troops['points_def_infantry'] + defender_troops['points_def_infantry']) * wall_bonus
    total_attack = attacker_troops['points_attack']

    if total_attack > total_defense:
        victory = "attacker"
        # فرمول محاسبه تلفات بر اساس نسبت توان [cite: 89]
        loss_ratio_attacker = (total_defense / total_attack) ** 0.7
        loss_ratio_defender = 1.0

        # محاسبه تخریب منجنیق در صورت پیروزی مهاجم [cite: 90]
        demolition_level = calculate_catapult_damage(catapult_count, wall_level) if catapult_target else 0
    else:
        victory = "defender"
        loss_ratio_attacker = 1.0
        loss_ratio_defender = (total_attack / total_defense) ** 0.7
        demolition_level = 0

    return {"victory": victory, "attacker_loss_percent": loss_ratio_attacker * 100,
            "defender_loss_percent": loss_ratio_defender * 100, "building_demolished_to": demolition_level}


def calculate_catapult_damage(catapults, target_current_level):
    # فرمول تخریب بر اساس تعداد منجنیق‌ها [cite: 91]
    needed_catapults = round(((2 * (target_current_level ** 2) - 2 * target_current_level + 2) / 8))
    reduction = int(catapults / (needed_catapults + 1) * target_current_level)
    return max(0, target_current_level - reduction)