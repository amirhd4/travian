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

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
            target_village = Village.objects.get(id=target_id)
        except Village.DoesNotExist:
            return Response({"error": "مبدا یا مقصد یافت نشد."}, status=404)

        # اجرای تراکنش اتمیک برای جلوگیری از باگ دوگانه‌سوزی (Double-spending)
        with transaction.atomic():
            # حلقه روی نیروهای درخواستی کاربر برای کسر از دیتابیس
            for troop_id_str, count_to_send in payload.items():
                count_to_send = int(count_to_send)
                if count_to_send <= 0:
                    continue

                try:
                    # قفل‌گذاری روی سطر دیتابیس در زمان بررسی موجودی
                    village_troop = VillageTroop.objects.select_for_update().get(
                        village=source_village,
                        troop_type_id=int(troop_id_str)
                    )

                    if village_troop.count < count_to_send:
                        return Response({"error": f"نیروی کافی برای شناسه {troop_id_str} ندارید."}, status=400)

                    # کسر دقیق نیرو و ذخیره
                    village_troop.count -= count_to_send
                    village_troop.save()

                except VillageTroop.DoesNotExist:
                    return Response({"error": f"شما این نوع نیرو (شناسه {troop_id_str}) را در دهکده ندارید."},
                                    status=400)

            # محاسبه زمان رسیدن (در سرور واقعی بر اساس فاصله و سرعت کندترین نیرو محاسبه می‌شود)
            arrival_time = timezone.now() + datetime.timedelta(minutes=10)

            TroopMovement.objects.create(
                source_village=source_village,
                target_village=target_village,
                movement_type=movement_type,
                troops_payload=payload,
                arrival_time=arrival_time
            )

            # ثبت گزارش ارسال نیرو در سیستم لاگ
            GameLog.objects.create(
                village=source_village,
                log_type='COMBAT',
                description=f"اعزام نیرو ({movement_type}) به سمت دهکده {target_village.name} با موفقیت انجام شد."
            )

        return Response({"message": "نیروها با موفقیت ارسال شدند و از دهکده شما کسر گردیدند."})


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from apps.game_engine.models import Village, GameLog


class BarracksTrainView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        troop_type = str(request.data.get('troop_type'))  # '1': گرزدار, '2': نیزه‌دار
        quantity = int(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({"error": "تعداد نیرو برای آموزش نامعتبر است."}, status=400)

        # هزینه‌های ساخت هر واحد نیرو (در نسخه کامل باید از دیتابیس یا فایل کانفیگ خوانده شود)
        unit_costs = {
            '1': {'wood': 95, 'clay': 75, 'iron': 40, 'crop': 40, 'name': 'گرزدار'},
            '2': {'wood': 145, 'clay': 70, 'iron': 85, 'crop': 40, 'name': 'نیزه‌دار'}
        }

        if troop_type not in unit_costs:
            return Response({"error": "نوع نیروی درخواستی وجود ندارد."}, status=400)

        cost = unit_costs[troop_type]
        total_cost = {
            'wood': cost['wood'] * quantity,
            'clay': cost['clay'] * quantity,
            'iron': cost['iron'] * quantity,
            'crop': cost['crop'] * quantity,
        }

        try:
            with transaction.atomic():
                # قفل‌گذاری روی دهکده برای جلوگیری از Race Condition
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)

                # بررسی موجودی منابع
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

                # اضافه کردن نیرو به دهکده
                # نکته: در یک سرور واقعی، نیروها وارد صف (Queue) سلری می‌شوند تا پس از گذشت زمانِ ساخت اضافه شوند.
                # برای این مرحله از توسعه، نیروها را مستقیماً اضافه می‌کنیم.
                current_troops = village.troops if isinstance(village.troops, dict) else {}
                current_amount = current_troops.get(troop_type, 0)
                current_troops[troop_type] = current_amount + quantity
                village.troops = current_troops

                village.save()

                # ثبت گزارش سیستم
                GameLog.objects.create(
                    village=village,
                    log_type='BUILDING',
                    description=f"آموزش {quantity} سرباز {cost['name']} در پادگان انجام شد."
                )

            return Response({
                "message": f"تعداد {quantity} {cost['name']} با موفقیت به ارتش شما پیوستند!",
                "troops": current_troops
            })

        except Village.DoesNotExist:
            return Response({"error": "دهکده مورد نظر یافت نشد یا متعلق به شما نیست."}, status=404)