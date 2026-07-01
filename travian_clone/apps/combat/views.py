from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
import datetime
from .models import TroopMovement, VillageTroop
from apps.game_engine.models import Village, GameLog

class SendTroopsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        movement_type = request.data.get('movement_type', 'ATTACK')
        payload = request.data.get('troops_payload', {})

        if not payload:
            return Response({"error": "هیچ نیرویی برای ارسال انتخاب نشده است."}, status=400)

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
            target_village = Village.objects.get(id=target_id)
        except Village.DoesNotExist:
            return Response({"error": "مبدا یا مقصد یافت نشد."}, status=404)

        with transaction.atomic():
            for troop_id_str, count_to_send in payload.items():
                count_to_send = int(count_to_send)
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

            # در سیستم پروداکشن، این زمان باید بر اساس فرمول (فاصله / سرعت کندترین نیرو) محاسبه شود
            # در اینجا برای جلوگیری از پیچیدگی فعلاً روی ۱۰ دقیقه ثابت نگه داشته شده است
            arrival_time = timezone.now() + datetime.timedelta(minutes=10)

            TroopMovement.objects.create(
                source_village=source_village,
                target_village=target_village,
                movement_type=movement_type,
                troops_payload=payload,
                arrival_time=arrival_time
            )

            GameLog.objects.create(
                village=source_village,
                log_type='COMBAT',
                description=f"اعزام نیرو ({movement_type}) به سمت دهکده {target_village.name} انجام شد."
            )

        return Response({"message": "نیروها با موفقیت ارسال شدند."})


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