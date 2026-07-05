from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
import datetime
from .models import TroopMovement, VillageTroop, TroopType, Hero, PlayerHeroItem, Animal, VillageAnimal
from .utils import calculate_travel_seconds
from .tasks import resolve_combat_movement
from apps.game_engine.models import Village, GameLog


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

                # کسر منابع
                village.wood -= total_cost['wood']
                village.clay -= total_cost['clay']
                village.iron -= total_cost['iron']
                village.crop -= total_cost['crop']
                village.save()

                # اضافه کردن نیرو به مدل صحیح (VillageTroop)
                # در حالت پروداکشن واقعی، این رکورد باید به جدول "صف آموزش" برود و توسط Celery بعدا اضافه شود
                village_troop, created = VillageTroop.objects.get_or_create(
                    village=village,
                    troop_type_id=troop_info.id,
                    defaults={'count': 0}
                )
                village_troop.count += quantity
                village_troop.save()

                GameLog.objects.create(
                    village=village,
                    log_type='BUILDING',
                    description=f"دستور آموزش {quantity} سرباز {troop_info.name} صادر شد."
                )

            return Response({
                "message": f"تعداد {quantity} {troop_info.name} با موفقیت به پادگان اضافه شدند!",
                "troops_count": village_troop.count
            })

        except Village.DoesNotExist:
            return Response({"error": "دهکده مورد نظر یافت نشد یا متعلق به شما نیست."}, status=404)


class HeroView(APIView):
    """اطلاعات قهرمان بازیکن فعلی + کوله‌پشتی او."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hero, _ = Hero.objects.get_or_create(player=request.user)
        inventory = PlayerHeroItem.objects.filter(hero=hero).select_related('item')

        return Response({
            "level": hero.level,
            "experience": hero.experience,
            "health": hero.health,
            "is_alive": hero.is_alive,
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