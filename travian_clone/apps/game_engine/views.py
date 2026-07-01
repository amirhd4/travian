from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from asgiref.sync import async_to_sync
from django.db import transaction
from django.contrib.auth import get_user_model

from django.utils import timezone

from .models import Village, VillageBuilding, ServerSetting
from .engine import schedule_game_event
from .utils import update_village_resources
from channels.layers import get_channel_layer
from .models import Transaction, Discount, GameLog
from .serializers import GameLogSerializer
from .models import Message
from .serializers import MessageSerializer

Player = get_user_model()


class UpgradeBuildingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        position = request.data.get('position')

        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=403)

        # ۱. به‌روزرسانی منابع در لحظه (Lazy Evaluation)
        update_village_resources(village)

        try:
            building = VillageBuilding.objects.get(village=village, position=position)
        except VillageBuilding.DoesNotExist:
            return Response({"error": "ساختمانی در این جایگاه یافت نشد."}, status=404)

        if building.is_upgrading:
            return Response({"error": "این ساختمان در حال حاضر در حال ارتقا است."}, status=400)

        # محاسبه هزینه ارتقا برای سطح بعدی (فرمول تصاعدی ساده: هزینه پایه * 1.5 ^ سطح فعلی)
        next_level = building.level + 1
        multiplier = 1.5 ** building.level
        req_wood = int(building.building_type.base_wood_cost * multiplier)
        req_clay = int(building.building_type.base_clay_cost * multiplier)
        req_iron = int(building.building_type.base_iron_cost * multiplier)
        req_crop = int(building.building_type.base_crop_cost * multiplier)

        # ۲. بررسی کفایت منابع
        if village.wood < req_wood or village.clay < req_clay or village.iron < req_iron or village.crop < req_crop:
            return Response({"error": "منابع کافی نیست."}, status=400)

        # ۳. کسر منابع
        village.wood -= req_wood
        village.clay -= req_clay
        village.iron -= req_iron
        village.crop -= req_crop
        village.save()

        # ۴. محاسبه زمان و ارسال به موتور زمان‌بندی
        base_time = building.building_type.base_build_time * (1.2 ** building.level)
        building.is_upgrading = True
        building.save()

        # فراخوانی تابع زمان‌بندی (که در engine.py ساختیم)
        schedule_game_event(
            village_id=village.id,
            event_type="BUILDING_UPGRADE",
            base_duration_seconds=base_time,
            details={"building_id": building.id, "next_level": next_level}
        )

        return Response({"message": "ارتقای ساختمان آغاز شد."})


class PaymentWebhookView(APIView):
    def post(self, request):
        authority = request.data.get('Authority')
        status = request.data.get('Status')

        if status == 'OK':
            try:
                transaction = Transaction.objects.get(authority=authority)
            except Transaction.DoesNotExist:
                return Response({"error": "تراکنش یافت نشد"}, status=404)

            if transaction.status == 'SUCCESS':
                return Response({"message": "قبلا تایید شده"}, status=200)

            package = transaction.package
            player = transaction.player

            # بررسی تخفیف فعال [cite: 102, 103]
            active_discount = Discount.objects.filter(
                start_time__lte=timezone.now(),
                end_time__gte=timezone.now(),
                is_active=True
            ).first()

            final_gold = package.gold_amount
            if active_discount:
                # اعمال بونوس درصد طلای بیشتر [cite: 104]
                final_gold += int(package.gold_amount * (active_discount.percentage / 100))

            player.gold_coins += final_gold
            player.save()
            transaction.status = 'SUCCESS'
            transaction.save()

            # ارسال نوتیفیکیشن زنده به کاربر از طریق وب‌سوکت [cite: 105]
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"player_{player.id}",
                {
                    "type": "send_game_update",
                    "message": {"type": "gold_added", "amount": final_gold}
                }
            )

            return Response({"status": "Verification Successful"}, status=200)
        return Response({"status": "Payment Failed"}, status=400)


class GameLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = GameLog.objects.filter(
            village__player=request.user
        ).order_by('-created_at')[:50]

        serializer = GameLogSerializer(logs, many=True)
        return Response(serializer.data)


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # در سناریوی واقعی، جمعیت از روی سطح ساختمان‌ها محاسبه می‌شود.
        # در اینجا لیست بازیکنان را گرفته و دیتای نمایشی برای جمعیت و شگفتی جهان تولید می‌کنیم.
        players = Player.objects.all().order_by('id')[:100]

        ranking_data = []
        ww_data = []

        for rank, p in enumerate(players, start=1):
            player_name = p.email.split('@')[0] if p.email else f"Player_{p.id}"

            # آمار کلی بازیکنان
            ranking_data.append({
                "rank": rank,
                "player": player_name,
                "alliance": "بدون اتحاد",
                "population": 1000 + (rank * 50)  # دیتای نمونه
            })

            # آمار شگفتی جهان (فقط برای نفرات برتر به عنوان نمونه)
            if rank <= 5:
                ww_data.append({
                    "rank": rank,
                    "player": player_name,
                    "ww_level": 50 - (rank * 5),
                    "natar_attacks": "دفع شده" if rank % 2 == 0 else "در راه است"
                })

        return Response({
            "general_ranking": ranking_data,
            "world_wonder": ww_data
        })


class MarketplaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        resources = request.data.get('resources', {'wood': 0, 'clay': 0, 'iron': 0, 'crop': 0})

        try:
            source_village = Village.objects.get(id=source_id, player=request.user)
            target_village = Village.objects.get(id=target_id)
        except Village.DoesNotExist:
            return Response({"error": "دهکده مبدا یا مقصد یافت نشد."}, status=404)

        wood = int(resources.get('wood', 0))
        clay = int(resources.get('clay', 0))
        iron = int(resources.get('iron', 0))
        crop = int(resources.get('crop', 0))
        total_resources = wood + clay + iron + crop

        if total_resources <= 0:
            return Response({"error": "مقدار منابع ارسالی باید بیشتر از صفر باشد."}, status=400)

        with transaction.atomic():
            # قفل‌گذاری روی دهکده مبدا
            source = Village.objects.select_for_update().get(id=source_id)

            # بررسی موجودی
            if source.wood < wood or source.clay < clay or source.iron < iron or source.crop < crop:
                return Response({"error": "منابع کافی در دهکده وجود ندارد."}, status=400)

            # کسر از مبدا
            source.wood -= wood
            source.clay -= clay
            source.iron -= iron
            source.crop -= crop
            source.save()

            # قفل‌گذاری و واریز به مقصد (در سیستم واقعی با تاخیر زمانی و توسط تجار انجام می‌شود)
            target = Village.objects.select_for_update().get(id=target_id)
            target.wood += wood
            target.clay += clay
            target.iron += iron
            target.crop += crop
            target.save()

            # ثبت لاگ تجارت
            GameLog.objects.create(
                village=source,
                log_type='TRADE',
                description=f"ارسال {total_resources} منبع به دهکده {target.name} انجام شد."
            )
            GameLog.objects.create(
                village=target,
                log_type='TRADE',
                description=f"دریافت {total_resources} منبع از دهکده {source.name}."
            )

        return Response({"message": "تجار با موفقیت منابع را تحویل دادند."})


class InboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # دریافت پیام‌های ورودی کاربر
        messages = Message.objects.filter(receiver=request.user).order_by('-created_at')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request):
        # ارسال پیام جدید
        receiver_id = request.data.get('receiver_id')
        subject = request.data.get('subject', '(بدون عنوان)')
        body = request.data.get('body', '')

        try:
            receiver = Player.objects.get(id=receiver_id)
        except Player.DoesNotExist:
            return Response({"error": "بازیکن مورد نظر یافت نشد."}, status=404)

        Message.objects.create(
            sender=request.user,
            receiver=receiver,
            subject=subject,
            body=body
        )
        return Response({"message": "کبوتر نامه‌بر با موفقیت ارسال شد."}, status=201)


class MessageReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # تغییر وضعیت پیام به خوانده شده
        try:
            message = Message.objects.get(pk=pk, receiver=request.user)
            message.is_read = True
            message.save()
            return Response({"status": "خوانده شد"})
        except Message.DoesNotExist:
            return Response({"error": "پیام یافت نشد."}, status=404)