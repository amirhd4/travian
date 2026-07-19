from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Count

import datetime

from .models import (
    TroopMovement, VillageTroop, TroopType, Hero, PlayerHeroItem, Animal, VillageAnimal,
    TrainingQueue, Adventure, FarmListEntry, FarmList, TroopUpgrade, CombatReport, TrappedTroop,
    TroopEvasionSetting,
)
from .movement_utils import dispatch_troop_movement
from .tasks import resolve_hero_adventure
from apps.game_engine.engine import schedule_game_event
from .hero_utils import sync_hero_health, calculate_travel_seconds_to_point, DIFFICULTY_SETTINGS
from apps.game_engine.models import Village, GameLog, VillageBuilding, ServerSetting

from .utils import get_required_training_buildings



class SendTroopsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        movement_type = request.data.get('movement_type', 'ATTACK')
        payload = request.data.get('troops_payload', {})
        send_hero = bool(request.data.get('send_hero', False))
        catapult_target_building = request.data.get('catapult_target_building') or None  # âœ… Ø¬Ø¯ÛŒØ¯

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
            target_village = Village.objects.get(id=target_id)
        except Village.DoesNotExist:
            return Response({"error": "Ù…Ø¨Ø¯Ø§ ÛŒØ§ Ù…Ù‚ØµØ¯ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        success, result = dispatch_troop_movement(
            request.user, source_village, target_village, movement_type, payload,
            send_hero=send_hero,
            catapult_target_building=catapult_target_building,  # âœ… Ø¬Ø¯ÛŒØ¯
        )
        if not success:
            return Response({"error": result}, status=400)

        return Response({"message": "Ù†ÛŒØ±ÙˆÙ‡Ø§ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§Ø¹Ø²Ø§Ù… Ø´Ø¯Ù†Ø¯ Ùˆ Ø¯Ø± Ø²Ù…Ø§Ù† Ù…Ù‚Ø±Ø± Ø¨Ù‡ Ù…Ù‚ØµØ¯ Ù…ÛŒâ€ŒØ±Ø³Ù†Ø¯."})


class BarracksTrainView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.game_engine.utils import is_server_finished
        if is_server_finished():
            return Response({"error": "Ø§ÛŒÙ† Ø³Ø±ÙˆØ± Ø¨Ù‡ Ù¾Ø§ÛŒØ§Ù† Ø±Ø³ÛŒØ¯Ù‡ Ùˆ Ø¯ÛŒÚ¯Ø± Ø§Ù…Ú©Ø§Ù† Ø¢Ù…ÙˆØ²Ø´ Ù†ÛŒØ±Ùˆ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯."}, status=400)

        village_id = request.data.get('village_id')
        troop_type_id = request.data.get('troop_type')
        quantity = int(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({"error": "ØªØ¹Ø¯Ø§Ø¯ Ù†ÛŒØ±Ùˆ Ø¨Ø±Ø§ÛŒ Ø¢Ù…ÙˆØ²Ø´ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)

        try:
            troop_info = TroopType.objects.get(id=troop_type_id, tribe=request.user.tribe)
        except TroopType.DoesNotExist:
            return Response({"error": "Ø§ÛŒÙ† Ù†ÛŒØ±Ùˆ Ù…Ø®ØªØµ Ù†Ú˜Ø§Ø¯ Ø´Ù…Ø§ Ù†ÛŒØ³Øª ÛŒØ§ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯."}, status=400)

        total_cost = {
            'wood': troop_info.wood_cost * quantity,
            'clay': troop_info.clay_cost * quantity,
            'iron': troop_info.iron_cost * quantity,
            'crop': troop_info.crop_cost * quantity,
        }

        try:
            with transaction.atomic():
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)

                required_buildings = get_required_training_buildings(troop_info)
                if not VillageBuilding.objects.filter(
                        village=village, building_type__name__in=required_buildings, level__gt=0
                ).exists():
                    names_display = " ÛŒØ§ ".join(required_buildings)
                    return Response(
                        {"error": f"Ø¨Ø±Ø§ÛŒ Ø¢Ù…ÙˆØ²Ø´ {troop_info.name} Ø§Ø¨ØªØ¯Ø§ Ø¨Ø§ÛŒØ¯ ÛŒÚ© Â«{names_display}Â» Ø¯Ø± Ø§ÛŒÙ† Ø¯Ù‡Ú©Ø¯Ù‡ Ø¨Ø³Ø§Ø²ÛŒØ¯."},
                        status=400
                    )

                # âœ… Ø¬Ø¯ÛŒØ¯: Ù†ÛŒØ§Ø²Ù…Ù†Ø¯ÛŒ Ø¢Ú©Ø§Ø¯Ù…ÛŒ Ø¨Ø±Ø§ÛŒ Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ø±Ø¯Ù‡â€ŒØ¨Ø§Ù„Ø§ØªØ± (Ù‚Ø¨Ù„Ø§ Ø¢Ú©Ø§Ø¯Ù…ÛŒ Ù‡ÛŒÚ† Ø§Ø«Ø±ÛŒ Ù†Ø¯Ø§Ø´Øª)
                if troop_info.required_academy_level > 0:
                    academy_level = VillageBuilding.objects.filter(
                        village=village, building_type__name="Ø¢Ú©Ø§Ø¯Ù…ÛŒ"
                    ).values_list('level', flat=True).first() or 0
                    if academy_level < troop_info.required_academy_level:
                        return Response(
                            {
                                "error": f"Ø¨Ø±Ø§ÛŒ Ø¢Ù…ÙˆØ²Ø´ {troop_info.name} Ø¨Ù‡ Ø¢Ú©Ø§Ø¯Ù…ÛŒ Ø³Ø·Ø­ {troop_info.required_academy_level} ÛŒØ§ Ø¨Ø§Ù„Ø§ØªØ± Ù†ÛŒØ§Ø² Ø¯Ø§Ø±ÛŒØ¯ (Ø³Ø·Ø­ ÙØ¹Ù„ÛŒ Ø¢Ú©Ø§Ø¯Ù…ÛŒ: {academy_level})."},
                            status=400
                        )

                # Ø¨Ø±Ø±Ø³ÛŒ Ø¯Ù‚ÛŒÙ‚ Ù…ÙˆØ¬ÙˆØ¯ÛŒ
                if (village.wood < total_cost['wood'] or
                        village.clay < total_cost['clay'] or
                        village.iron < total_cost['iron'] or
                        village.crop < total_cost['crop']):
                    return Response({"error": "Ù…Ù†Ø§Ø¨Ø¹ Ø¯Ù‡Ú©Ø¯Ù‡ Ø¨Ø±Ø§ÛŒ Ø¢Ù…ÙˆØ²Ø´ Ø§ÛŒÙ† ØªØ¹Ø¯Ø§Ø¯ Ù†ÛŒØ±Ùˆ Ú©Ø§ÙÛŒ Ù†ÛŒØ³Øª."}, status=400)

                # Ú©Ø³Ø± Ù…Ù†Ø§Ø¨Ø¹ Ù‡Ù…ÛŒÙ† Ø§Ù„Ø§Ù† Ø§Ù†Ø¬Ø§Ù… Ù…ÛŒâ€ŒØ´ÙˆØ¯ (Ø³Ø±Ù…Ø§ÛŒÙ‡â€ŒÚ¯Ø°Ø§Ø±ÛŒ Ø¯Ø± ØµÙ Ø¢Ù…ÙˆØ²Ø´)
                village.wood -= total_cost['wood']
                village.clay -= total_cost['clay']
                village.iron -= total_cost['iron']
                village.crop -= total_cost['crop']
                village.save()

                from apps.game_engine.artifacts import get_training_speed_multiplier
                from .hero_utils import get_hero_training_speed_bonus_percent  # âœ… Ø¬Ø¯ÛŒØ¯

                raw_duration = troop_info.base_train_time * quantity
                artifact_multiplier = get_training_speed_multiplier(request.user)

                hero_training_bonus_percent = get_hero_training_speed_bonus_percent(request.user, troop_info)  # âœ… Ø¬Ø¯ÛŒØ¯
                hero_training_multiplier = 1 + (hero_training_bonus_percent / 100)

                duration_after_artifact = raw_duration / artifact_multiplier / hero_training_multiplier  # âœ… Ø¨Ù‡â€ŒØ±ÙˆØ²Ø´Ø¯Ù‡

                # âœ… FIX Ù‡Ù…Ø²Ù…Ø§Ù†: Ù‚Ø¨Ù„Ø§ finishes_at (Ø´Ù…Ø§Ø±Ø´ Ù…Ø¹Ú©ÙˆØ³ UI) Ø§ØµÙ„Ø§ Ø³Ø±Ø¹Øª
                # Ø¢Ù…ÙˆØ²Ø´ Ø³Ø±ÙˆØ± (troop_training_speed) Ø±Ø§ Ù„Ø­Ø§Ø¸ Ù†Ù…ÛŒâ€ŒÚ©Ø±Ø¯Ø› ÙÙ‚Ø· Ø²Ù…Ø§Ù†
                # ÙˆØ§Ù‚Ø¹ÛŒÙ ØªÚ©Ù…ÛŒÙ„ (Ø§Ø² Ø·Ø±ÛŒÙ‚ schedule_game_event) Ø§ÛŒÙ† Ø³Ø±Ø¹Øª Ø±Ø§
                # Ø§Ø¹Ù…Ø§Ù„ Ù…ÛŒâ€ŒÚ©Ø±Ø¯ -> Ø±ÙˆÛŒ Ø³Ø±ÙˆØ±Ù‡Ø§ÛŒ Ù¾Ø±Ø³Ø±Ø¹ØªØŒ Ø¹Ø¯Ø¯ Ù†Ù…Ø§ÛŒØ´â€ŒØ¯Ø§Ø¯Ù‡â€ŒØ´Ø¯Ù‡ Ø¨Ù‡
                # Ø¨Ø§Ø²ÛŒÚ©Ù† Ø§Ø´ØªØ¨Ø§Ù‡ (Ø®ÛŒÙ„ÛŒ Ø¨ÛŒØ´ØªØ± Ø§Ø² ÙˆØ§Ù‚Ø¹ÛŒØª) Ø¨ÙˆØ¯.
                server_settings = ServerSetting.objects.filter(is_active=True).first()
                training_speed = (server_settings.troop_training_speed if server_settings else 1) or 1
                display_duration = duration_after_artifact / training_speed
                finishes_at = timezone.now() + datetime.timedelta(seconds=max(0.1, display_duration))

                queue_item = TrainingQueue.objects.create(
                    village=village,
                    troop_type=troop_info,
                    count=quantity,
                    finishes_at=finishes_at,
                )

                GameLog.objects.create(
                    village=village,
                    log_type='BUILDING',
                    description=f"Ø¢Ù…ÙˆØ²Ø´ {quantity} Ø³Ø±Ø¨Ø§Ø² {troop_info.name} Ø¯Ø± Ù¾Ø§Ø¯Ú¯Ø§Ù† Ø¢ØºØ§Ø² Ø´Ø¯."
                )

                transaction.on_commit(lambda: schedule_game_event(
                    village_id=village.id,
                    event_type="TROOP_RECRUITMENT",
                    base_duration_seconds=duration_after_artifact,
                    # âœ… Ø§Ø«Ø± Ú©ØªÛŒØ¨Ù‡ Ø§Ø² Ù‚Ø¨Ù„ Ø§Ø¹Ù…Ø§Ù„ Ø´Ø¯Ù‡Ø› Ø³Ø±Ø¹Øª Ø³Ø±ÙˆØ± Ø¯Ø§Ø®Ù„ Ø®ÙˆØ¯Ù schedule_game_event Ø§Ø¹Ù…Ø§Ù„ Ù…ÛŒâ€ŒØ´ÙˆØ¯
                    details={"troop_id": troop_info.id, "count": quantity, "queue_id": queue_item.id}
                ))

            return Response({
                "message": (
                    f"Ø¢Ù…ÙˆØ²Ø´ {quantity} {troop_info.name} Ø¯Ø± ØµÙ Ù¾Ø§Ø¯Ú¯Ø§Ù† Ù‚Ø±Ø§Ø± Ú¯Ø±ÙØª "
                    f"Ùˆ Ù¾Ø³ Ø§Ø² Ø§ØªÙ…Ø§Ù…ØŒ Ø¨Ù‡â€ŒØ·ÙˆØ± Ø®ÙˆØ¯Ú©Ø§Ø± Ø¨Ù‡ Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ø¯Ù‡Ú©Ø¯Ù‡ Ø§Ø¶Ø§ÙÙ‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯."
                )
            })

        except Village.DoesNotExist:
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ Ù…ÙˆØ±Ø¯ Ù†Ø¸Ø± ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)


class TroopTypeCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # âœ… ÙÙ‚Ø· Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ù†Ú˜Ø§Ø¯ Ø®ÙˆØ¯ Ø¨Ø§Ø²ÛŒÚ©Ù† (Ù†Ø§ØªØ§Ø± Ù‡Ø±Ú¯Ø² Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯)
        troop_types = TroopType.objects.filter(tribe=request.user.tribe).order_by('id')
        return Response([
            {
                "id": t.id,
                "name": t.name,
                "tribe": t.tribe,
                "attack_power": t.attack_power,
                "defense_infantry": t.defense_infantry,
                "defense_cavalry": t.defense_cavalry,
                "speed": t.speed,
                "carry_capacity": t.carry_capacity,
                "is_siege_weapon": t.is_siege_weapon,
                "is_settler": t.is_settler,
                "is_scout": t.is_scout,
                "costs": {
                    "wood": t.wood_cost, "clay": t.clay_cost,
                    "iron": t.iron_cost, "crop": t.crop_cost,
                },
                "crop_upkeep": t.crop_upkeep,
                "base_train_time": t.base_train_time,
                "is_cavalry": t.is_cavalry,
                "required_building": " ÛŒØ§ ".join(get_required_training_buildings(t)),
                "required_academy_level": t.required_academy_level,
            }
            for t in troop_types
        ])


class VillageTroopListView(APIView):
    """Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ ÙˆØ§Ù‚Ø¹ÛŒ Ù…Ø³ØªÙ‚Ø± Ø¯Ø± ÛŒÚ© Ø¯Ù‡Ú©Ø¯Ù‡ Ù…Ø´Ø®Øµ (Ø¨Ø±Ø§ÛŒ Ù¾Ø± Ú©Ø±Ø¯Ù† ÙØ±Ù…â€ŒÙ‡Ø§ÛŒ Ø§Ø¹Ø²Ø§Ù… Ù†ÛŒØ±Ùˆ)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

        troops = VillageTroop.objects.filter(village=village, count__gt=0).select_related('troop_type')
        return Response([
            {
                "troop_type_id": vt.troop_type.id,
                "name": vt.troop_type.name,
                "count": vt.count,
                "is_scout": vt.troop_type.is_scout,
                "is_settler": vt.troop_type.is_settler,
            }
            for vt in troops
        ])


class TrainingQueueView(APIView):
    """ØµÙ Ø¢Ù…ÙˆØ²Ø´ ÙØ¹Ø§Ù„ ÛŒÚ© Ø¯Ù‡Ú©Ø¯Ù‡ Ù…Ø´Ø®ØµØŒ Ø¨Ù‡ Ù‡Ù…Ø±Ø§Ù‡ Ø²Ù…Ø§Ù† Ø¨Ø§Ù‚ÛŒâ€ŒÙ…Ø§Ù†Ø¯Ù‡ Ù‡Ø± Ø¨Ú†."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

        queue = TrainingQueue.objects.filter(village=village, is_completed=False).select_related('troop_type')
        now = timezone.now()
        return Response([
            {
                "id": q.id,
                "troop_name": q.troop_type.name,
                "count": q.count,
                "finishes_at": q.finishes_at,
                "remaining_seconds": max(0, int((q.finishes_at - now).total_seconds())),
            }
            for q in queue
        ])


class HeroView(APIView):
    """Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù‚Ù‡Ø±Ù…Ø§Ù† Ø¨Ø§Ø²ÛŒÚ©Ù† ÙØ¹Ù„ÛŒ + Ú©ÙˆÙ„Ù‡â€ŒÙ¾Ø´ØªÛŒ Ø§Ùˆ + ÙˆØ¶Ø¹ÛŒØª Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hero, _ = Hero.objects.get_or_create(player=request.user)
        hero = sync_hero_health(hero)
        inventory = PlayerHeroItem.objects.filter(hero=hero).select_related('item')

        remaining_seconds = None
        if hero.is_on_adventure and hero.adventure_returns_at:
            remaining_seconds = max(0, int((hero.adventure_returns_at - timezone.now()).total_seconds()))

        return Response({
            "level": hero.level,
            "experience": hero.experience,
            "health": round(hero.health, 1),
            "is_alive": hero.is_alive,
            "is_on_adventure": hero.is_on_adventure,
            "adventure_remaining_seconds": remaining_seconds,
            "home_village_id": hero.home_village_id,
            "is_away": hero.is_away,

            # âœ… Ø¬Ø¯ÛŒØ¯: Ø§Ù…ØªÛŒØ§Ø²Ø§Øª Ù‚Ø§Ø¨Ù„ ØªØ®ØµÛŒØµ Ù‚Ù‡Ø±Ù…Ø§Ù†
            "fighting_strength_points": hero.fighting_strength_points,
            "off_bonus_points": hero.off_bonus_points,
            "def_bonus_points": hero.def_bonus_points,
            "resource_points": hero.resource_points,
            "resource_production_type": hero.resource_production_type,
            "participates_in_defense": hero.participates_in_defense,
            "total_attribute_points": hero.total_attribute_points,
            "available_attribute_points": hero.available_attribute_points,

            "appearance": {
                "gender": hero.gender,
                "head_style": hero.head_style,
                "hair_color": hero.hair_color,
                "hair_style": hero.hair_style,
                "ear_style": hero.ear_style,
                "eyebrow_style": hero.eyebrow_style,
                "eye_style": hero.eye_style,
                "nose_style": hero.nose_style,
                "mouth_style": hero.mouth_style,
                "options_count": Hero.APPEARANCE_OPTION_COUNT,
            },

            "inventory": [
                {
                    "id": inv.id, "item_id": inv.item.id, "name": inv.item.name,
                    "item_type": inv.item.item_type,
                    "attack_bonus": inv.item.attack_bonus,
                    "defense_bonus": inv.item.defense_bonus,
                    "speed_bonus": inv.item.speed_bonus,
                    # âœ… Ø¬Ø¯ÛŒØ¯
                    "experience_bonus_percent": inv.item.experience_bonus_percent,
                    "infantry_training_speed_percent": inv.item.infantry_training_speed_percent,
                    "cavalry_training_speed_percent": inv.item.cavalry_training_speed_percent,
                    "infantry_attack_bonus_percent": inv.item.infantry_attack_bonus_percent,
                    "infantry_defense_bonus_percent": inv.item.infantry_defense_bonus_percent,
                    "cavalry_attack_bonus_percent": inv.item.cavalry_attack_bonus_percent,
                    "cavalry_defense_bonus_percent": inv.item.cavalry_defense_bonus_percent,
                    "is_equipped": inv.is_equipped,
                }
                for inv in inventory
            ]
        })


class HeroEquipItemView(APIView):
    """Ù¾ÙˆØ´ÛŒØ¯Ù†/Ø¯Ø±Ø¢ÙˆØ±Ø¯Ù† ÛŒÚ© Ø¢ÛŒØªÙ… Ø§Ø² Ú©ÙˆÙ„Ù‡â€ŒÙ¾Ø´ØªÛŒ Ù‚Ù‡Ø±Ù…Ø§Ù†. Ù‡Ø± Ø¨Ø§Ø± ÙÙ‚Ø· ÛŒÚ© Ø¢ÛŒØªÙ… Ø§Ø² Ù‡Ø± Ù†ÙˆØ¹
    (Ú©Ù„Ø§Ù‡â€ŒØ®ÙˆØ¯/Ø³Ù„Ø§Ø­/Ø§Ø³Ø¨) Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ Ù‡Ù…â€ŒØ²Ù…Ø§Ù† Ù¾ÙˆØ´ÛŒØ¯Ù‡ Ø¨Ø§Ø´Ø¯."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        inventory_id = request.data.get('inventory_id')
        equip = bool(request.data.get('equip', True))

        try:
            hero = Hero.objects.get(player=request.user)
            inv_item = PlayerHeroItem.objects.select_related('item').get(id=inventory_id, hero=hero)
        except (Hero.DoesNotExist, PlayerHeroItem.DoesNotExist):
            return Response({"error": "Ø¢ÛŒØªÙ… ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        with transaction.atomic():
            if equip:
                PlayerHeroItem.objects.filter(
                    hero=hero, item__item_type=inv_item.item.item_type, is_equipped=True
                ).update(is_equipped=False)
            inv_item.is_equipped = equip
            inv_item.save()

        return Response({"message": "ØªØ¬Ù‡ÛŒØ²Ø§Øª Ù‚Ù‡Ø±Ù…Ø§Ù† Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯."})


class AdventureListView(APIView):
    """ÙÙ‡Ø±Ø³Øª Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒâ€ŒÙ‡Ø§ÛŒ ÙØ¹Ø§Ù„ Ùˆ Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ø¨Ø§Ø²ÛŒÚ©Ù†."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        adventures = Adventure.objects.filter(
            player=request.user, is_completed=False, expires_at__gt=now
        ).order_by('created_at')

        return Response([
            {
                "id": a.id,
                "x_coord": a.x_coord,
                "y_coord": a.y_coord,
                "difficulty": a.difficulty,
                "difficulty_display": a.get_difficulty_display(),
                "expires_at": a.expires_at,
            }
            for a in adventures
        ])


class StartAdventureView(APIView):
    """Ø§Ø¹Ø²Ø§Ù… Ù‚Ù‡Ø±Ù…Ø§Ù† Ø¨Ù‡ ÛŒÚ© Ù†Ù‚Ø·Ù‡ Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ Ù…Ø´Ø®Øµ."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        adventure_id = request.data.get('adventure_id')

        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù†ÛŒ Ø¨Ø±Ø§ÛŒ Ø´Ù…Ø§ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        if not hero.is_alive:
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù† Ø´Ù…Ø§ Ø§Ø² Ù¾Ø§ÛŒ Ø¯Ø±Ø¢Ù…Ø¯Ù‡ Ùˆ Ù‚Ø§Ø¯Ø± Ø¨Ù‡ Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ Ù†ÛŒØ³Øª."}, status=400)
        if hero.is_on_adventure:
            if hero.is_away:
                return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù† Ø´Ù…Ø§ Ø¯Ø± ÛŒÚ© Ù…Ø§Ù…ÙˆØ±ÛŒØª Ù†Ø¸Ø§Ù…ÛŒ Ø§Ø³Øª Ùˆ Ù†Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ Ø¨Ù‡ Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ Ø¨Ø±ÙˆØ¯."},
                                status=400)
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù† Ø´Ù…Ø§ Ù‡Ù…â€ŒØ§Ú©Ù†ÙˆÙ† Ø¯Ø± Ø­Ø§Ù„ Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ Ø§Ø³Øª."}, status=400)
        if hero.health < 20:
            return Response({"error": "Ø³Ù„Ø§Ù…ØªÛŒ Ù‚Ù‡Ø±Ù…Ø§Ù† Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ† Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ Ú©Ø§ÙÛŒ Ù†ÛŒØ³ØªØ› ØµØ¨Ø± Ú©Ù†ÛŒØ¯ ØªØ§ ØªØ±Ù…ÛŒÙ… Ø´ÙˆØ¯."}, status=400)
        if not hero.home_village:
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù† Ø´Ù…Ø§ Ø¯Ù‡Ú©Ø¯Ù‡ Ø®Ø§Ù†Ú¯ÛŒ Ù…Ø´Ø®ØµÛŒ Ù†Ø¯Ø§Ø±Ø¯."}, status=400)

        try:
            adventure = Adventure.objects.get(id=adventure_id, player=request.user, is_completed=False)
        except Adventure.DoesNotExist:
            return Response({"error": "Ø§ÛŒÙ† Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù‚Ø¨Ù„Ø§ Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯Ù‡ Ø§Ø³Øª."}, status=404)

        settings_ = DIFFICULTY_SETTINGS[adventure.difficulty]
        if hero.level < settings_["min_hero_level"]:
            return Response(
                {"error": f"Ø³Ø·Ø­ Ù‚Ù‡Ø±Ù…Ø§Ù† Ø´Ù…Ø§ Ú©Ø§ÙÛŒ Ù†ÛŒØ³Øª (Ø­Ø¯Ø§Ù‚Ù„ Ø³Ø·Ø­ {settings_['min_hero_level']} Ù„Ø§Ø²Ù… Ø§Ø³Øª)."},
                status=400
            )

        travel_seconds = calculate_travel_seconds_to_point(hero.home_village, adventure.x_coord, adventure.y_coord)
        round_trip_seconds = travel_seconds * 2 + 60  # Ø±ÙØª + Ø¨Ø±Ú¯Ø´Øª + Ú©Ù…ÛŒ Ø²Ù…Ø§Ù† Ù†Ø¨Ø±Ø¯
        returns_at = timezone.now() + datetime.timedelta(seconds=round_trip_seconds)

        hero.is_on_adventure = True
        hero.adventure_returns_at = returns_at
        hero.save()

        resolve_hero_adventure.apply_async(args=[hero.id, adventure.id], eta=returns_at)

        return Response({
            "message": f"Ù‚Ù‡Ø±Ù…Ø§Ù† Ø¨Ù‡ Ø³Ù…Øª Ù…Ø§Ø¬Ø±Ø§Ø¬ÙˆÛŒÛŒ Ø§Ø¹Ø²Ø§Ù… Ø´Ø¯ Ùˆ Ø¯Ø± {round(round_trip_seconds/60)} Ø¯Ù‚ÛŒÙ‚Ù‡ Ø¨Ø§Ø²Ù…ÛŒâ€ŒÚ¯Ø±Ø¯Ø¯.",
            "returns_at": returns_at,
        })


class AnimalCatalogView(APIView):
    """ÙÙ‡Ø±Ø³Øª Ø­ÛŒÙˆØ§Ù†Ø§Øª Ù†Ú¯Ù‡Ø¨Ø§Ù†ÛŒ Ú©Ù‡ Ø¨Ø§ Ø·Ù„Ø§ Ù‚Ø§Ø¨Ù„ Ø®Ø±ÛŒØ¯ Ù‡Ø³ØªÙ†Ø¯."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        animals = Animal.objects.all()
        return Response([
            {
                "id": a.id,
                "name": a.name,
                "defense_infantry": a.defense_infantry,
                "defense_cavalry": a.defense_cavalry,
                "gold_price": a.gold_price,
            }
            for a in animals
        ])


class VillageAnimalBuyView(APIView):
    """Ø®Ø±ÛŒØ¯ Ø­ÛŒÙˆØ§Ù† Ù†Ú¯Ù‡Ø¨Ø§Ù† Ø¨Ø§ Ø³Ú©Ù‡ Ø·Ù„Ø§ Ø¨Ø±Ø§ÛŒ ØªÙ‚ÙˆÛŒØª Ø¯ÙØ§Ø¹ ÛŒÚ© Ø¯Ù‡Ú©Ø¯Ù‡ Ù…Ø´Ø®Øµ."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        animal_id = request.data.get('animal_id')
        quantity = int(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({"error": "ØªØ¹Ø¯Ø§Ø¯ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)

        try:
            animal = Animal.objects.get(id=animal_id)
        except Animal.DoesNotExist:
            return Response({"error": "Ø§ÛŒÙ† Ø­ÛŒÙˆØ§Ù† Ø¯Ø± ÙØ±ÙˆØ´Ú¯Ø§Ù‡ Ù…ÙˆØ¬ÙˆØ¯ Ù†ÛŒØ³Øª."}, status=404)

        total_cost = animal.gold_price * quantity

        with transaction.atomic():
            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

            player = request.user
            if player.gold_coins < total_cost:
                return Response({"error": "Ø³Ú©Ù‡ Ø·Ù„Ø§ÛŒ Ú©Ø§ÙÛŒ Ù†Ø¯Ø§Ø±ÛŒØ¯."}, status=400)

            player.gold_coins -= total_cost
            player.save()

            village_animal, _ = VillageAnimal.objects.select_for_update().get_or_create(
                village=village, animal=animal, defaults={'count': 0}
            )
            village_animal.count += quantity
            village_animal.save()

        return Response({"message": f"{quantity} Ø¹Ø¯Ø¯ {animal.name} Ø¨Ø±Ø§ÛŒ Ø¯ÙØ§Ø¹ Ø§Ø² {village.name} Ø®Ø±ÛŒØ¯Ø§Ø±ÛŒ Ø´Ø¯."})


class VillageMovementsView(APIView):
    """
    Ù†Ù…Ø§ÛŒØ´ Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ø¯Ø± Ø­Ø§Ù„ Ø­Ø±Ú©Øª (Ø§Ø¹Ø²Ø§Ù…ÛŒ Ùˆ ÙˆØ±ÙˆØ¯ÛŒ) Ø¨Ø±Ø§ÛŒ ÛŒÚ© Ø¯Ù‡Ú©Ø¯Ù‡ Ù…Ø´Ø®Øµ.

    Ù‚Ø¨Ù„ Ø§Ø² Ø§ÛŒÙ† ÙˆÛŒÙˆØŒ Ù‡ÛŒÚ† Ø±Ø§Ù‡ÛŒ Ø¨Ø±Ø§ÛŒ Ø¨Ø§Ø²ÛŒÚ©Ù† ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø´Øª Ú©Ù‡ Ø¨Ø¨ÛŒÙ†Ø¯ Ú†Ù‡ Ø­Ù…Ù„Ù‡â€ŒØ§ÛŒ
    Ø¯Ø± Ø±Ø§Ù‡ Ø¯Ù‡Ú©Ø¯Ù‡â€ŒØ§Ø´ Ø§Ø³Øª ÛŒØ§ Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ø§Ø¹Ø²Ø§Ù…ÛŒâ€ŒØ§Ø´ Ú©ÙÛŒ Ù…ÛŒâ€ŒØ±Ø³Ù†Ø¯ - Ø§ÛŒÙ† ÛŒÚ©ÛŒ Ø§Ø²
    Ø­ÛŒØ§ØªÛŒâ€ŒØªØ±ÛŒÙ† Ø¨Ø®Ø´â€ŒÙ‡Ø§ÛŒ Ú¯ÛŒÙ…â€ŒÙ¾Ù„ÛŒ ØªØ±Ø§ÙˆÛŒÙ† (Rally Point) Ø¨ÙˆØ¯ Ú©Ù‡ Ú©Ø§Ù…Ù„Ø§ ØºØ§ÛŒØ¨ Ø¨ÙˆØ¯.

    Ù†Ú©ØªÙ‡ Ø§Ù…Ù†ÛŒØªÛŒ/Ú¯ÛŒÙ…â€ŒÙ¾Ù„ÛŒ: Ø·Ø¨Ù‚ Ù‚ÙˆØ§Ù†ÛŒÙ† Ø§ØµÙ„ÛŒ ØªØ±Ø§ÙˆÛŒÙ†ØŒ Ù…Ø¯Ø§ÙØ¹ ÙÙ‚Ø· Ø§Ø² Â«Ø­Ù…Ù„Ù‡â€ŒØ§ÛŒ Ø¯Ø±
    Ø±Ø§Ù‡ Ø§Ø³ØªÂ» Ùˆ Ø²Ù…Ø§Ù† Ø±Ø³ÛŒØ¯Ù† Ø®Ø¨Ø±Ø¯Ø§Ø± Ù…ÛŒâ€ŒØ´ÙˆØ¯ØŒ Ù†Ù‡ Ø§Ø² ØªØ±Ú©ÛŒØ¨ Ø¯Ù‚ÛŒÙ‚ Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ù…Ù‡Ø§Ø¬Ù…Ø›
    ÙÙ‚Ø· Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù†Ø¸Ø§Ù…ÛŒ (REINFORCEMENT) Ùˆ Ø¨Ø§Ø²Ú¯Ø´Øª Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ø®ÙˆØ¯ÛŒ (RETURN) Ø¨Ø§
    Ø¬Ø²Ø¦ÛŒØ§Øª Ú©Ø§Ù…Ù„ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

        now = timezone.now()

        outgoing = TroopMovement.objects.filter(
            source_village=village, is_completed=False
        ).select_related('target_village').order_by('arrival_time')

        incoming = TroopMovement.objects.filter(
            target_village=village, is_completed=False
        ).select_related('source_village').order_by('arrival_time')

        def serialize_outgoing(m):
            return {
                "id": m.id,
                "movement_type": m.movement_type,
                "movement_type_display": m.get_movement_type_display(),
                "target_name": m.target_village.name,
                "target_coords": f"{m.target_village.x_coord}|{m.target_village.y_coord}",
                "arrival_time": m.arrival_time,
                "remaining_seconds": max(0, int((m.arrival_time - now).total_seconds())),
                "troops_payload": m.troops_payload,
            }

        def serialize_incoming(m):
            is_friendly = m.movement_type in ('REINFORCEMENT', 'RETURN')
            data = {
                "id": m.id,
                "movement_type": m.movement_type,
                "arrival_time": m.arrival_time,
                "remaining_seconds": max(0, int((m.arrival_time - now).total_seconds())),
                "source_coords": f"{m.source_village.x_coord}|{m.source_village.y_coord}",
            }
            if is_friendly:
                data["movement_type_display"] = m.get_movement_type_display()
                data["source_name"] = m.source_village.name
                data["troops_payload"] = m.troops_payload
                data["is_hostile"] = False
            else:
                # Ø­Ù…Ù„Ù‡/ØºØ§Ø±Øª/Ø´Ù†Ø§Ø³Ø§ÛŒÛŒ: ØªØ±Ú©ÛŒØ¨ Ù†ÛŒØ±Ùˆ Ùˆ Ù†Ø§Ù… Ø¯Ù‚ÛŒÙ‚ Ù…Ø¨Ø¯Ø§ Ù…Ø®ÙÛŒ Ù…ÛŒâ€ŒÙ…Ø§Ù†Ø¯
                data["movement_type_display"] = "âš”ï¸ Ø­Ù…Ù„Ù‡ Ø¯Ø± Ø±Ø§Ù‡ Ø§Ø³Øª"
                data["source_name"] = None
                data["troops_payload"] = None
                data["is_hostile"] = True
            return data

        return Response({
            "outgoing": [serialize_outgoing(m) for m in outgoing],
            "incoming": [serialize_incoming(m) for m in incoming],
        })


class FarmListView(APIView):
    """ÙÙ‡Ø±Ø³Øª Ú©Ø§Ù…Ù„ Ùˆ Ø§ÛŒØ¬Ø§Ø¯ Ø±Ø¯ÛŒÙ Ø¬Ø¯ÛŒØ¯ Ø¯Ø± ÛŒÚ© ÙØ§Ø±Ù…â€ŒÙ„ÛŒØ³Øª Ù…Ø´Ø®Øµ."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.has_gold_club:
            return Response({"error": "Ø¨Ø±Ø§ÛŒ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡ Ø¨Ù‡ Ú©Ù„ÙˆÙ¾ Ø·Ù„Ø§ÛŒÛŒ Ù†ÛŒØ§Ø² Ø¯Ø§Ø±ÛŒØ¯."}, status=403)

        farm_list_id = request.query_params.get('farm_list_id')
        entries = FarmListEntry.objects.filter(player=request.user).select_related('source_village', 'target_village')
        if farm_list_id:
            entries = entries.filter(farm_list_id=farm_list_id)

        return Response([
            {
                "id": e.id,
                "farm_list_id": e.farm_list_id,
                "source_village_id": e.source_village_id,
                "source_name": e.source_village.name,
                "target_village_id": e.target_village_id,
                "target_name": e.target_village.name,
                "target_coords": f"{e.target_village.x_coord}|{e.target_village.y_coord}",
                "troops_payload": e.troops_payload,
                "last_run_at": e.last_run_at,
                "last_run_status": e.last_run_status,
                "last_loot_summary": e.last_loot_summary,
            }
            for e in entries
        ])

    def post(self, request):
        if not request.user.has_gold_club:
            return Response({"error": "Ø¨Ø±Ø§ÛŒ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡ Ø¨Ù‡ Ú©Ù„ÙˆÙ¾ Ø·Ù„Ø§ÛŒÛŒ Ù†ÛŒØ§Ø² Ø¯Ø§Ø±ÛŒØ¯."}, status=403)

        farm_list_id = request.data.get('farm_list_id')
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        troops_payload = request.data.get('troops_payload', {})

        if not troops_payload or not any(int(v or 0) > 0 for v in troops_payload.values()):
            return Response({"error": "Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© Ù†ÙˆØ¹ Ù†ÛŒØ±Ùˆ Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ† Ø±Ø¯ÛŒÙ Ù…Ø´Ø®Øµ Ú©Ù†ÛŒØ¯."}, status=400)

        farm_list = None
        if farm_list_id:
            try:
                farm_list = FarmList.objects.get(id=farm_list_id, player=request.user)
            except FarmList.DoesNotExist:
                return Response({"error": "ÙØ§Ø±Ù…â€ŒÙ„ÛŒØ³Øª Ø§Ù†ØªØ®Ø§Ø¨ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)
        else:
            # âœ… Ø³Ø§Ø²Ú¯Ø§Ø±ÛŒ: Ø§Ú¯Ø± ÙØ§Ø±Ù…â€ŒÙ„ÛŒØ³ØªÛŒ Ø§Ù†ØªØ®Ø§Ø¨ Ù†Ø´Ø¯Ù‡ Ø¨ÙˆØ¯ØŒ ÛŒÚ© Ù„ÛŒØ³Øª Ù¾ÛŒØ´â€ŒÙØ±Ø¶ Ø³Ø§Ø®ØªÙ‡/Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯
            farm_list, _ = FarmList.objects.get_or_create(
                player=request.user, name='Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡', defaults={}
            )

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ Ù…Ø¨Ø¯Ø§ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

        try:
            target_village = Village.objects.get(id=target_id)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ Ù…Ù‚ØµØ¯ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        if source_village.id == target_village.id:
            return Response({"error": "Ù†Ù…ÛŒâ€ŒØªÙˆØ§Ù†ÛŒØ¯ Ø¯Ù‡Ú©Ø¯Ù‡ Ø®ÙˆØ¯ØªØ§Ù† Ø±Ø§ Ù‡Ø¯Ù Ù…Ø²Ø±Ø¹Ù‡ Ù‚Ø±Ø§Ø± Ø¯Ù‡ÛŒØ¯."}, status=400)

        entry = FarmListEntry.objects.create(
            player=request.user,
            farm_list=farm_list,
            source_village=source_village,
            target_village=target_village,
            troops_payload=troops_payload,
        )
        return Response({"message": "Ø±Ø¯ÛŒÙ Ø¬Ø¯ÛŒØ¯ Ø¨Ù‡ Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡ Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯.", "id": entry.id}, status=201)


class FarmListEntryDetailView(APIView):
    """Ø­Ø°Ù ÛŒÚ© Ø±Ø¯ÛŒÙ Ø§Ø² Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, entry_id):
        deleted, _ = FarmListEntry.objects.filter(id=entry_id, player=request.user).delete()
        if not deleted:
            return Response({"error": "Ø±Ø¯ÛŒÙ Ù…ÙˆØ±Ø¯ Ù†Ø¸Ø± ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)
        return Response({"message": "Ø±Ø¯ÛŒÙ Ø§Ø² Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡ Ø­Ø°Ù Ø´Ø¯."})


class FarmListRunView(APIView):
    """Ø§Ø¬Ø±Ø§ÛŒ ÛŒÚ© Ø±Ø¯ÛŒÙ (entry_id)ØŒ ÛŒÚ© Ù„ÛŒØ³Øª Ú©Ø§Ù…Ù„ (farm_list_id)ØŒ ÛŒØ§ Ú©Ù„ Ø±Ø¯ÛŒÙâ€ŒÙ‡Ø§ÛŒ Ø¨Ø§Ø²ÛŒÚ©Ù† (run_all)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        entry_id = request.data.get('entry_id')
        farm_list_id = request.data.get('farm_list_id')
        run_all = request.data.get('run_all', False)

        if not entry_id and not farm_list_id and not run_all:
            return Response({"error": "Ø¨Ø§ÛŒØ¯ entry_idØŒ farm_list_id ÛŒØ§ run_all Ù…Ø´Ø®Øµ Ø´ÙˆØ¯."}, status=400)

        entries_qs = FarmListEntry.objects.filter(player=request.user).select_related('source_village', 'target_village')
        if entry_id:
            entries_qs = entries_qs.filter(id=entry_id)
        elif farm_list_id:
            entries_qs = entries_qs.filter(farm_list_id=farm_list_id)

        results = []
        for entry in entries_qs:
            success, result = dispatch_troop_movement(
                request.user, entry.source_village, entry.target_village,
                'RAID', entry.troops_payload, farm_list_entry=entry,
            )
            entry.last_run_at = timezone.now()
            entry.last_run_status = 'SUCCESS' if success else 'FAILED'
            if not success:
                entry.last_loot_summary = result
            entry.save(update_fields=['last_run_at', 'last_run_status', 'last_loot_summary'])
            results.append({
                "entry_id": entry.id,
                "target_name": entry.target_village.name,
                "success": success,
                "message": "Ø§Ø¹Ø²Ø§Ù… Ø´Ø¯" if success else result,
            })

        dispatched_count = sum(1 for r in results if r["success"])
        return Response({
            "message": f"{dispatched_count} Ø§Ø² {len(results)} Ø±Ø¯ÛŒÙ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§Ø¹Ø²Ø§Ù… Ø´Ø¯.",
            "results": results,
        })


class TroopEvasionView(APIView):
    """ÙØ¹Ø§Ù„/ØºÛŒØ±ÙØ¹Ø§Ù„ Ú©Ø±Ø¯Ù† ÙØ±Ø§Ø± Ù†ÛŒØ±ÙˆÙ‡Ø§ - ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ø§Ø¹Ø¶Ø§ÛŒ Ú©Ù„ÙˆÙ¾ Ø·Ù„Ø§ÛŒÛŒ."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        player = request.user

        if not player.has_gold_club:
            return Response({"error": "Ø¨Ø±Ø§ÛŒ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² Ø§ÛŒÙ† Ù‚Ø§Ø¨Ù„ÛŒØª Ø¨Ù‡ Ú©Ù„ÙˆÙ¾ Ø·Ù„Ø§ÛŒÛŒ Ù†ÛŒØ§Ø² Ø¯Ø§Ø±ÛŒØ¯."}, status=403)

        try:
            village = Village.objects.get(id=village_id, player=player)
        except Village.DoesNotExist:
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

        evasion, _ = TroopEvasionSetting.objects.get_or_create(village=village)
        return Response({
            "village_id": village.id,
            "is_evasion_enabled": evasion.is_enabled,
        })

    def post(self, request):
        village_id = request.data.get('village_id')
        is_enabled = request.data.get('is_enabled', True)
        player = request.user

        if not player.has_gold_club:
            return Response({"error": "Ø¨Ø±Ø§ÛŒ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² Ø§ÛŒÙ† Ù‚Ø§Ø¨Ù„ÛŒØª Ø¨Ù‡ Ú©Ù„ÙˆÙ¾ Ø·Ù„Ø§ÛŒÛŒ Ù†ÛŒØ§Ø² Ø¯Ø§Ø±ÛŒØ¯."}, status=403)

        try:
            village = Village.objects.get(id=village_id, player=player)
        except Village.DoesNotExist:
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

        evasion, _ = TroopEvasionSetting.objects.get_or_create(village=village)
        evasion.is_enabled = bool(is_enabled)
        evasion.save()

        status_text = "ÙØ¹Ø§Ù„" if evasion.is_enabled else "ØºÛŒØ±ÙØ¹Ø§Ù„"
        return Response({
            "message": f"ÙØ±Ø§Ø± Ù†ÛŒØ±ÙˆÙ‡Ø§ {status_text} Ø´Ø¯.",
            "is_evasion_enabled": evasion.is_enabled,
        })


class BlacksmithView(APIView):
    """ÙˆØ¶Ø¹ÛŒØª Ùˆ Ø´Ø±ÙˆØ¹ Ø§Ø±ØªÙ‚Ø§ÛŒ Ù†ÛŒØ±Ùˆ Ø¯Ø± Ø¢Ù‡Ù†Ú¯Ø±ÛŒ ÛŒÚ© Ø¯Ù‡Ú©Ø¯Ù‡ Ù…Ø´Ø®Øµ."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

        blacksmith = VillageBuilding.objects.filter(village=village, building_type__name="Ø¢Ù‡Ù†Ú¯Ø±ÛŒ").first()
        if not blacksmith or blacksmith.level <= 0:
            return Response({"error": "Ø§Ø¨ØªØ¯Ø§ Ø¨Ø§ÛŒØ¯ Ø¢Ù‡Ù†Ú¯Ø±ÛŒ Ø¨Ø³Ø§Ø²ÛŒØ¯.", "has_blacksmith": False}, status=400)

        troop_types = TroopType.objects.filter(tribe=request.user.tribe)
        upgrades = {u.troop_type_id: u for u in TroopUpgrade.objects.filter(village=village)}

        data = []
        for t in troop_types:
            existing = upgrades.get(t.id)
            level = existing.level if existing else 0
            is_upgrading = existing.is_upgrading if existing else False
            data.append({
                "troop_type_id": t.id,
                "name": t.name,
                "level": level,
                "max_level": TroopUpgrade.MAX_LEVEL,
                "is_upgrading": is_upgrading,
                "upgrade_ends_at": existing.upgrade_ends_at if existing else None,
                "next_level_cost": None if level >= TroopUpgrade.MAX_LEVEL else {
                    "wood": int(t.wood_cost * 1.6 * (level + 1)),
                    "clay": int(t.clay_cost * 1.6 * (level + 1)),
                    "iron": int(t.iron_cost * 1.6 * (level + 1)),
                    "crop": int(t.crop_cost * 1.6 * (level + 1)),
                },
            })

        return Response({"has_blacksmith": True, "blacksmith_level": blacksmith.level, "troops": data})

    def post(self, request):
        village_id = request.data.get('village_id')
        troop_type_id = request.data.get('troop_type_id')

        with transaction.atomic():
            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

            blacksmith = VillageBuilding.objects.filter(village=village, building_type__name="Ø¢Ù‡Ù†Ú¯Ø±ÛŒ").first()
            if not blacksmith or blacksmith.level <= 0:
                return Response({"error": "Ø§Ø¨ØªØ¯Ø§ Ø¨Ø§ÛŒØ¯ Ø¢Ù‡Ù†Ú¯Ø±ÛŒ Ø¨Ø³Ø§Ø²ÛŒØ¯."}, status=400)

            try:
                troop_type = TroopType.objects.get(id=troop_type_id, tribe=request.user.tribe)
            except TroopType.DoesNotExist:
                return Response({"error": "Ø§ÛŒÙ† Ù†ÛŒØ±Ùˆ Ù…Ø®ØªØµ Ù†Ú˜Ø§Ø¯ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=400)

            upgrade, _ = TroopUpgrade.objects.select_for_update().get_or_create(
                village=village, troop_type=troop_type
            )
            if upgrade.is_upgrading:
                return Response({"error": "Ø§ÛŒÙ† Ù†ÛŒØ±Ùˆ Ø¯Ø± Ø­Ø§Ù„ Ø­Ø§Ø¶Ø± Ø¯Ø± Ø­Ø§Ù„ Ø§Ø±ØªÙ‚Ø§ Ø§Ø³Øª."}, status=400)
            if upgrade.level >= TroopUpgrade.MAX_LEVEL:
                return Response({"error": f"Ø§ÛŒÙ† Ù†ÛŒØ±Ùˆ Ø¨Ù‡ Ø­Ø¯Ø§Ú©Ø«Ø± Ù„ÙˆÙ„ ({TroopUpgrade.MAX_LEVEL}) Ø±Ø³ÛŒØ¯Ù‡."}, status=400)

            next_level = upgrade.level + 1
            req_wood = int(troop_type.wood_cost * 1.6 * next_level)
            req_clay = int(troop_type.clay_cost * 1.6 * next_level)
            req_iron = int(troop_type.iron_cost * 1.6 * next_level)
            req_crop = int(troop_type.crop_cost * 1.6 * next_level)

            if village.wood < req_wood or village.clay < req_clay or village.iron < req_iron or village.crop < req_crop:
                return Response({"error": "Ù…Ù†Ø§Ø¨Ø¹ Ú©Ø§ÙÛŒ Ù†ÛŒØ³Øª."}, status=400)

            village.wood -= req_wood; village.clay -= req_clay
            village.iron -= req_iron; village.crop -= req_crop
            village.save()

            duration = 1800 * next_level  # Ù‡Ø± Ù„ÙˆÙ„ Û³Û° Ø¯Ù‚ÛŒÙ‚Ù‡ Ù¾Ø§ÛŒÙ‡ (ØªØ­Øª ØªØ§Ø«ÛŒØ± Ø³Ø±Ø¹Øª Ø³Ø±ÙˆØ± Ù†ÛŒØ³ØªØŒ ÙˆÙ„ÛŒ Ù…ÛŒâ€ŒØªÙˆØ§Ù† Ù…Ø´Ø§Ø¨Ù‡ Ø¨Ø§Ù„Ø§ Ø§Ø¶Ø§ÙÙ‡ Ú©Ø±Ø¯)
            upgrade.is_upgrading = True
            upgrade.upgrade_ends_at = timezone.now() + datetime.timedelta(seconds=duration)
            upgrade.save()

            from .tasks import complete_troop_upgrade
            transaction.on_commit(lambda: complete_troop_upgrade.apply_async(
                args=[upgrade.id], eta=upgrade.upgrade_ends_at
            ))

        return Response({"message": f"Ø§Ø±ØªÙ‚Ø§ÛŒ {troop_type.name} Ø¨Ù‡ Ù„ÙˆÙ„ {next_level} Ø¢ØºØ§Ø² Ø´Ø¯."})


class HeroAllocatePointsView(APIView):
    """ØªØ®ØµÛŒØµ Ø§Ù…ØªÛŒØ§Ø²Ù‡Ø§ÛŒ Ù‚Ø§Ø¨Ù„ ØªÙˆØ²ÛŒØ¹ Ù‚Ù‡Ø±Ù…Ø§Ù† (Ù‚Ø¯Ø±Øª Ù…Ø¨Ø§Ø±Ø²Ù‡/ØªÙ‡Ø§Ø¬Ù…ÛŒ/Ø¯ÙØ§Ø¹ÛŒ/Ù…Ù†Ø§Ø¨Ø¹)."""
    permission_classes = [IsAuthenticated]

    ATTRIBUTE_FIELDS = {
        'fighting_strength': 'fighting_strength_points',
        'off_bonus': 'off_bonus_points',
        'def_bonus': 'def_bonus_points',
        'resource': 'resource_points',
    }

    def post(self, request):
        attribute = request.data.get('attribute')
        try:
            amount = int(request.data.get('amount', 0))
        except (TypeError, ValueError):
            amount = 0

        field_name = self.ATTRIBUTE_FIELDS.get(attribute)
        if not field_name or amount <= 0:
            return Response({"error": "Ø®ØµÛŒØµÙ‡ ÛŒØ§ Ù…Ù‚Ø¯Ø§Ø± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)

        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù†ÛŒ Ø¨Ø±Ø§ÛŒ Ø´Ù…Ø§ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        if amount > hero.available_attribute_points:
            return Response({"error": "Ø§Ù…ØªÛŒØ§Ø² Ú©Ø§ÙÛŒ Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ† ØªØ®ØµÛŒØµ Ù†Ø¯Ø§Ø±ÛŒØ¯."}, status=400)

        setattr(hero, field_name, getattr(hero, field_name) + amount)
        hero.save()

        return Response({
            "message": "Ø§Ù…ØªÛŒØ§Ø² Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª ØªØ®ØµÛŒØµ ÛŒØ§ÙØª.",
            "available_attribute_points": hero.available_attribute_points,
        })


class HeroSettingsView(APIView):
    """ØªÙ†Ø¸ÛŒÙ… Ù†ÙˆØ¹ Ù…Ù†Ø¨Ø¹ ØªÙˆÙ„ÛŒØ¯ÛŒ Ù‚Ù‡Ø±Ù…Ø§Ù† Ùˆ Ù…Ø´Ø§Ø±Ú©Øª Ø¯Ø± Ø¯ÙØ§Ø¹ Ø¯Ù‡Ú©Ø¯Ù‡ Ø®Ø§Ù†Ú¯ÛŒ."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù†ÛŒ Ø¨Ø±Ø§ÛŒ Ø´Ù…Ø§ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        resource_type = request.data.get('resource_production_type')
        if resource_type:
            valid_types = dict(Hero.RESOURCE_CHOICES)
            if resource_type not in valid_types:
                return Response({"error": "Ù†ÙˆØ¹ Ù…Ù†Ø¨Ø¹ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)
            hero.resource_production_type = resource_type

        if 'participates_in_defense' in request.data:
            hero.participates_in_defense = bool(request.data.get('participates_in_defense'))

        hero.save()
        return Response({"message": "ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ù‚Ù‡Ø±Ù…Ø§Ù† Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯."})


class HeroReviveView(APIView):
    permission_classes = [IsAuthenticated]
    BASE_COST_PER_RESOURCE = 500

    def _calculate_cost(self, hero):
        multiplier = 1 + (hero.level * 0.15)
        cost = int(self.BASE_COST_PER_RESOURCE * multiplier)
        return {"wood": cost, "clay": cost, "iron": cost, "crop": cost}

    def get(self, request):
        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù†ÛŒ Ø¨Ø±Ø§ÛŒ Ø´Ù…Ø§ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)
        return Response({"is_alive": hero.is_alive, "cost": self._calculate_cost(hero)})

    def post(self, request):
        village_id = request.data.get('village_id')

        # âœ… FIX: select_for_update Ø­Ø§Ù„Ø§ Ø¯Ø§Ø®Ù„ transaction.atomic() Ø§Ø³Øª.
        # Ù‚Ø¨Ù„Ø§ Ø®Ø§Ø±Ø¬ Ø§Ø² Ù‡Ø± ØªØ±Ø§Ú©Ù†Ø´ÛŒ Ø¨ÙˆØ¯ Ùˆ Ø±ÙˆÛŒ Postgres Ø¨Ø§
        # TransactionManagementError Ú©Ø±Ø´ Ù…ÛŒâ€ŒÚ©Ø±Ø¯.
        with transaction.atomic():
            try:
                hero = Hero.objects.select_for_update().get(player=request.user)
            except Hero.DoesNotExist:
                return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù†ÛŒ Ø¨Ø±Ø§ÛŒ Ø´Ù…Ø§ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

            if hero.is_alive:
                return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù† Ø´Ù…Ø§ Ø¯Ø± Ø­Ø§Ù„ Ø­Ø§Ø¶Ø± Ø²Ù†Ø¯Ù‡ Ø§Ø³Øª."}, status=400)

            cost = self._calculate_cost(hero)

            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "Ø¯Ù‡Ú©Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø´Ù…Ø§ Ù†ÛŒØ³Øª."}, status=404)

            if (village.wood < cost['wood'] or village.clay < cost['clay'] or
                    village.iron < cost['iron'] or village.crop < cost['crop']):
                return Response({"error": "Ù…Ù†Ø§Ø¨Ø¹ Ø§ÛŒÙ† Ø¯Ù‡Ú©Ø¯Ù‡ Ø¨Ø±Ø§ÛŒ Ø§Ø­ÛŒØ§ÛŒ Ù‚Ù‡Ø±Ù…Ø§Ù† Ú©Ø§ÙÛŒ Ù†ÛŒØ³Øª."}, status=400)

            village.wood -= cost['wood']
            village.clay -= cost['clay']
            village.iron -= cost['iron']
            village.crop -= cost['crop']
            village.save()

            hero.is_alive = True
            hero.health = 50
            hero.home_village = village
            hero.last_health_update = timezone.now()
            hero.save()

        return Response({"message": "Ù‚Ù‡Ø±Ù…Ø§Ù† Ø´Ù…Ø§ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§Ø­ÛŒØ§ Ø´Ø¯ Ùˆ Ø¯Ø± Ø­Ø§Ù„ Ø§Ø³ØªØ±Ø§Ø­Øª Ø§Ø³Øª."})


class HeroAppearanceView(APIView):
    """Ø°Ø®ÛŒØ±Ù‡â€ŒÛŒ Ø¸Ø§Ù‡Ø± Ø³ÙØ§Ø±Ø´ÛŒ Ù‚Ù‡Ø±Ù…Ø§Ù† (Ø¨Ø®Ø´ Â«Ø¸Ø§Ù‡Ø±Â» Ù…Ø´Ø§Ø¨Ù‡ ØªØ±Ø§ÙˆÛŒÙ† Ø§ØµÙ„ÛŒ)."""
    permission_classes = [IsAuthenticated]

    APPEARANCE_FIELDS = [
        'head_style', 'hair_color', 'hair_style', 'ear_style',
        'eyebrow_style', 'eye_style', 'nose_style', 'mouth_style',
    ]

    def post(self, request):
        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "Ù‚Ù‡Ø±Ù…Ø§Ù†ÛŒ Ø¨Ø±Ø§ÛŒ Ø´Ù…Ø§ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        gender = request.data.get('gender')
        if gender:
            if gender not in dict(Hero.GENDER_CHOICES):
                return Response({"error": "Ø¬Ù†Ø³ÛŒØª Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)
            hero.gender = gender

        for field in self.APPEARANCE_FIELDS:
            if field in request.data:
                try:
                    value = int(request.data[field])
                except (TypeError, ValueError):
                    return Response({"error": f"Ù…Ù‚Ø¯Ø§Ø± {field} Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)
                if not (1 <= value <= Hero.APPEARANCE_OPTION_COUNT):
                    return Response({"error": f"Ù…Ù‚Ø¯Ø§Ø± {field} Ø®Ø§Ø±Ø¬ Ø§Ø² Ù…Ø­Ø¯ÙˆØ¯Ù‡ Ù…Ø¬Ø§Ø² Ø§Ø³Øª."}, status=400)
                setattr(hero, field, value)

        hero.save()
        return Response({"message": "Ø¸Ø§Ù‡Ø± Ù‚Ù‡Ø±Ù…Ø§Ù† Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯."})




class HeroImageView(APIView):
    """تولید پویای تصویر قهرمان با ترکیب لایه‌های PNG (دقیقا مثل hero_image.php تراوین اصلی)."""
    permission_classes = [IsAuthenticated]

    COLOR_MAP = {1: 'black', 2: 'brown', 3: 'darkbrown', 4: 'yellow', 5: 'red'}
    SIZE_MAP = {'sideinfo': '119x136', 'profile': '31x40', 'inventory': '64x82', 'full': '254x330'}

    def get(self, request):
        from PIL import Image
        from django.http import HttpResponse
        from django.conf import settings as django_settings
        import os

        hero, _ = Hero.objects.get_or_create(player=request.user)
        size_key = request.query_params.get('size', 'sideinfo')
        size = self.SIZE_MAP.get(size_key, '119x136')

        gdir = 'male' if hero.gender == 'MALE' else 'female'
        color = self.COLOR_MAP.get(hero.hair_color, 'black')
        base_path = os.path.join(django_settings.STATICFILES_DIRS[0], 'hero', 'faces', gdir, size)

        def load(path):
            try:
                return Image.open(path).convert('RGBA')
            except Exception:
                return None

        body = load(os.path.join(base_path, 'face0.png'))
        if body is None:
            return HttpResponse(status=404)

        eye_idx = (hero.eye_style - 1) % 5
        eye = load(os.path.join(base_path, 'eye', f'eye{eye_idx}.png'))
        if eye:
            body.paste(eye, (0, 0), eye)

        eyebrow_idx = (hero.eyebrow_style - 1) % 5
        if hero.gender == 'MALE':
            eyebrow = load(os.path.join(base_path, 'eyebrow', f'eyebrow{eyebrow_idx}-{color}.png'))
        else:
            eyebrow = load(os.path.join(base_path, 'eyebrow', f'eyebrow{eyebrow_idx}.png'))
        if eyebrow:
            body.paste(eyebrow, (0, 0), eyebrow)

        hair_idx = (hero.hair_style - 1) % 5
        hair = load(os.path.join(base_path, 'hair', f'hair{hair_idx}-{color}.png'))
        if hair:
            body.paste(hair, (0, 0), hair)

        ear_idx = (hero.ear_style - 1) % 5
        ear = load(os.path.join(base_path, 'ear', f'ear{ear_idx}.png'))
        if ear:
            body.paste(ear, (0, 0), ear)

        mouth_idx = (hero.mouth_style - 1) % 4
        mouth = load(os.path.join(base_path, 'mouth', f'mouth{mouth_idx}.png'))
        if mouth:
            body.paste(mouth, (0, 0), mouth)

        nose_idx = (hero.nose_style - 1) % 5
        nose = load(os.path.join(base_path, 'nose', f'nose{nose_idx}.png'))
        if nose:
            body.paste(nose, (0, 0), nose)

        face_idx = (hero.head_style - 1) % 5
        face = load(os.path.join(base_path, 'face', f'face{face_idx}.png'))
        if face:
            body.paste(face, (0, 0), face)

        if hero.gender == 'MALE':
            beard_idx = (hero.head_style - 1) % 5
            beard = load(os.path.join(base_path, 'beard', f'beard{beard_idx}-{color}.png'))
            if beard:
                body.paste(beard, (0, 0), beard)

        from io import BytesIO
        buf = BytesIO()
        body.save(buf, format='PNG', optimize=True)
        buf.seek(0)

        response = HttpResponse(buf.getvalue(), content_type='image/png')
        response['Cache-Control'] = 'private, max-age=60'
        return response

class CombatReportListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        direction = request.query_params.get('direction', 'all')
        qs = CombatReport.objects.filter(
            Q(attacker_player=request.user, hidden_from_attacker=False) |
            Q(defender_player=request.user, hidden_from_defender=False)
        )
        if direction == 'outgoing':
            qs = qs.filter(attacker_player=request.user)
        elif direction == 'incoming':
            qs = qs.filter(defender_player=request.user)

        qs = qs.order_by('-created_at')[:100]

        def serialize(r):
            is_attacker = r.attacker_player_id == request.user.id
            return {
                "id": r.id,
                "is_attacker": is_attacker,
                "movement_type": r.movement_type,
                "victory": r.victory,
                "won": (r.victory == "attacker") == is_attacker,
                "attacker_village_name": r.attacker_village_name,
                "defender_village_name": r.defender_village_name,
                "attacker_coords": r.attacker_coords,
                "defender_coords": r.defender_coords,
                "attacker_loss_percent": round(r.attacker_loss_percent, 1),
                "defender_loss_percent": round(r.defender_loss_percent, 1),
                "morale_percent": r.morale_percent,
                "conquered": r.conquered,
                "is_read": r.is_read_by_attacker if is_attacker else r.is_read_by_defender,
                "created_at": r.created_at,
            }

        return Response([serialize(r) for r in qs])


class CombatReportUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import ReinforcementReport
        combat_count = CombatReport.objects.filter(
            Q(attacker_player=request.user, is_read_by_attacker=False, hidden_from_attacker=False) |
            Q(defender_player=request.user, is_read_by_defender=False, hidden_from_defender=False)
        ).count()
        reinforcement_count = ReinforcementReport.objects.filter(
            Q(sender_player=request.user, is_read_by_sender=False, hidden_from_sender=False) |
            Q(receiver_player=request.user, is_read_by_receiver=False, hidden_from_receiver=False)
        ).count()
        return Response({"unread_count": combat_count + reinforcement_count})


class CombatReportDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            r = CombatReport.objects.get(
                Q(id=report_id) & (Q(attacker_player=request.user) | Q(defender_player=request.user))
            )
        except CombatReport.DoesNotExist:
            return Response({"error": "Ú¯Ø²Ø§Ø±Ø´ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        is_attacker = r.attacker_player_id == request.user.id
        if is_attacker and not r.is_read_by_attacker:
            r.is_read_by_attacker = True
            r.save(update_fields=['is_read_by_attacker'])
        elif not is_attacker and not r.is_read_by_defender:
            r.is_read_by_defender = True
            r.save(update_fields=['is_read_by_defender'])

        return Response({
            "id": r.id,
            "is_attacker": is_attacker,
            "movement_type": r.movement_type,
            "victory": r.victory,
            "attacker_village_name": r.attacker_village_name,
            "defender_village_name": r.defender_village_name,
            "attacker_coords": r.attacker_coords,
            "defender_coords": r.defender_coords,
            "attacker_troops_sent": r.attacker_troops_sent,
            "attacker_troops_survived": r.attacker_troops_survived,
            "defender_troops_before": r.defender_troops_before,
            "defender_troops_after": r.defender_troops_after,
            "attacker_loss_percent": round(r.attacker_loss_percent, 1),
            "defender_loss_percent": round(r.defender_loss_percent, 1),
            "morale_percent": r.morale_percent,
            "loot": r.loot,
            "wall_damage_text": r.wall_damage_text,
            "catapult_damage_text": r.catapult_damage_text,
            "conquered": r.conquered,
            "trapped_summary": r.trapped_summary,
            "created_at": r.created_at,
        })

    def delete(self, request, report_id):
        try:
            r = CombatReport.objects.get(
                Q(id=report_id) & (Q(attacker_player=request.user) | Q(defender_player=request.user))
            )
        except CombatReport.DoesNotExist:
            return Response({"error": "Ú¯Ø²Ø§Ø±Ø´ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        if r.attacker_player_id == request.user.id:
            r.hidden_from_attacker = True
        else:
            r.hidden_from_defender = True
        r.save()
        return Response({"message": "Ú¯Ø²Ø§Ø±Ø´ Ø­Ø°Ù Ø´Ø¯."})


class TrappedTroopsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = TrappedTroop.objects.filter(
            trapper_village__player=request.user
        ).select_related('trapper_village', 'troop_type', 'original_owner_player')
        return Response([
            {
                "id": e.id,
                "trapper_village_name": e.trapper_village.name,
                "troop_name": e.troop_type.name,
                "count": e.count,
                "original_owner": e.original_owner_player.username,
                "captured_at": e.captured_at,
            }
            for e in entries
        ])


class ReleaseTrappedTroopsView(APIView):
    """ØµØ§Ø­Ø¨ ØªÙ„Ù‡ Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ Ø§Ø² Ø³Ø± Ù„Ø·Ù Ù†ÛŒØ±ÙˆÙ‡Ø§ÛŒ Ø§Ø³ÛŒØ± Ø±Ø§ Ø¢Ø²Ø§Ø¯ Ú©Ù†Ø¯ ØªØ§ Ø¨Ù‡ Ù…Ø§Ù„Ú© Ø§ØµÙ„ÛŒ Ø¨Ø§Ø²Ú¯Ø±Ø¯Ù†Ø¯."""
    permission_classes = [IsAuthenticated]

    def post(self, request, entry_id):
        try:
            entry = TrappedTroop.objects.select_related(
                'trapper_village', 'troop_type', 'original_owner_player'
            ).get(id=entry_id, trapper_village__player=request.user)
        except TrappedTroop.DoesNotExist:
            return Response({"error": "Ø§ÛŒÙ† Ù†ÛŒØ±ÙˆÛŒ Ø§Ø³ÛŒØ±Ø´Ø¯Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        home_village = Village.objects.filter(
            player=entry.original_owner_player, is_capital=True
        ).first() or Village.objects.filter(player=entry.original_owner_player).order_by('id').first()

        if home_village:
            vt, _ = VillageTroop.objects.get_or_create(
                village=home_village, troop_type=entry.troop_type, defaults={'count': 0}
            )
            vt.count += entry.count
            vt.save()
            message = f"{entry.count} Ù†ÛŒØ±ÙˆÛŒ {entry.troop_type.name} Ø¢Ø²Ø§Ø¯ Ø´Ø¯ Ùˆ Ø¨Ù‡ {home_village.name} Ø¨Ø§Ø²Ú¯Ø´Øª."
        else:
            message = f"{entry.count} Ù†ÛŒØ±ÙˆÛŒ {entry.troop_type.name} Ø¢Ø²Ø§Ø¯ Ø´Ø¯ (Ù…Ø§Ù„Ú© Ø§ØµÙ„ÛŒ Ø¯ÛŒÚ¯Ø± Ø¯Ù‡Ú©Ø¯Ù‡â€ŒØ§ÛŒ Ù†Ø¯Ø§Ø±Ø¯)."

        entry.delete()
        return Response({"message": message})


class HeroAuctionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import HeroAuction
        now = timezone.now()
        auctions = HeroAuction.objects.filter(
            is_completed=False, ends_at__gt=now
        ).select_related('item', 'current_bidder')
        return Response([
            {
                "id": a.id, "item_name": a.item.name, "item_type": a.item.item_type,
                "attack_bonus": a.item.attack_bonus, "defense_bonus": a.item.defense_bonus,
                "speed_bonus": a.item.speed_bonus,
                "current_bid": a.current_bid,
                "current_bidder": a.current_bidder.username if a.current_bidder else None,
                "remaining_seconds": max(0, int((a.ends_at - now).total_seconds())),
            }
            for a in auctions
        ])


class HeroAuctionBidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import HeroAuction
        from apps.game_engine.economy import SILVER_PER_GOLD

        auction_id = request.data.get('auction_id')
        currency = request.data.get('currency', 'gold')
        if currency not in ('gold', 'silver'):
            return Response({"error": "ÙˆØ§Ø­Ø¯ Ù¾ÙˆÙ„ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)

        try:
            bid_amount = int(request.data.get('bid_amount', 0))
        except (TypeError, ValueError):
            return Response({"error": "Ù…Ù‚Ø¯Ø§Ø± Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª."}, status=400)
        if bid_amount <= 0:
            return Response({"error": "Ù…Ù‚Ø¯Ø§Ø± Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ Ø¨Ø§ÛŒØ¯ Ù…Ø«Ø¨Øª Ø¨Ø§Ø´Ø¯."}, status=400)

        # current_bid Ù‡Ù…ÛŒØ´Ù‡ Ø¨Ø± Ø­Ø³Ø¨ Â«Ù…Ø¹Ø§Ø¯Ù„ Ø·Ù„Ø§Â» Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯ ØªØ§ Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯Ù‡Ø§ÛŒ Ø·Ù„Ø§/Ù†Ù‚Ø±Ù‡ Ù‚Ø§Ø¨Ù„ Ù…Ù‚Ø§ÛŒØ³Ù‡ Ø¨Ø§Ø´Ù†Ø¯
        bid_amount_in_gold = bid_amount if currency == 'gold' else (bid_amount / SILVER_PER_GOLD)

        with transaction.atomic():
            try:
                auction = HeroAuction.objects.select_for_update().get(
                    id=auction_id, is_completed=False, ends_at__gt=timezone.now()
                )
            except HeroAuction.DoesNotExist:
                return Response({"error": "Ø§ÛŒÙ† Ø­Ø±Ø§Ø¬ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯ ÛŒØ§ Ø¨Ù‡ Ù¾Ø§ÛŒØ§Ù† Ø±Ø³ÛŒØ¯Ù‡ Ø§Ø³Øª."}, status=404)

            min_required_gold = auction.current_bid + HeroAuction.MIN_BID_INCREMENT
            if bid_amount_in_gold < min_required_gold:
                min_in_currency = min_required_gold if currency == 'gold' else int(min_required_gold * SILVER_PER_GOLD)
                unit_label = "Ø³Ú©Ù‡ Ø·Ù„Ø§" if currency == 'gold' else "Ù†Ù‚Ø±Ù‡"
                return Response({"error": f"Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ Ø¨Ø§ÛŒØ¯ Ø­Ø¯Ø§Ù‚Ù„ {min_in_currency} {unit_label} Ø¨Ø§Ø´Ø¯."}, status=400)

            bidder = request.user
            if currency == 'gold':
                if bidder.gold_coins < bid_amount:
                    return Response({"error": "Ø³Ú©Ù‡ Ø·Ù„Ø§ÛŒ Ú©Ø§ÙÛŒ Ù†Ø¯Ø§Ø±ÛŒØ¯."}, status=400)
                bidder.gold_coins -= bid_amount
            else:
                if bidder.silver_coins < bid_amount:
                    return Response({"error": "Ù†Ù‚Ø±Ù‡ Ú©Ø§ÙÛŒ Ù†Ø¯Ø§Ø±ÛŒØ¯."}, status=400)
                bidder.silver_coins -= bid_amount
            bidder.save(update_fields=['gold_coins', 'silver_coins'])

            # Ø¨Ø§Ø²Ù¾Ø±Ø¯Ø§Ø®Øª Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ Ù‚Ø¨Ù„ÛŒØŒ Ø¯Ù‚ÛŒÙ‚Ø§ Ø¯Ø± Ù‡Ù…Ø§Ù† ÙˆØ§Ø­Ø¯ÛŒ Ú©Ù‡ Ù¾Ø±Ø¯Ø§Ø®Øª Ø´Ø¯Ù‡ Ø¨ÙˆØ¯
            if auction.current_bidder_id:
                previous_bidder = auction.current_bidder
                if auction.current_bid_currency == 'silver':
                    previous_bidder.silver_coins += auction.current_bid_original_amount
                else:
                    previous_bidder.gold_coins += auction.current_bid_original_amount
                previous_bidder.save(update_fields=['gold_coins', 'silver_coins'])

            auction.current_bid = int(round(bid_amount_in_gold))
            auction.current_bid_currency = currency
            auction.current_bid_original_amount = bid_amount
            auction.current_bidder = bidder
            auction.save()

        return Response({
            "message": "Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ Ø´Ù…Ø§ Ø«Ø¨Øª Ø´Ø¯.",
            "current_bid": auction.current_bid,
            "current_bid_currency": auction.current_bid_currency,
        })

class FarmListManageView(APIView):
    """Ù…Ø¯ÛŒØ±ÛŒØª Ø®ÙˆØ¯Ù ÙØ§Ø±Ù…â€ŒÙ„ÛŒØ³Øªâ€ŒÙ‡Ø§: Ø³Ø§Ø®ØªØŒ ØªØºÛŒÛŒØ± Ù†Ø§Ù…ØŒ Ø­Ø°Ù."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.has_gold_club:
            return Response({"error": "Ø¨Ø±Ø§ÛŒ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡ Ø¨Ù‡ Ú©Ù„ÙˆÙ¾ Ø·Ù„Ø§ÛŒÛŒ Ù†ÛŒØ§Ø² Ø¯Ø§Ø±ÛŒØ¯."}, status=403)

        lists = FarmList.objects.filter(player=request.user).annotate(
            entries_count=Count('entries')
        )
        return Response([
            {"id": fl.id, "name": fl.name, "entries_count": fl.entries_count}
            for fl in lists
        ])

    def post(self, request):
        if not request.user.has_gold_club:
            return Response({"error": "Ø¨Ø±Ø§ÛŒ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² Ù„ÛŒØ³Øª Ù…Ø²Ø±Ø¹Ù‡ Ø¨Ù‡ Ú©Ù„ÙˆÙ¾ Ø·Ù„Ø§ÛŒÛŒ Ù†ÛŒØ§Ø² Ø¯Ø§Ø±ÛŒØ¯."}, status=403)

        name = (request.data.get('name') or '').strip() or 'Ù„ÛŒØ³Øª Ø¬Ø¯ÛŒØ¯'
        farm_list = FarmList.objects.create(player=request.user, name=name)
        return Response({"id": farm_list.id, "name": farm_list.name}, status=201)

    def patch(self, request):
        farm_list_id = request.data.get('farm_list_id')
        new_name = (request.data.get('name') or '').strip()
        if not new_name:
            return Response({"error": "Ù†Ø§Ù… Ø¬Ø¯ÛŒØ¯ Ù†Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ Ø®Ø§Ù„ÛŒ Ø¨Ø§Ø´Ø¯."}, status=400)
        try:
            farm_list = FarmList.objects.get(id=farm_list_id, player=request.user)
        except FarmList.DoesNotExist:
            return Response({"error": "Ù„ÛŒØ³Øª ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)
        farm_list.name = new_name
        farm_list.save(update_fields=['name'])
        return Response({"message": "Ù†Ø§Ù… Ù„ÛŒØ³Øª ØªØºÛŒÛŒØ± Ú©Ø±Ø¯.", "name": farm_list.name})

    def delete(self, request):
        farm_list_id = request.query_params.get('farm_list_id')
        deleted, _ = FarmList.objects.filter(id=farm_list_id, player=request.user).delete()
        if not deleted:
            return Response({"error": "Ù„ÛŒØ³Øª ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)
        return Response({"message": "Ù„ÛŒØ³Øª Ø­Ø°Ù Ø´Ø¯."})


class ReinforcementReportListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import ReinforcementReport
        qs = ReinforcementReport.objects.filter(
            Q(sender_player=request.user, hidden_from_sender=False) |
            Q(receiver_player=request.user, hidden_from_receiver=False)
        ).order_by('-created_at')[:100]

        def serialize(r):
            is_sender = r.sender_player_id == request.user.id
            return {
                "id": r.id,
                "is_sender": is_sender,
                "source_village_name": r.source_village_name,
                "target_village_name": r.target_village_name,
                "source_coords": r.source_coords,
                "target_coords": r.target_coords,
                "troops_sent": r.troops_sent,
                "hero_sent": r.hero_sent,
                "is_read": r.is_read_by_sender if is_sender else r.is_read_by_receiver,
                "created_at": r.created_at,
            }

        return Response([serialize(r) for r in qs])


class ReinforcementReportDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, report_id):
        from .models import ReinforcementReport
        try:
            r = ReinforcementReport.objects.get(
                Q(id=report_id) & (Q(sender_player=request.user) | Q(receiver_player=request.user))
            )
        except ReinforcementReport.DoesNotExist:
            return Response({"error": "Ú¯Ø²Ø§Ø±Ø´ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)

        is_sender = r.sender_player_id == request.user.id
        if is_sender and not r.is_read_by_sender:
            r.is_read_by_sender = True
            r.save(update_fields=['is_read_by_sender'])
        elif not is_sender and not r.is_read_by_receiver:
            r.is_read_by_receiver = True
            r.save(update_fields=['is_read_by_receiver'])
        return Response({"message": "Ø®ÙˆØ§Ù†Ø¯Ù‡ Ø´Ø¯"})

    def delete(self, request, report_id):
        from .models import ReinforcementReport
        try:
            r = ReinforcementReport.objects.get(
                Q(id=report_id) & (Q(sender_player=request.user) | Q(receiver_player=request.user))
            )
        except ReinforcementReport.DoesNotExist:
            return Response({"error": "Ú¯Ø²Ø§Ø±Ø´ ÛŒØ§ÙØª Ù†Ø´Ø¯."}, status=404)
        if r.sender_player_id == request.user.id:
            r.hidden_from_sender = True
        else:
            r.hidden_from_receiver = True
        r.save()
        return Response({"message": "Ú¯Ø²Ø§Ø±Ø´ Ø­Ø°Ù Ø´Ø¯."})
