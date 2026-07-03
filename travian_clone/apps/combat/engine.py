from apps.game_engine.models import Village, GameLog


def calculate_catapult_damage(catapults, target_current_level):
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
        catapult_target=None,
        catapult_count=0
):

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

        demolition_level = (
            calculate_catapult_damage(
                catapult_count,
                wall_level
            )
            if catapult_target else 0
        )

    else:

        victory = "defender"

        attacker_loss_ratio = 1.0

        defender_loss_ratio = (
            (total_attack / total_defense) ** 0.7
            if total_defense else 0
        )

        demolition_level = 0

    return {
        "victory": victory,
        "attacker_loss_percent": attacker_loss_ratio * 100,
        "defender_loss_percent": defender_loss_ratio * 100,
        "building_demolished_to": demolition_level,
    }