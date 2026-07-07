from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from asgiref.sync import async_to_sync
from django.db import transaction
from django.db.models import Sum
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from django.utils import timezone
import datetime
import math

from .models import Village, VillageBuilding, ServerSetting
from .engine import schedule_game_event
from .utils import update_village_resources, calculate_crop_upkeep
from .services import found_new_village
from channels.layers import get_channel_layer
from .models import Transaction, Discount, GameLog
from .serializers import GameLogSerializer
from .models import Message
from .serializers import MessageSerializer
from .models import Alliance, AllianceMember, ResourceTrade
from .market_utils import get_total_merchants, get_available_merchants, calculate_merchant_travel_seconds, MERCHANT_CAPACITY
from .tasks.game_tasks import deliver_trade_resources

Player = get_user_model()


class VillageListView(APIView):
    """
    لیست تمام دهکده‌های بازیکن فعلی.

    قبل از این ویو، فرانت‌اند هیچ راهی برای دانستن آی‌دی واقعی دهکده‌ها
    نداشت و همیشه village_id=1 را هاردکد می‌کرد؛ به همین دلیل سیستم
    چند دهکده‌ای عملا کار نمی‌کرد. این endpoint دقیقا همان چیزی است که
    فرانت‌اند برای انتخاب «دهکده فعال» به آن نیاز دارد.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        villages = Village.objects.filter(player=request.user).order_by('-is_capital', 'id')

        data = [
            {
                "id": v.id,
                "name": v.name,
                "x_coord": v.x_coord,
                "y_coord": v.y_coord,
                "is_capital": v.is_capital,
                "wood": v.wood,
                "clay": v.clay,
                "iron": v.iron,
                "crop": v.crop,
            }
            for v in villages
        ]
        return Response(data)


class VillageDetailView(APIView):
    """
    اطلاعات زنده یک دهکده مشخص (منابع فعلی + نرخ تولید خالص).

    قبل از این ویو، ResourceBar.jsx هیچ درخواستی به سرور نمی‌زد و صرفا
    مقادیر پیش‌فرض استور Zustand را هر ثانیه در کلاینت افزایش می‌داد؛
    یعنی منابع نمایش داده شده هیچ ارتباطی با دیتابیس واقعی نداشت.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, village_id):
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        # همگام‌سازی منابع تا این لحظه (همون منطقی که هنگام ارتقای ساختمان اجرا می‌شه)
        update_village_resources(village)

        # ۱.۵. محدودیت صف ساخت‌وساز: در تراوین اصلی فقط یک ساختمان در هر
        # لحظه می‌تواند در حال ارتقا باشد (بدون Plus). قبلا این بررسی اصلا
        # وجود نداشت و بازیکن می‌توانست روی همه‌ی ۴۰ جایگاه هم‌زمان ارتقا بزند.
        if VillageBuilding.objects.filter(village=village, is_upgrading=True).exists():
            return Response(
                {"error": "در هر لحظه فقط یک ساختمان می‌تواند در حال ارتقا باشد. صبر کنید تا ساخت فعلی تمام شود."},
                status=400
            )

        net_crop_production = village.prod_crop - calculate_crop_upkeep(village)

        return Response({
            "id": village.id,
            "name": village.name,
            "x_coord": village.x_coord,
            "y_coord": village.y_coord,
            "is_capital": village.is_capital,
            "resources": {
                "wood": village.wood,
                "clay": village.clay,
                "iron": village.iron,
                "crop": village.crop,
            },
            "production": {
                "wood": village.prod_wood,
                "clay": village.prod_clay,
                "iron": village.prod_iron,
                "crop": net_crop_production,
            },
            "max_storage": village.max_storage,
            "max_granary": village.max_granary,
        })


class VillageBuildingsView(APIView):
    """
    فهرست کامل ساختمان‌های یک دهکده به همراه هزینه و زمان ارتقای سطح بعدی.

    قبل از این ویو، VillageMap.jsx به هیچ داده واقعی‌ای متصل نبود؛ چیدمان
    ساختمان‌ها، نام‌ها و سطوح همگی مستقیما در کد React هاردکد شده بودند و
    کلیک روی هر ساختمان فقط یک alert نمایش می‌داد (بدون هیچ ارتقای واقعی).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, village_id):
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        update_village_resources(village)

        buildings = VillageBuilding.objects.filter(village=village).select_related('building_type').order_by('position')

        data = []
        for b in buildings:
            multiplier = 1.5 ** b.level
            time_multiplier = 1.2 ** b.level
            data.append({
                "id": b.id,
                "position": b.position,
                "name": b.building_type.name,
                "category": b.building_type.category,
                "level": b.level,
                "is_upgrading": b.is_upgrading,
                "upgrade_end_time": b.upgrade_end_time,
                "provides_wall_defense": b.building_type.provides_wall_defense,
                "next_level_cost": {
                    "wood": int(b.building_type.base_wood_cost * multiplier),
                    "clay": int(b.building_type.base_clay_cost * multiplier),
                    "iron": int(b.building_type.base_iron_cost * multiplier),
                    "crop": int(b.building_type.base_crop_cost * multiplier),
                },
                "next_level_time_seconds": int(b.building_type.base_build_time * time_multiplier),
            })

        return Response({
            "village": {
                "id": village.id,
                "name": village.name,
                "is_capital": village.is_capital,
                "resources": {
                    "wood": village.wood,
                    "clay": village.clay,
                    "iron": village.iron,
                    "crop": village.crop,
                },
            },
            "buildings": data,
        })


class WorldMapView(APIView):
    """
    نقشه واقعی جهان اطراف یک مختصات مشخص.

    قبل از این ویو، WorldMap.jsx کاملا در کلاینت و با Math.random() یک
    شبکه ساختگی می‌ساخت که هیچ ارتباطی با دهکده‌های واقعی بازیکنان نداشت.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            center_x = int(request.query_params.get('x', 0))
            center_y = int(request.query_params.get('y', 0))
        except (TypeError, ValueError):
            return Response({"error": "مختصات نامعتبر است."}, status=400)

        # محدود کردن شعاع جلوی کوئری‌های خیلی سنگین را می‌گیرد
        radius = min(max(int(request.query_params.get('radius', 2) or 2), 1), 10)

        villages = Village.objects.filter(
            x_coord__range=(center_x - radius, center_x + radius),
            y_coord__range=(center_y - radius, center_y + radius),
        ).select_related('player')

        data = [
            {
                "id": v.id,
                "name": v.name,
                "x_coord": v.x_coord,
                "y_coord": v.y_coord,
                "owner": v.player.username,
                "is_natar": v.player.username == "Natars",
            }
            for v in villages
        ]
        return Response(data)


class FoundVillageView(APIView):
    """
    تاسیس دهکده جدید (Colonization). قبل از این ویو، هیچ راهی برای بازیکن
    (نه در فرانت و نه در بک‌اند) برای تاسیس دهکده دوم/سوم وجود نداشت.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id = request.data.get('source_village_id')
        target_x = request.data.get('target_x')
        target_y = request.data.get('target_y')
        name = request.data.get('name') or 'دهکده جدید'

        try:
            with transaction.atomic():
                try:
                    source_village = Village.objects.select_for_update().get(
                        id=source_id, player=request.user
                    )
                except Village.DoesNotExist:
                    return Response({"error": "دهکده مبدا یافت نشد یا متعلق به شما نیست."}, status=404)

                new_village = found_new_village(
                    request.user,
                    source_village,
                    target_x=int(target_x) if target_x not in (None, '') else None,
                    target_y=int(target_y) if target_y not in (None, '') else None,
                    name=name,
                )
        except ValidationError as e:
            return Response({"error": str(e.message) if hasattr(e, "message") else str(e)}, status=400)

        return Response({
            "message": (
                f"دهکده «{new_village.name}» با موفقیت در مختصات "
                f"({new_village.x_coord}|{new_village.y_coord}) تاسیس شد!"
            ),
            "village": {
                "id": new_village.id,
                "name": new_village.name,
                "x_coord": new_village.x_coord,
                "y_coord": new_village.y_coord,
                "is_capital": new_village.is_capital,
            }
        })


class UpgradeBuildingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        position = request.data.get('position')

        with transaction.atomic():
            try:
                # قفل‌گذاری روی ردیف دهکده تا پایان تراکنش (جلوگیری از race condition)
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=403)

            # ۱. به‌روزرسانی منابع در لحظه (Lazy Evaluation)
            update_village_resources(village)

            try:
                # قفل روی خود ساختمان هم لازمه، وگرنه دو درخواست هم‌زمان
                # هر دو از روی is_upgrading=False رد می‌شن
                building = VillageBuilding.objects.select_for_update().get(village=village, position=position)
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

            # ۴. علامت‌گذاری ساختمان به عنوان در حال ارتقا
            base_time = building.building_type.base_build_time * (1.2 ** building.level)
            building.is_upgrading = True
            building.upgrade_end_time = timezone.now() + datetime.timedelta(seconds=base_time)
            building.save()

            # ارسال به صف Celery فقط بعد از commit موفق تراکنش انجام می‌شه
            # (اگه تراکنش rollback بشه، تسکی برای رویدادی که هرگز commit نشده زمان‌بندی نمی‌شه)
            transaction.on_commit(lambda: schedule_game_event(
                village_id=village.id,
                event_type="BUILDING_UPGRADE",
                base_duration_seconds=base_time,
                details={"building_id": building.id, "next_level": next_level}
            ))

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
    """
    رنکینگ واقعی بازیکنان و شگفتی جهان.

    قبل از این ویو، جمعیت، اتحاد و رتبه شگفتی جهان کاملا ساختگی و بر اساس
    فرمول‌های نمایشی مثل `1000 + rank * 50` تولید می‌شدند و هیچ ربطی به
    وضعیت واقعی بازی نداشتند.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.world_wonder.models import WorldWonder
        from apps.combat.models import TroopMovement

        # --- جمعیت واقعی هر بازیکن: مجموع سطح تمام ساختمان‌های تمام دهکده‌هایش ---
        # (این یک تقریب ساده‌شده از فرمول جمعیت واقعی تراوین است، نه محاسبه دقیق
        # هزینه هر سطح ساختمان، اما بر خلاف قبل واقعا از دیتابیس می‌آید)
        population_by_player = {
            row['village__player_id']: row['total']
            for row in VillageBuilding.objects.filter(level__gt=0)
            .values('village__player_id')
            .annotate(total=Sum('level'))
        }

        # --- نام اتحاد واقعی هر بازیکن (در صورت عضویت) ---
        alliance_by_player = {
            m.player_id: f"[{m.alliance.tag}] {m.alliance.name}"
            for m in AllianceMember.objects.select_related('alliance').all()
        }

        players = (
            Player.objects.exclude(username="Natars")
            .filter(is_active=True)
            .order_by('id')
        )

        ranking_data = []
        for p in players:
            player_name = p.email.split('@')[0] if p.email else p.username
            ranking_data.append({
                "player": player_name,
                "alliance": alliance_by_player.get(p.id, "بدون اتحاد"),
                "population": population_by_player.get(p.id, 0),
            })

        # مرتب‌سازی بر اساس جمعیت واقعی (نزولی) و اضافه کردن رتبه
        ranking_data.sort(key=lambda row: row["population"], reverse=True)
        for rank, row in enumerate(ranking_data, start=1):
            row["rank"] = rank

        # --- رتبه‌بندی واقعی شگفتی جهان ---
        ww_data = []
        ww_qs = WorldWonder.objects.select_related('village__player').order_by('-level')[:20]
        for rank, ww in enumerate(ww_qs, start=1):
            player = ww.village.player
            player_name = player.email.split('@')[0] if player.email else player.username

            pending_attack = TroopMovement.objects.filter(
                target_village=ww.village,
                source_village__player__username="Natars",
                is_completed=False,
            ).exists()

            ww_data.append({
                "rank": rank,
                "player": player_name,
                "ww_level": ww.level,
                "natar_attacks": "⚔️ در راه است" if pending_attack else "بدون حمله",
            })

        return Response({
            "general_ranking": ranking_data[:100],
            "world_wonder": ww_data
        })


class MarketplaceView(APIView):
    """
    ارسال منابع بین دهکده‌ها با تاجرهای واقعی، محدود به ظرفیت حمل و زمان
    سفر. قبل از این ویو، منابع به‌صورت آنی و بدون هیچ محدودیتی منتقل
    می‌شدند - یعنی عملا هیچ «بازارچه»ی واقعی وجود نداشت.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        village_id = request.query_params.get('village_id')
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        now = timezone.now()

        outgoing = ResourceTrade.objects.filter(
            source_village=village, is_completed=False
        ).select_related('target_village').order_by('delivery_time')

        incoming = ResourceTrade.objects.filter(
            target_village=village, is_delivered=False
        ).select_related('source_village').order_by('delivery_time')

        def ser_out(t):
            return {
                "id": t.id,
                "target_name": t.target_village.name,
                "resources": {"wood": t.wood, "clay": t.clay, "iron": t.iron, "crop": t.crop},
                "merchants_used": t.merchants_used,
                "is_delivered": t.is_delivered,
                "delivery_remaining_seconds": max(0, int((t.delivery_time - now).total_seconds())),
                "merchants_return_remaining_seconds": max(0, int((t.merchants_return_time - now).total_seconds())),
            }

        def ser_in(t):
            return {
                "id": t.id,
                "source_name": t.source_village.name,
                "resources": {"wood": t.wood, "clay": t.clay, "iron": t.iron, "crop": t.crop},
                "delivery_remaining_seconds": max(0, int((t.delivery_time - now).total_seconds())),
            }

        return Response({
            "total_merchants": get_total_merchants(village),
            "available_merchants": get_available_merchants(village),
            "merchant_capacity": MERCHANT_CAPACITY,
            "outgoing_trades": [ser_out(t) for t in outgoing],
            "incoming_trades": [ser_in(t) for t in incoming],
        })

    def post(self, request):
        source_id = request.data.get('source_village_id')
        target_id = request.data.get('target_village_id')
        resources = request.data.get('resources', {'wood': 0, 'clay': 0, 'iron': 0, 'crop': 0})

        wood = int(resources.get('wood', 0) or 0)
        clay = int(resources.get('clay', 0) or 0)
        iron = int(resources.get('iron', 0) or 0)
        crop = int(resources.get('crop', 0) or 0)
        total_resources = wood + clay + iron + crop

        if total_resources <= 0:
            return Response({"error": "مقدار منابع ارسالی باید بیشتر از صفر باشد."}, status=400)

        if str(target_id) == str(source_id):
            return Response({"error": "نمی‌توانید به همان دهکده منابع ارسال کنید."}, status=400)

        try:
            target_village = Village.objects.get(id=target_id)
        except (Village.DoesNotExist, ValueError, TypeError):
            return Response({"error": "دهکده مقصد یافت نشد."}, status=404)

        with transaction.atomic():
            try:
                source = Village.objects.select_for_update().get(id=source_id, player=request.user)
            except (Village.DoesNotExist, ValueError, TypeError):
                return Response({"error": "دهکده مبدا یافت نشد یا متعلق به شما نیست."}, status=404)

            update_village_resources(source)

            if source.wood < wood or source.clay < clay or source.iron < iron or source.crop < crop:
                return Response({"error": "منابع کافی در دهکده وجود ندارد."}, status=400)

            merchants_needed = max(1, math.ceil(total_resources / MERCHANT_CAPACITY))
            available_merchants = get_available_merchants(source)

            if merchants_needed > available_merchants:
                return Response({
                    "error": (
                        f"تاجر کافی موجود نیست. این محموله به {merchants_needed} تاجر نیاز دارد "
                        f"ولی فقط {available_merchants} تاجر آزاد در دسترس است. سطح بازارچه را ارتقا دهید "
                        f"یا صبر کنید تا تاجرهای در سفر برگردند."
                    )
                }, status=400)

            # کسر منابع از مبدا همین الان انجام می‌شود (سرمایه‌گذاری برای تجارت)
            source.wood -= wood
            source.clay -= clay
            source.iron -= iron
            source.crop -= crop
            source.save()

            travel_seconds = calculate_merchant_travel_seconds(source, target_village)
            now = timezone.now()
            delivery_time = now + datetime.timedelta(seconds=travel_seconds)
            return_time = delivery_time + datetime.timedelta(seconds=travel_seconds)

            trade = ResourceTrade.objects.create(
                source_village=source,
                target_village=target_village,
                wood=wood, clay=clay, iron=iron, crop=crop,
                merchants_used=merchants_needed,
                delivery_time=delivery_time,
                merchants_return_time=return_time,
            )

            GameLog.objects.create(
                village=source,
                log_type='TRADE',
                description=(
                    f"{merchants_needed} تاجر با {total_resources} واحد منبع به سمت دهکده "
                    f"{target_village.name} اعزام شدند. زمان رسیدن: {round(travel_seconds/60)} دقیقه دیگر."
                )
            )

            transaction.on_commit(lambda: deliver_trade_resources.apply_async(
                args=[trade.id], eta=delivery_time
            ))

        return Response({
            "message": f"{merchants_needed} تاجر با محموله به سمت {target_village.name} اعزام شدند.",
            "delivery_time": delivery_time,
            "merchants_used": merchants_needed,
        })


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


class EmbassyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # دریافت اطلاعات اتحاد فعلی بازیکن
        try:
            membership = AllianceMember.objects.get(player=request.user)
            alliance = membership.alliance
            members = AllianceMember.objects.filter(alliance=alliance).values(
                'player_id', 'player__email', 'role'
            )
            return Response({
                "has_alliance": True,
                "alliance_data": {
                    "id": alliance.id,
                    "name": alliance.name,
                    "tag": alliance.tag,
                    "role": membership.role,
                    "founder_id": alliance.founder_id,
                    "members": list(members)
                }
            })
        except AllianceMember.DoesNotExist:
            # ارسال لیست تمام اتحادها برای پیوستن
            alliances = Alliance.objects.all().values('id', 'name', 'tag')
            return Response({
                "has_alliance": False,
                "available_alliances": list(alliances)
            })

    def post(self, request):
        action = request.data.get('action')

        # نکته مهم: قبلا بررسی «شما از قبل عضو یک اتحاد هستید» به صورت
        # بی‌قید و شرط برای هر اکشنی اجرا می‌شد؛ یعنی حتی اگر کاربر می‌خواست
        # اتحاد را ترک کند یا عضوی را اخراج کند (که ذاتا نیازمند عضویت است)،
        # همین ابتدا با خطا رد می‌شد. این بررسی الان فقط برای create/join است.
        if action in ('create', 'join'):
            if AllianceMember.objects.filter(player=request.user).exists():
                return Response({"error": "شما از قبل عضو یک اتحاد هستید."}, status=400)

            if action == 'create':
                name = request.data.get('name')
                tag = request.data.get('tag')

                with transaction.atomic():
                    alliance = Alliance.objects.create(name=name, tag=tag, founder=request.user)
                    AllianceMember.objects.create(alliance=alliance, player=request.user, role='Leader')
                return Response({"message": f"اتحاد {name} با موفقیت تاسیس شد!"})

            alliance_id = request.data.get('alliance_id')
            try:
                alliance = Alliance.objects.get(id=alliance_id)
                AllianceMember.objects.create(alliance=alliance, player=request.user, role='Member')
                return Response({"message": f"شما با موفقیت به اتحاد {alliance.tag} پیوستید."})
            except Alliance.DoesNotExist:
                return Response({"error": "اتحاد مورد نظر یافت نشد."}, status=404)

        # --- اکشن‌های زیر همگی نیازمند عضویت فعلی در یک اتحاد هستند ---
        try:
            membership = AllianceMember.objects.select_related('alliance').get(player=request.user)
        except AllianceMember.DoesNotExist:
            return Response({"error": "شما عضو هیچ اتحادی نیستید."}, status=400)

        alliance = membership.alliance

        if action == 'leave':
            with transaction.atomic():
                if membership.role == 'Leader':
                    other_members = AllianceMember.objects.filter(
                        alliance=alliance
                    ).exclude(player=request.user).order_by('joined_at')

                    if other_members.exists():
                        # رهبری به قدیمی‌ترین عضو باقی‌مانده منتقل می‌شود تا
                        # اتحاد بدون رهبر باقی نماند
                        successor = other_members.first()
                        successor.role = 'Leader'
                        successor.save()
                        membership.delete()
                        return Response({
                            "message": f"شما اتحاد را ترک کردید. رهبری به {successor.player.username} منتقل شد."
                        })
                    else:
                        # رهبر آخرین عضو باقی‌مانده است؛ ترک کردن یعنی انحلال اتحاد
                        alliance_name = alliance.name
                        alliance.delete()
                        return Response({"message": f"شما آخرین عضو بودید؛ اتحاد {alliance_name} منحل شد."})
                else:
                    membership.delete()
                    return Response({"message": f"شما اتحاد {alliance.tag} را ترک کردید."})

        elif action == 'kick':
            if membership.role != 'Leader':
                return Response({"error": "فقط رهبر اتحاد می‌تواند عضوی را اخراج کند."}, status=403)

            target_player_id = request.data.get('target_player_id')
            if str(target_player_id) == str(request.user.id):
                return Response({"error": "برای خروج خودتان از گزینه «ترک اتحاد» استفاده کنید."}, status=400)

            try:
                target_membership = AllianceMember.objects.get(alliance=alliance, player_id=target_player_id)
            except AllianceMember.DoesNotExist:
                return Response({"error": "این بازیکن عضو اتحاد شما نیست."}, status=404)

            target_username = target_membership.player.username
            target_membership.delete()
            return Response({"message": f"{target_username} از اتحاد اخراج شد."})

        elif action == 'promote':
            if membership.role != 'Leader':
                return Response({"error": "فقط رهبر اتحاد می‌تواند نقش اعضا را تغییر دهد."}, status=403)

            target_player_id = request.data.get('target_player_id')
            new_role = request.data.get('role', 'Member')
            if new_role not in ('Member', 'Diplomat', 'Leader'):
                return Response({"error": "نقش نامعتبر است."}, status=400)

            try:
                target_membership = AllianceMember.objects.get(alliance=alliance, player_id=target_player_id)
            except AllianceMember.DoesNotExist:
                return Response({"error": "این بازیکن عضو اتحاد شما نیست."}, status=404)

            with transaction.atomic():
                if new_role == 'Leader':
                    # فقط یک رهبر می‌تواند وجود داشته باشد؛ رهبر فعلی به دیپلمات تنزل می‌کند
                    membership.role = 'Diplomat'
                    membership.save()
                target_membership.role = new_role
                target_membership.save()

            return Response({"message": f"نقش {target_membership.player.username} به {new_role} تغییر یافت."})

        elif action == 'disband':
            if membership.role != 'Leader':
                return Response({"error": "فقط رهبر اتحاد می‌تواند اتحاد را منحل کند."}, status=403)

            alliance_name = alliance.name
            alliance.delete()  # AllianceMember ها با CASCADE حذف می‌شوند
            return Response({"message": f"اتحاد {alliance_name} منحل شد."})

        return Response({"error": "عملیات نامعتبر"}, status=400)