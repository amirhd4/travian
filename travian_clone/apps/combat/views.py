from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

import datetime

from .models import (
    TroopMovement, VillageTroop, TroopType, Hero, PlayerHeroItem, Animal, VillageAnimal,
    TrainingQueue, Adventure, FarmListEntry, TroopUpgrade, CombatReport, TrappedTroop,
)
from .movement_utils import dispatch_troop_movement
from .tasks import resolve_hero_adventure
from apps.game_engine.engine import schedule_game_event
from .hero_utils import sync_hero_health, calculate_travel_seconds_to_point, DIFFICULTY_SETTINGS
from apps.game_engine.models import Village, GameLog, VillageBuilding, ServerSetting

from .utils import get_required_training_building


class SendTroopsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        movement_type = request.data.get('movement_type', 'ATTACK')
        payload = request.data.get('troops_payload', {})
        send_hero = bool(request.data.get('send_hero', False))
        catapult_target_building = request.data.get('catapult_target_building') or None  # ✅ جدید

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
            target_village = Village.objects.get(id=target_id)
        except Village.DoesNotExist:
            return Response({"error": "مبدا یا مقصد یافت نشد."}, status=404)

        success, result = dispatch_troop_movement(
            request.user, source_village, target_village, movement_type, payload,
            send_hero=send_hero,
            catapult_target_building=catapult_target_building,  # ✅ جدید
        )
        if not success:
            return Response({"error": result}, status=400)

        return Response({"message": "نیروها با موفقیت اعزام شدند و در زمان مقرر به مقصد می‌رسند."})


class BarracksTrainView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.game_engine.utils import is_server_finished
        if is_server_finished():
            return Response({"error": "این سرور به پایان رسیده و دیگر امکان آموزش نیرو وجود ندارد."}, status=400)

        village_id = request.data.get('village_id')
        troop_type_id = request.data.get('troop_type')
        quantity = int(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({"error": "تعداد نیرو برای آموزش نامعتبر است."}, status=400)

        try:
            troop_info = TroopType.objects.get(id=troop_type_id, tribe=request.user.tribe)
        except TroopType.DoesNotExist:
            return Response({"error": "این نیرو مختص نژاد شما نیست یا وجود ندارد."}, status=400)

        total_cost = {
            'wood': troop_info.wood_cost * quantity,
            'clay': troop_info.clay_cost * quantity,
            'iron': troop_info.iron_cost * quantity,
            'crop': troop_info.crop_cost * quantity,
        }

        try:
            with transaction.atomic():
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)

                required_building_name = get_required_training_building(troop_info)
                if not VillageBuilding.objects.filter(
                        village=village, building_type__name=required_building_name, level__gt=0
                ).exists():
                    return Response(
                        {
                            "error": f"برای آموزش {troop_info.name} ابتدا باید یک «{required_building_name}» در این دهکده بسازید."},
                        status=400
                    )

                # بررسی دقیق موجودی
                if (village.wood < total_cost['wood'] or
                        village.clay < total_cost['clay'] or
                        village.iron < total_cost['iron'] or
                        village.crop < total_cost['crop']):
                    return Response({"error": "منابع دهکده برای آموزش این تعداد نیرو کافی نیست."}, status=400)

                # کسر منابع همین الان انجام می‌شود (سرمایه‌گذاری در صف آموزش)
                village.wood -= total_cost['wood']
                village.clay -= total_cost['clay']
                village.iron -= total_cost['iron']
                village.crop -= total_cost['crop']
                village.save()

                from apps.game_engine.artifacts import get_training_speed_multiplier  # ✅ جدید

                raw_duration = troop_info.base_train_time * quantity
                artifact_multiplier = get_training_speed_multiplier(request.user)  # ✅ اثر «جنگ‌آموز»
                duration_after_artifact = raw_duration / artifact_multiplier

                # ✅ FIX همزمان: قبلا finishes_at (شمارش معکوس UI) اصلا سرعت
                # آموزش سرور (troop_training_speed) را لحاظ نمی‌کرد؛ فقط زمان
                # واقعیِ تکمیل (از طریق schedule_game_event) این سرعت را
                # اعمال می‌کرد -> روی سرورهای پرسرعت، عدد نمایش‌داده‌شده به
                # بازیکن اشتباه (خیلی بیشتر از واقعیت) بود.
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
                    description=f"آموزش {quantity} سرباز {troop_info.name} در پادگان آغاز شد."
                )

                transaction.on_commit(lambda: schedule_game_event(
                    village_id=village.id,
                    event_type="TROOP_RECRUITMENT",
                    base_duration_seconds=duration_after_artifact,
                    # ✅ اثر کتیبه از قبل اعمال شده؛ سرعت سرور داخل خودِ schedule_game_event اعمال می‌شود
                    details={"troop_id": troop_info.id, "count": quantity, "queue_id": queue_item.id}
                ))

            return Response({
                "message": (
                    f"آموزش {quantity} {troop_info.name} در صف پادگان قرار گرفت "
                    f"و پس از اتمام، به‌طور خودکار به نیروهای دهکده اضافه می‌شود."
                )
            })

        except Village.DoesNotExist:
            return Response({"error": "دهکده مورد نظر یافت نشد یا متعلق به شما نیست."}, status=404)


class TroopTypeCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # ✅ فقط نیروهای متعلق به نژاد خود بازیکن (ناتار هرگز نمایش داده نمی‌شود)
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
                "required_building": get_required_training_building(t),
            }
            for t in troop_types
        ])


class VillageTroopListView(APIView):
    """نیروهای واقعی مستقر در یک دهکده مشخص (برای پر کردن فرم‌های اعزام نیرو)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

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
    """صف آموزش فعال یک دهکده مشخص، به همراه زمان باقی‌مانده هر بچ."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

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
    """اطلاعات قهرمان بازیکن فعلی + کوله‌پشتی او + وضعیت ماجراجویی."""
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

            # ✅ جدید: امتیازات قابل تخصیص قهرمان
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
                    "defense_bonus": inv.item.defense_bonus,   # ✅ جدید
                    "speed_bonus": inv.item.speed_bonus,
                    "is_equipped": inv.is_equipped,
                }
                for inv in inventory
            ]
        })


class HeroEquipItemView(APIView):
    """پوشیدن/درآوردن یک آیتم از کوله‌پشتی قهرمان. هر بار فقط یک آیتم از هر نوع
    (کلاه‌خود/سلاح/اسب) می‌تواند هم‌زمان پوشیده باشد."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        inventory_id = request.data.get('inventory_id')
        equip = bool(request.data.get('equip', True))

        try:
            hero = Hero.objects.get(player=request.user)
            inv_item = PlayerHeroItem.objects.select_related('item').get(id=inventory_id, hero=hero)
        except (Hero.DoesNotExist, PlayerHeroItem.DoesNotExist):
            return Response({"error": "آیتم یافت نشد."}, status=404)

        with transaction.atomic():
            if equip:
                PlayerHeroItem.objects.filter(
                    hero=hero, item__item_type=inv_item.item.item_type, is_equipped=True
                ).update(is_equipped=False)
            inv_item.is_equipped = equip
            inv_item.save()

        return Response({"message": "تجهیزات قهرمان به‌روزرسانی شد."})


class AdventureListView(APIView):
    """فهرست ماجراجویی‌های فعال و در دسترس بازیکن."""
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
    """اعزام قهرمان به یک نقطه ماجراجویی مشخص."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        adventure_id = request.data.get('adventure_id')

        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "قهرمانی برای شما یافت نشد."}, status=404)

        if not hero.is_alive:
            return Response({"error": "قهرمان شما از پای درآمده و قادر به ماجراجویی نیست."}, status=400)
        if hero.is_on_adventure:
            if hero.is_away:
                return Response({"error": "قهرمان شما در یک ماموریت نظامی است و نمی‌تواند به ماجراجویی برود."},
                                status=400)
            return Response({"error": "قهرمان شما هم‌اکنون در حال ماجراجویی است."}, status=400)
        if hero.health < 20:
            return Response({"error": "سلامتی قهرمان برای این ماجراجویی کافی نیست؛ صبر کنید تا ترمیم شود."}, status=400)
        if not hero.home_village:
            return Response({"error": "قهرمان شما دهکده خانگی مشخصی ندارد."}, status=400)

        try:
            adventure = Adventure.objects.get(id=adventure_id, player=request.user, is_completed=False)
        except Adventure.DoesNotExist:
            return Response({"error": "این ماجراجویی یافت نشد یا قبلا انجام شده است."}, status=404)

        settings_ = DIFFICULTY_SETTINGS[adventure.difficulty]
        if hero.level < settings_["min_hero_level"]:
            return Response(
                {"error": f"سطح قهرمان شما کافی نیست (حداقل سطح {settings_['min_hero_level']} لازم است)."},
                status=400
            )

        travel_seconds = calculate_travel_seconds_to_point(hero.home_village, adventure.x_coord, adventure.y_coord)
        round_trip_seconds = travel_seconds * 2 + 60  # رفت + برگشت + کمی زمان نبرد
        returns_at = timezone.now() + datetime.timedelta(seconds=round_trip_seconds)

        hero.is_on_adventure = True
        hero.adventure_returns_at = returns_at
        hero.save()

        resolve_hero_adventure.apply_async(args=[hero.id, adventure.id], eta=returns_at)

        return Response({
            "message": f"قهرمان به سمت ماجراجویی اعزام شد و در {round(round_trip_seconds/60)} دقیقه بازمی‌گردد.",
            "returns_at": returns_at,
        })


class AnimalCatalogView(APIView):
    """فهرست حیوانات نگهبانی که با طلا قابل خرید هستند."""
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
    """خرید حیوان نگهبان با سکه طلا برای تقویت دفاع یک دهکده مشخص."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        animal_id = request.data.get('animal_id')
        quantity = int(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({"error": "تعداد نامعتبر است."}, status=400)

        try:
            animal = Animal.objects.get(id=animal_id)
        except Animal.DoesNotExist:
            return Response({"error": "این حیوان در فروشگاه موجود نیست."}, status=404)

        total_cost = animal.gold_price * quantity

        with transaction.atomic():
            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

            player = request.user
            if player.gold_coins < total_cost:
                return Response({"error": "سکه طلای کافی ندارید."}, status=400)

            player.gold_coins -= total_cost
            player.save()

            village_animal, _ = VillageAnimal.objects.select_for_update().get_or_create(
                village=village, animal=animal, defaults={'count': 0}
            )
            village_animal.count += quantity
            village_animal.save()

        return Response({"message": f"{quantity} عدد {animal.name} برای دفاع از {village.name} خریداری شد."})


class VillageMovementsView(APIView):
    """
    نمایش نیروهای در حال حرکت (اعزامی و ورودی) برای یک دهکده مشخص.

    قبل از این ویو، هیچ راهی برای بازیکن وجود نداشت که ببیند چه حمله‌ای
    در راه دهکده‌اش است یا نیروهای اعزامی‌اش کِی می‌رسند - این یکی از
    حیاتی‌ترین بخش‌های گیم‌پلی تراوین (Rally Point) بود که کاملا غایب بود.

    نکته امنیتی/گیم‌پلی: طبق قوانین اصلی تراوین، مدافع فقط از «حمله‌ای در
    راه است» و زمان رسیدن خبردار می‌شود، نه از ترکیب دقیق نیروهای مهاجم؛
    فقط پشتیبانی نظامی (REINFORCEMENT) و بازگشت نیروهای خودی (RETURN) با
    جزئیات کامل نمایش داده می‌شوند.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

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
                # حمله/غارت/شناسایی: ترکیب نیرو و نام دقیق مبدا مخفی می‌ماند
                data["movement_type_display"] = "⚔️ حمله در راه است"
                data["source_name"] = None
                data["troops_payload"] = None
                data["is_hostile"] = True
            return data

        return Response({
            "outgoing": [serialize_outgoing(m) for m in outgoing],
            "incoming": [serialize_incoming(m) for m in incoming],
        })


class FarmListView(APIView):
    """فهرست کامل و ایجاد ردیف جدید در لیست مزرعه."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = FarmListEntry.objects.filter(player=request.user).select_related('source_village', 'target_village')
        return Response([
            {
                "id": e.id,
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
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        troops_payload = request.data.get('troops_payload', {})

        if not troops_payload or not any(int(v or 0) > 0 for v in troops_payload.values()):
            return Response({"error": "حداقل یک نوع نیرو برای این ردیف مشخص کنید."}, status=400)

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده مبدا یافت نشد یا متعلق به شما نیست."}, status=404)

        try:
            target_village = Village.objects.get(id=target_id)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده مقصد یافت نشد."}, status=404)

        if source_village.id == target_village.id:
            return Response({"error": "نمی‌توانید دهکده خودتان را هدف مزرعه قرار دهید."}, status=400)

        entry = FarmListEntry.objects.create(
            player=request.user,
            source_village=source_village,
            target_village=target_village,
            troops_payload=troops_payload,
        )
        return Response({"message": "ردیف جدید به لیست مزرعه اضافه شد.", "id": entry.id}, status=201)


class FarmListEntryDetailView(APIView):
    """حذف یک ردیف از لیست مزرعه."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, entry_id):
        deleted, _ = FarmListEntry.objects.filter(id=entry_id, player=request.user).delete()
        if not deleted:
            return Response({"error": "ردیف مورد نظر یافت نشد."}, status=404)
        return Response({"message": "ردیف از لیست مزرعه حذف شد."})


class FarmListRunView(APIView):
    """اجرای یک ردیف مشخص (entry_id) یا کل لیست مزرعه (run_all) با یک کلیک."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        entry_id = request.data.get('entry_id')
        run_all = request.data.get('run_all', False)

        if not entry_id and not run_all:
            return Response({"error": "باید entry_id یا run_all مشخص شود."}, status=400)

        entries_qs = FarmListEntry.objects.filter(player=request.user).select_related('source_village', 'target_village')
        if entry_id:
            entries_qs = entries_qs.filter(id=entry_id)

        results = []
        for entry in entries_qs:
            success, result = dispatch_troop_movement(
                request.user, entry.source_village, entry.target_village,
                'RAID', entry.troops_payload, farm_list_entry=entry,
            )
            results.append({
                "entry_id": entry.id,
                "target_name": entry.target_village.name,
                "success": success,
                "message": "اعزام شد" if success else result,
            })

        dispatched_count = sum(1 for r in results if r["success"])
        return Response({
            "message": f"{dispatched_count} از {len(results)} ردیف با موفقیت اعزام شد.",
            "results": results,
        })


class BlacksmithView(APIView):
    """وضعیت و شروع ارتقای نیرو در آهنگری یک دهکده مشخص."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        blacksmith = VillageBuilding.objects.filter(village=village, building_type__name="آهنگری").first()
        if not blacksmith or blacksmith.level <= 0:
            return Response({"error": "ابتدا باید آهنگری بسازید.", "has_blacksmith": False}, status=400)

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
                return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

            blacksmith = VillageBuilding.objects.filter(village=village, building_type__name="آهنگری").first()
            if not blacksmith or blacksmith.level <= 0:
                return Response({"error": "ابتدا باید آهنگری بسازید."}, status=400)

            try:
                troop_type = TroopType.objects.get(id=troop_type_id, tribe=request.user.tribe)
            except TroopType.DoesNotExist:
                return Response({"error": "این نیرو مختص نژاد شما نیست."}, status=400)

            upgrade, _ = TroopUpgrade.objects.select_for_update().get_or_create(
                village=village, troop_type=troop_type
            )
            if upgrade.is_upgrading:
                return Response({"error": "این نیرو در حال حاضر در حال ارتقا است."}, status=400)
            if upgrade.level >= TroopUpgrade.MAX_LEVEL:
                return Response({"error": f"این نیرو به حداکثر لول ({TroopUpgrade.MAX_LEVEL}) رسیده."}, status=400)

            next_level = upgrade.level + 1
            req_wood = int(troop_type.wood_cost * 1.6 * next_level)
            req_clay = int(troop_type.clay_cost * 1.6 * next_level)
            req_iron = int(troop_type.iron_cost * 1.6 * next_level)
            req_crop = int(troop_type.crop_cost * 1.6 * next_level)

            if village.wood < req_wood or village.clay < req_clay or village.iron < req_iron or village.crop < req_crop:
                return Response({"error": "منابع کافی نیست."}, status=400)

            village.wood -= req_wood; village.clay -= req_clay
            village.iron -= req_iron; village.crop -= req_crop
            village.save()

            duration = 1800 * next_level  # هر لول ۳۰ دقیقه پایه (تحت تاثیر سرعت سرور نیست، ولی می‌توان مشابه بالا اضافه کرد)
            upgrade.is_upgrading = True
            upgrade.upgrade_ends_at = timezone.now() + datetime.timedelta(seconds=duration)
            upgrade.save()

            from .tasks import complete_troop_upgrade
            transaction.on_commit(lambda: complete_troop_upgrade.apply_async(
                args=[upgrade.id], eta=upgrade.upgrade_ends_at
            ))

        return Response({"message": f"ارتقای {troop_type.name} به لول {next_level} آغاز شد."})


class HeroAllocatePointsView(APIView):
    """تخصیص امتیازهای قابل توزیع قهرمان (قدرت مبارزه/تهاجمی/دفاعی/منابع)."""
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
            return Response({"error": "خصیصه یا مقدار نامعتبر است."}, status=400)

        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "قهرمانی برای شما یافت نشد."}, status=404)

        if amount > hero.available_attribute_points:
            return Response({"error": "امتیاز کافی برای این تخصیص ندارید."}, status=400)

        setattr(hero, field_name, getattr(hero, field_name) + amount)
        hero.save()

        return Response({
            "message": "امتیاز با موفقیت تخصیص یافت.",
            "available_attribute_points": hero.available_attribute_points,
        })


class HeroSettingsView(APIView):
    """تنظیم نوع منبع تولیدی قهرمان و مشارکت در دفاع دهکده خانگی."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "قهرمانی برای شما یافت نشد."}, status=404)

        resource_type = request.data.get('resource_production_type')
        if resource_type:
            valid_types = dict(Hero.RESOURCE_CHOICES)
            if resource_type not in valid_types:
                return Response({"error": "نوع منبع نامعتبر است."}, status=400)
            hero.resource_production_type = resource_type

        if 'participates_in_defense' in request.data:
            hero.participates_in_defense = bool(request.data.get('participates_in_defense'))

        hero.save()
        return Response({"message": "تنظیمات قهرمان به‌روزرسانی شد."})


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
            return Response({"error": "قهرمانی برای شما یافت نشد."}, status=404)
        return Response({"is_alive": hero.is_alive, "cost": self._calculate_cost(hero)})

    def post(self, request):
        village_id = request.data.get('village_id')

        # ✅ FIX: select_for_update حالا داخل transaction.atomic() است.
        # قبلا خارج از هر تراکنشی بود و روی Postgres با
        # TransactionManagementError کرش می‌کرد.
        with transaction.atomic():
            try:
                hero = Hero.objects.select_for_update().get(player=request.user)
            except Hero.DoesNotExist:
                return Response({"error": "قهرمانی برای شما یافت نشد."}, status=404)

            if hero.is_alive:
                return Response({"error": "قهرمان شما در حال حاضر زنده است."}, status=400)

            cost = self._calculate_cost(hero)

            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

            if (village.wood < cost['wood'] or village.clay < cost['clay'] or
                    village.iron < cost['iron'] or village.crop < cost['crop']):
                return Response({"error": "منابع این دهکده برای احیای قهرمان کافی نیست."}, status=400)

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

        return Response({"message": "قهرمان شما با موفقیت احیا شد و در حال استراحت است."})


class HeroAppearanceView(APIView):
    """ذخیره‌ی ظاهر سفارشی قهرمان (بخش «ظاهر» مشابه تراوین اصلی)."""
    permission_classes = [IsAuthenticated]

    APPEARANCE_FIELDS = [
        'head_style', 'hair_color', 'hair_style', 'ear_style',
        'eyebrow_style', 'eye_style', 'nose_style', 'mouth_style',
    ]

    def post(self, request):
        try:
            hero = Hero.objects.get(player=request.user)
        except Hero.DoesNotExist:
            return Response({"error": "قهرمانی برای شما یافت نشد."}, status=404)

        gender = request.data.get('gender')
        if gender:
            if gender not in dict(Hero.GENDER_CHOICES):
                return Response({"error": "جنسیت نامعتبر است."}, status=400)
            hero.gender = gender

        for field in self.APPEARANCE_FIELDS:
            if field in request.data:
                try:
                    value = int(request.data[field])
                except (TypeError, ValueError):
                    return Response({"error": f"مقدار {field} نامعتبر است."}, status=400)
                if not (1 <= value <= Hero.APPEARANCE_OPTION_COUNT):
                    return Response({"error": f"مقدار {field} خارج از محدوده مجاز است."}, status=400)
                setattr(hero, field, value)

        hero.save()
        return Response({"message": "ظاهر قهرمان با موفقیت ذخیره شد."})


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
        count = CombatReport.objects.filter(
            Q(attacker_player=request.user, is_read_by_attacker=False, hidden_from_attacker=False) |
            Q(defender_player=request.user, is_read_by_defender=False, hidden_from_defender=False)
        ).count()
        return Response({"unread_count": count})


class CombatReportDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            r = CombatReport.objects.get(
                Q(id=report_id) & (Q(attacker_player=request.user) | Q(defender_player=request.user))
            )
        except CombatReport.DoesNotExist:
            return Response({"error": "گزارش یافت نشد."}, status=404)

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
            return Response({"error": "گزارش یافت نشد."}, status=404)

        if r.attacker_player_id == request.user.id:
            r.hidden_from_attacker = True
        else:
            r.hidden_from_defender = True
        r.save()
        return Response({"message": "گزارش حذف شد."})


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
    """صاحب تله می‌تواند از سر لطف نیروهای اسیر را آزاد کند تا به مالک اصلی بازگردند."""
    permission_classes = [IsAuthenticated]

    def post(self, request, entry_id):
        try:
            entry = TrappedTroop.objects.select_related(
                'trapper_village', 'troop_type', 'original_owner_player'
            ).get(id=entry_id, trapper_village__player=request.user)
        except TrappedTroop.DoesNotExist:
            return Response({"error": "این نیروی اسیرشده یافت نشد."}, status=404)

        home_village = Village.objects.filter(
            player=entry.original_owner_player, is_capital=True
        ).first() or Village.objects.filter(player=entry.original_owner_player).order_by('id').first()

        if home_village:
            vt, _ = VillageTroop.objects.get_or_create(
                village=home_village, troop_type=entry.troop_type, defaults={'count': 0}
            )
            vt.count += entry.count
            vt.save()
            message = f"{entry.count} نیروی {entry.troop_type.name} آزاد شد و به {home_village.name} بازگشت."
        else:
            message = f"{entry.count} نیروی {entry.troop_type.name} آزاد شد (مالک اصلی دیگر دهکده‌ای ندارد)."

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
        auction_id = request.data.get('auction_id')
        try:
            bid_amount = int(request.data.get('bid_amount', 0))
        except (TypeError, ValueError):
            return Response({"error": "مقدار پیشنهاد نامعتبر است."}, status=400)

        with transaction.atomic():
            try:
                auction = HeroAuction.objects.select_for_update().get(
                    id=auction_id, is_completed=False, ends_at__gt=timezone.now()
                )
            except HeroAuction.DoesNotExist:
                return Response({"error": "این حراجی یافت نشد یا به پایان رسیده است."}, status=404)

            min_required = auction.current_bid + HeroAuction.MIN_BID_INCREMENT
            if bid_amount < min_required:
                return Response({"error": f"پیشنهاد باید حداقل {min_required} سکه طلا باشد."}, status=400)

            bidder = request.user
            if bidder.gold_coins < bid_amount:
                return Response({"error": "سکه طلای کافی ندارید."}, status=400)

            bidder.gold_coins -= bid_amount
            bidder.save(update_fields=['gold_coins'])

            if auction.current_bidder_id:
                previous_bidder = auction.current_bidder
                previous_bidder.gold_coins += auction.current_bid
                previous_bidder.save(update_fields=['gold_coins'])

            auction.current_bid = bid_amount
            auction.current_bidder = bidder
            auction.save()

        return Response({"message": "پیشنهاد شما ثبت شد.", "current_bid": auction.current_bid})