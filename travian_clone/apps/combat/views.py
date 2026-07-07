from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
import datetime
from .models import TroopMovement, VillageTroop, TroopType, Hero, PlayerHeroItem, Animal, VillageAnimal, TrainingQueue, Adventure
from .utils import calculate_travel_seconds
from .tasks import resolve_combat_movement, resolve_hero_adventure
from apps.game_engine.models import Village, GameLog
from apps.game_engine.engine import schedule_game_event
from .hero_utils import sync_hero_health, calculate_travel_seconds_to_point, DIFFICULTY_SETTINGS


class SendTroopsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        movement_type = request.data.get('movement_type', 'ATTACK')
        payload = request.data.get('troops_payload', {})

        valid_types = dict(TroopMovement.MOVEMENT_TYPES)
        if movement_type not in valid_types:
            return Response({"error": "نوع عملیات تاکتیکی نامعتبر است."}, status=400)

        if not payload or not any(int(v or 0) > 0 for v in payload.values()):
            return Response({"error": "هیچ نیرویی برای ارسال انتخاب نشده است."}, status=400)

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
            target_village = Village.objects.get(id=target_id)
        except Village.DoesNotExist:
            return Response({"error": "مبدا یا مقصد یافت نشد."}, status=404)

        if movement_type == 'ATTACK' and source_village.id == target_village.id:
            return Response({"error": "نمی‌توانید به دهکده خودتان حمله کنید."}, status=400)

        sent_troop_ids = [int(tid) for tid, qty in payload.items() if int(qty or 0) > 0]
        troop_types = {t.id: t for t in TroopType.objects.filter(id__in=sent_troop_ids)}
        missing_ids = set(sent_troop_ids) - set(troop_types.keys())
        if missing_ids:
            return Response({"error": f"نوع نیروی نامعتبر: {sorted(missing_ids)}"}, status=400)

        # کندترین نیرو سرعت کل ستون را تعیین می‌کند
        slowest_speed = min(t.speed for t in troop_types.values())

        with transaction.atomic():
            for troop_id_str, count_to_send in payload.items():
                count_to_send = int(count_to_send or 0)
                if count_to_send <= 0:
                    continue

                try:
                    # قفل‌گذاری و کسر نیرو
                    village_troop = VillageTroop.objects.select_for_update().get(
                        village=source_village,
                        troop_type_id=int(troop_id_str)
                    )

                    if village_troop.count < count_to_send:
                        return Response({"error": f"نیروی کافی برای شناسه {troop_id_str} ندارید."}, status=400)

                    village_troop.count -= count_to_send
                    village_troop.save()

                except VillageTroop.DoesNotExist:
                    return Response({"error": f"شما این نوع نیرو (شناسه {troop_id_str}) را در دهکده ندارید."}, status=400)

            # محاسبه زمان رسیدن واقعی بر اساس فاصله دو دهکده و سرعت کندترین نیرو
            # (قبلا این عدد همیشه ثابت و ۱۰ دقیقه بود)
            travel_seconds = calculate_travel_seconds(source_village, target_village, slowest_speed)
            arrival_time = timezone.now() + datetime.timedelta(seconds=travel_seconds)

            movement = TroopMovement.objects.create(
                source_village=source_village,
                target_village=target_village,
                movement_type=movement_type,
                troops_payload=payload,
                arrival_time=arrival_time,
            )

            GameLog.objects.create(
                village=source_village,
                log_type='COMBAT',
                description=f"اعزام نیرو ({movement.get_movement_type_display()}) به سمت دهکده {target_village.name} انجام شد."
            )

            # نکته حیاتی: قبلا اینجا هیچ تسکی زمان‌بندی نمی‌شد، پس هیچ
            # حمله‌ای هیچ‌وقت به نتیجه نمی‌رسید. حالا دقیقا در لحظه رسیدن
            # نیروها (arrival_time)، resolve_combat_movement اجرا می‌شود.
            transaction.on_commit(lambda: resolve_combat_movement.apply_async(
                args=[movement.id], eta=arrival_time
            ))

        return Response({"message": "نیروها با موفقیت اعزام شدند و در زمان مقرر به مقصد می‌رسند."})


class BarracksTrainView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        troop_type_id = request.data.get('troop_type')
        quantity = int(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({"error": "تعداد نیرو برای آموزش نامعتبر است."}, status=400)

        try:
            # خواندن مشخصات نیرو از دیتابیس به جای هاردکد کردن
            troop_info = TroopType.objects.get(id=troop_type_id)
        except TroopType.DoesNotExist:
            return Response({"error": "نوع نیروی درخواستی وجود ندارد."}, status=400)

        total_cost = {
            'wood': troop_info.wood_cost * quantity,
            'clay': troop_info.clay_cost * quantity,
            'iron': troop_info.iron_cost * quantity,
            'crop': troop_info.crop_cost * quantity,
        }

        try:
            with transaction.atomic():
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)

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

                # نکته حیاتی: قبلا این View بلافاصله و بدون هیچ تاخیری نیرو را
                # به VillageTroop اضافه می‌کرد، یعنی هیچ صف آموزش واقعی‌ای وجود
                # نداشت (آموزش ۱۰۰۰ سرباز دقیقا هم‌زمان با آموزش ۱ سرباز تمام
                # می‌شد) و هیچ رکورد قابل مشاهده‌ای از «الان چه چیزی در حال
                # آموزش است» وجود نداشت. حالا یک ردیف TrainingQueue واقعی
                # ساخته می‌شود که فرانت‌اند می‌تواند با شمارش معکوس نمایش دهد.
                total_duration = troop_info.base_train_time * quantity
                finishes_at = timezone.now() + datetime.timedelta(seconds=total_duration)

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
                    base_duration_seconds=total_duration,
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
    """
    فهرست همه نیروهای قابل آموزش با هزینه و زمان واقعی از دیتابیس.

    قبل از این ویو، Barracks.jsx فقط دو واحد را با هزینه‌های هاردکد در
    خود فایل React نمایش می‌داد؛ یعنی نیروهای مهاجر/کاراگاه که بعدا اضافه
    شدند اصلا در پادگان قابل آموزش نبودند، و اگر ادمین هزینه یک نیرو را
    در پنل مدیریت تغییر می‌داد، فرانت‌اند همچنان عدد قدیمی را نشان می‌داد.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        troop_types = TroopType.objects.all().order_by('id')
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
                    "wood": t.wood_cost,
                    "clay": t.clay_cost,
                    "iron": t.iron_cost,
                    "crop": t.crop_cost,
                },
                "crop_upkeep": t.crop_upkeep,
                "base_train_time": t.base_train_time,
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
            "inventory": [
                {
                    "id": inv.id,
                    "item_id": inv.item.id,
                    "name": inv.item.name,
                    "item_type": inv.item.item_type,
                    "attack_bonus": inv.item.attack_bonus,
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