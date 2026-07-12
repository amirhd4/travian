from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from asgiref.sync import async_to_sync
from django.db import transaction
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from django.utils import timezone
import datetime
import math
import uuid

from .models import Transaction, Discount, GameLog, GoldPackage, Village, VillageBuilding, ServerSetting
from .engine import schedule_game_event
from .utils import update_village_resources, calculate_crop_upkeep, calculate_building_population, calculate_village_population, is_server_finished
from .services import found_new_village
from channels.layers import get_channel_layer
from .models import Transaction, Discount, GameLog
from .serializers import GameLogSerializer
from .models import Message
from .serializers import MessageSerializer
from .models import Alliance, AllianceMember, ResourceTrade
from .market_utils import get_total_merchants, get_available_merchants, calculate_merchant_travel_seconds, MERCHANT_CAPACITY
from .tasks.game_tasks import deliver_trade_resources
from .quest_utils import sync_quest_progress, claim_quest_reward


Player = get_user_model()


class VillageListView(APIView):
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
                "has_world_wonder": hasattr(v, 'world_wonder'),
            }
            for v in villages
        ]
        return Response(data)


class VillageDetailView(APIView):
    """
    اطلاعات زنده یک دهکده مشخص (منابع فعلی + نرخ تولید خالص).

    ⚠️ این ویو صرفاً برای «نمایش وضعیت» صدا زده می‌شود (هر ۱۵ ثانیه توسط
    ResourceBar.jsx). هرگونه محدودیت مربوط به «شروع یک ارتقای جدید» باید
    فقط در UpgradeBuildingView باشد، نه اینجا - قبلا یک چک اشتباه اینجا
    هم اضافه شده بود که باعث می‌شد هر وقت یک ساختمان در حال ساخت باشد
    (که تقریبا همیشه اینطور است)، کل درخواست با خطای ۴۰۰ برگردد و منابع/
    تولید هرگز از سرور به‌روزرسانی نشوند. این باگ در نسخه‌ی فعلی رفع شده.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, village_id):
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        update_village_resources(village)

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
    permission_classes = [IsAuthenticated]

    def get(self, request, village_id):
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        update_village_resources(village)

        buildings = VillageBuilding.objects.filter(village=village).select_related('building_type').order_by('position')

        # ✅ سطح واقعی شگفتی جهان روی مدل WorldWonder نگه‌داری می‌شود، نه روی
        # VillageBuilding (که همیشه با level=0 ساخته می‌شود). برای اینکه بج
        # لول روی نقشه‌ی دهکده درست نمایش داده شود، این مقدار را جداگانه می‌خوانیم.
        ww_level = None
        if hasattr(village, 'world_wonder'):
            ww_level = village.world_wonder.level

        data = []
        for b in buildings:
            display_level = b.level
            if b.building_type.name == "شگفتی جهان" and ww_level is not None:
                display_level = ww_level

            multiplier = 1.5 ** display_level
            time_multiplier = 1.2 ** display_level
            is_max_level = display_level >= b.building_type.max_level
            data.append({
                "id": b.id,
                "position": b.position,
                "name": b.building_type.name,
                "category": b.building_type.category,
                "level": display_level,
                "max_level": b.building_type.max_level,
                "is_max_level": is_max_level,
                "is_upgrading": b.is_upgrading,
                "upgrade_end_time": b.upgrade_end_time,
                "provides_wall_defense": b.building_type.provides_wall_defense,
                "next_level_cost": None if is_max_level else {
                    "wood": int(b.building_type.base_wood_cost * multiplier),
                    "clay": int(b.building_type.base_clay_cost * multiplier),
                    "iron": int(b.building_type.base_iron_cost * multiplier),
                    "crop": int(b.building_type.base_crop_cost * multiplier),
                },
                "next_level_time_seconds": None if is_max_level else int(b.building_type.base_build_time * time_multiplier),
            })

        return Response({
            "village": {
                "id": village.id,
                "name": village.name,
                "is_capital": village.is_capital,
                "population": calculate_village_population(village),
                "loyalty": village.loyalty,
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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            center_x = int(request.query_params.get('x', 0))
            center_y = int(request.query_params.get('y', 0))
        except (TypeError, ValueError):
            return Response({"error": "مختصات نامعتبر است."}, status=400)

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
                "is_farm": v.is_farm_village,
                "is_capital": v.is_capital,
                "is_natar_ww_site": v.is_natar_ww_site,
                "is_natar_plan_guard": v.is_natar_plan_guard,
            }
            for v in villages
        ]
        return Response(data)


class FarmVillagesListView(APIView):
    """
    ✅ جدید: فهرست کامل دهکده‌های فارم روی نقشه (برای تب «فارم‌ها» در صفحه‌ی آمار)
    تا بازیکن بتواند آن‌ها را مستقیم به لیست مزرعه (Farm List) اضافه کند.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        villages = Village.objects.filter(is_farm_village=True).order_by('id')
        return Response([
            {
                "id": v.id,
                "name": v.name,
                "x_coord": v.x_coord,
                "y_coord": v.y_coord,
                "production_per_hour": v.prod_wood,
            }
            for v in villages
        ])


class FoundVillageView(APIView):
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
        if is_server_finished():
            return Response({"error": "این سرور به پایان رسیده و دیگر امکان ساخت‌وساز وجود ندارد."}, status=400)

        village_id = request.data.get('village_id')
        position = request.data.get('position')

        with transaction.atomic():
            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=403)

            update_village_resources(village)

            max_concurrent_builds = 2 if request.user.has_plus_active() else 1
            if VillageBuilding.objects.filter(village=village, is_upgrading=True).count() >= max_concurrent_builds:
                return Response(
                    {
                        "error": f"در هر لحظه حداکثر {max_concurrent_builds} ساختمان می‌تواند در حال ارتقا باشد. اکانت پلاس این حد را به ۲ می‌رساند."},
                    status=400
                )

            try:
                building = VillageBuilding.objects.select_for_update().get(village=village, position=position)
            except VillageBuilding.DoesNotExist:
                return Response({"error": "ساختمانی در این جایگاه یافت نشد."}, status=404)

            if building.is_upgrading:
                return Response({"error": "این ساختمان در حال حاضر در حال ارتقا است."}, status=400)

            if building.level >= building.building_type.max_level:
                return Response(
                    {"error": f"این ساختمان به حداکثر سطح مجاز ({building.building_type.max_level}) رسیده است."},
                    status=400
                )

            if building.building_type.name == "شگفتی جهان":
                return Response(
                    {"error": "ارتقای شگفتی جهان فقط از طریق صفحه‌ی مخصوص «شگفتی جهان» انجام می‌شود."},
                    status=400
                )

            next_level = building.level + 1
            multiplier = 1.5 ** building.level
            req_wood = int(building.building_type.base_wood_cost * multiplier)
            req_clay = int(building.building_type.base_clay_cost * multiplier)
            req_iron = int(building.building_type.base_iron_cost * multiplier)
            req_crop = int(building.building_type.base_crop_cost * multiplier)

            if village.wood < req_wood or village.clay < req_clay or village.iron < req_iron or village.crop < req_crop:
                return Response({"error": "منابع کافی نیست."}, status=400)

            village.wood -= req_wood
            village.clay -= req_clay
            village.iron -= req_iron
            village.crop -= req_crop
            village.save()

            base_time = building.building_type.base_build_time * (1.2 ** building.level)
            building.is_upgrading = True
            building.upgrade_end_time = timezone.now() + datetime.timedelta(seconds=base_time)
            building.save()

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
                # ✅ FIX: قبلا اسمش transaction بود و ماژول django.db.transaction را shadow می‌کرد
                payment_transaction = Transaction.objects.get(authority=authority)
            except Transaction.DoesNotExist:
                return Response({"error": "تراکنش یافت نشد"}, status=404)

            if payment_transaction.status == 'SUCCESS':
                return Response({"message": "قبلا تایید شده"}, status=200)

            package = payment_transaction.package
            player = payment_transaction.player

            active_discount = Discount.objects.filter(
                start_time__lte=timezone.now(),
                end_time__gte=timezone.now(),
                is_active=True
            ).first()

            final_gold = package.gold_amount
            if active_discount:
                final_gold += int(package.gold_amount * (active_discount.percentage / 100))

            player.gold_coins += final_gold
            player.save()
            payment_transaction.status = 'SUCCESS'
            payment_transaction.save()

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"player_{player.id}",
                {"type": "send_game_update", "message": {"type": "gold_added", "amount": final_gold}}
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
        from apps.world_wonder.models import WorldWonder
        from apps.combat.models import TroopMovement

        population_by_player = {}
        for b in VillageBuilding.objects.filter(level__gt=0).select_related('building_type', 'village'):
            player_id = b.village.player_id
            population_by_player[player_id] = (
                    population_by_player.get(player_id, 0) + calculate_building_population(b.building_type, b.level)
            )
        population_by_player = {pid: int(round(pop)) for pid, pop in population_by_player.items()}

        alliance_by_player = {
            m.player_id: f"[{m.alliance.tag}] {m.alliance.name}"
            for m in AllianceMember.objects.select_related('alliance').all()
        }

        players = (
            Player.objects.exclude(username__in=["Natars", "Farms"])
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

        ranking_data.sort(key=lambda row: row["population"], reverse=True)
        for rank, row in enumerate(ranking_data, start=1):
            row["rank"] = rank

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
        messages = Message.objects.filter(receiver=request.user).order_by('-created_at')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request):
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
            alliances = Alliance.objects.all().values('id', 'name', 'tag')
            return Response({
                "has_alliance": False,
                "available_alliances": list(alliances)
            })

    def post(self, request):
        action = request.data.get('action')

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
                        successor = other_members.first()
                        successor.role = 'Leader'
                        successor.save()
                        membership.delete()
                        return Response({
                            "message": f"شما اتحاد را ترک کردید. رهبری به {successor.player.username} منتقل شد."
                        })
                    else:
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
                    membership.role = 'Diplomat'
                    membership.save()
                target_membership.role = new_role
                target_membership.save()

            return Response({"message": f"نقش {target_membership.player.username} به {new_role} تغییر یافت."})

        elif action == 'disband':
            if membership.role != 'Leader':
                return Response({"error": "فقط رهبر اتحاد می‌تواند اتحاد را منحل کند."}, status=403)

            alliance_name = alliance.name
            alliance.delete()
            return Response({"message": f"اتحاد {alliance_name} منحل شد."})

        return Response({"error": "عملیات نامعتبر"}, status=400)


class ServerStatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        active_server = ServerSetting.objects.filter(is_active=True).first()
        if not active_server:
            return Response({"is_finished": False})

        data = {
            "is_finished": active_server.is_finished,
            "duration_days": active_server.duration_days,
            "start_date": active_server.start_date,
            "new_player_protection_days": active_server.new_player_protection_days,
        }
        if active_server.is_finished:
            data["finished_at"] = active_server.finished_at
            data["winner_username"] = active_server.winner_player.username if active_server.winner_player else None
            data["winner_alliance_tag"] = active_server.winner_alliance.tag if active_server.winner_alliance else None

        return Response(data)


class QuestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        results = sync_quest_progress(request.user)
        return Response([
            {
                "id": quest.id,
                "order": quest.order,
                "title": quest.title,
                "description": quest.description,
                "condition_target": quest.condition_target,
                "current_value": min(current_value, quest.condition_target),
                "is_completed": progress.is_completed,
                "is_reward_claimed": progress.is_reward_claimed,
                "reward": {
                    "wood": quest.reward_wood,
                    "clay": quest.reward_clay,
                    "iron": quest.reward_iron,
                    "crop": quest.reward_crop,
                    "gold": quest.reward_gold,
                },
            }
            for quest, progress, current_value in results
        ])


class ClaimQuestRewardView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        quest_id = request.data.get('quest_id')
        success, message = claim_quest_reward(request.user, quest_id)
        if not success:
            return Response({"error": message}, status=400)
        return Response({"message": message})


class GoldPackageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        packages = GoldPackage.objects.filter(is_active=True).order_by('price')
        active_discount = Discount.objects.filter(
            start_time__lte=timezone.now(), end_time__gte=timezone.now(), is_active=True
        ).first()
        return Response({
            "packages": [
                {"id": p.id, "name": p.name, "gold_amount": p.gold_amount, "price": str(p.price)}
                for p in packages
            ],
            "active_discount_percent": active_discount.percentage if active_discount else 0,
        })


class CreatePaymentRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        package_id = request.data.get('package_id')
        try:
            package = GoldPackage.objects.get(id=package_id, is_active=True)
        except GoldPackage.DoesNotExist:
            return Response({"error": "بسته‌ی طلای انتخابی یافت نشد."}, status=404)

        authority = uuid.uuid4().hex
        Transaction.objects.create(
            player=request.user, package=package, authority=authority, status='PENDING',
        )
        return Response({
            "authority": authority,
            "checkout_url": f"/checkout/{authority}",
        })


class MockCompletePaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        authority = request.data.get('authority')
        try:
            # ✅ FIX: rename از transaction به payment_transaction
            payment_transaction = Transaction.objects.get(authority=authority, player=request.user)
        except Transaction.DoesNotExist:
            return Response({"error": "تراکنش یافت نشد."}, status=404)

        if payment_transaction.status == 'SUCCESS':
            return Response({"message": "این تراکنش قبلا تایید شده است."})

        package = payment_transaction.package
        active_discount = Discount.objects.filter(
            start_time__lte=timezone.now(), end_time__gte=timezone.now(), is_active=True
        ).first()

        final_gold = package.gold_amount
        if active_discount:
            final_gold += int(package.gold_amount * (active_discount.percentage / 100))

        player = request.user
        player.gold_coins += final_gold
        player.save()

        payment_transaction.status = 'SUCCESS'
        payment_transaction.save()

        return Response({"message": f"{final_gold} سکه‌ی طلا با موفقیت به حساب شما اضافه شد.", "gold_coins": player.gold_coins})


class BuyPlusView(APIView):
    permission_classes = [IsAuthenticated]

    PLUS_COST_PER_DAY = 100

    def get(self, request):
        player = request.user
        return Response({
            "has_plus": player.has_plus_active(),
            "expires_at": player.plus_expires_at,
            "cost_per_day": self.PLUS_COST_PER_DAY,
            "gold_coins": player.gold_coins,
        })

    def post(self, request):
        days = int(request.data.get('days', 1))
        if days <= 0:
            return Response({"error": "تعداد روز نامعتبر است."}, status=400)

        cost = self.PLUS_COST_PER_DAY * days
        player = request.user
        if player.gold_coins < cost:
            return Response({"error": f"طلای کافی ندارید. هزینه: {cost} سکه."}, status=400)

        player.gold_coins -= cost
        now = timezone.now()
        base_time = player.plus_expires_at if (player.plus_expires_at and player.plus_expires_at > now) else now
        player.plus_expires_at = base_time + datetime.timedelta(days=days)
        player.has_plus = True
        player.save()

        return Response({
            "message": f"اکانت پلاس برای {days} روز فعال/تمدید شد!",
            "expires_at": player.plus_expires_at,
            "gold_coins": player.gold_coins,
        })


class CulturePointsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .utils import calculate_player_culture_points_per_hour, required_culture_points_for_nth_village

        player = request.user
        villages_count = Village.objects.filter(player=player, is_farm_village=False).count()
        next_village_number = villages_count + 1
        required_cp = required_culture_points_for_nth_village(next_village_number)

        return Response({
            "culture_points": round(player.culture_points, 1),
            "culture_points_per_hour": round(calculate_player_culture_points_per_hour(player), 2),
            "villages_count": villages_count,
            "next_village_required_cp": required_cp,
            "can_found_next_village": player.culture_points >= required_cp,
        })


class VillageRenameView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        new_name = (request.data.get('name') or '').strip()

        if not new_name or len(new_name) > 50:
            return Response({"error": "نام دهکده باید بین ۱ تا ۵۰ کاراکتر باشد."}, status=400)

        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        village.name = new_name
        village.save(update_fields=['name'])
        return Response({"message": "نام دهکده با موفقیت تغییر کرد.", "name": village.name})


NPC_TRADE_COOLDOWN_SECONDS = 3600
NPC_GOLD_COST_PER_1000 = 3


class NpcTradeView(APIView):
    """تبدیل فوری منابع دهکده به مقادیر متعادل (هر ۴ منبع مساوی) با هزینه‌ی طلا.
    شبیه تاجر NPC تراوین اصلی؛ هر دهکده یک ساعت cooldown دارد."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')

        with transaction.atomic():
            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

            update_village_resources(village)

            if village.last_npc_trade_at:
                remaining = NPC_TRADE_COOLDOWN_SECONDS - (timezone.now() - village.last_npc_trade_at).total_seconds()
                if remaining > 0:
                    return Response({"error": f"تاجر NPC هنوز آماده نیست؛ {int(remaining)} ثانیه دیگر صبر کنید."}, status=400)

            total_resource = village.wood + village.clay + village.iron + village.crop
            if total_resource <= 0:
                return Response({"error": "منابعی برای تبدیل وجود ندارد."}, status=400)

            gold_cost = max(1, int((total_resource / 1000) * NPC_GOLD_COST_PER_1000))
            player = request.user
            if player.gold_coins < gold_cost:
                return Response({"error": f"سکه طلای کافی ندارید. هزینه: {gold_cost} سکه."}, status=400)

            each_share = total_resource / 4
            village.wood = min(village.max_storage, each_share)
            village.clay = min(village.max_storage, each_share)
            village.iron = min(village.max_storage, each_share)
            village.crop = min(village.max_granary, each_share)
            village.last_npc_trade_at = timezone.now()
            village.save()

            player.gold_coins -= gold_cost
            player.save(update_fields=['gold_coins'])

        return Response({
            "message": f"منابع با موفقیت متعادل شدند (هزینه: {gold_cost} سکه طلا).",
            "resources": {"wood": village.wood, "clay": village.clay, "iron": village.iron, "crop": village.crop},
            "gold_coins": player.gold_coins,
        })

class OasisMapView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Oasis
        try:
            center_x = int(request.query_params.get('x', 0))
            center_y = int(request.query_params.get('y', 0))
        except (TypeError, ValueError):
            return Response({"error": "مختصات نامعتبر است."}, status=400)
        radius = min(max(int(request.query_params.get('radius', 2) or 2), 1), 10)

        oases = Oasis.objects.filter(
            x_coord__range=(center_x - radius, center_x + radius),
            y_coord__range=(center_y - radius, center_y + radius),
        ).select_related('owner_village__player')

        return Response([
            {
                "id": o.id,
                "x_coord": o.x_coord,
                "y_coord": o.y_coord,
                "bonus_resource": o.bonus_resource,
                "bonus_percent": o.bonus_percent,
                "defense_strength": o.defense_strength,
                "is_free": o.owner_village_id is None,
                "owner_name": o.owner_village.name if o.owner_village else None,
            }
            for o in oases
        ])


class OasisAttackView(APIView):
    """
    ⚠️ نسخه‌ی ساده‌شده: برخلاف حمله‌ی عادی، بدون زمان سفر و به‌صورت فوری نتیجه‌گیری می‌شود.
    """
    permission_classes = [IsAuthenticated]
    MAX_OASES_PER_VILLAGE = 3

    def post(self, request):
        from .models import Oasis
        from apps.combat.models import TroopType, VillageTroop
        from apps.combat.engine import calculate_combat

        village_id = request.data.get('village_id')
        oasis_id = request.data.get('oasis_id')
        troops_payload = request.data.get('troops_payload', {})

        if not troops_payload or not any(int(v or 0) > 0 for v in troops_payload.values()):
            return Response({"error": "حداقل یک نوع نیرو برای حمله به اوسیس انتخاب کنید."}, status=400)

        with transaction.atomic():
            try:
                village = Village.objects.select_for_update().get(id=village_id, player=request.user)
            except Village.DoesNotExist:
                return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

            try:
                oasis = Oasis.objects.select_for_update().get(id=oasis_id)
            except Oasis.DoesNotExist:
                return Response({"error": "اوسیس یافت نشد."}, status=404)

            if oasis.owner_village_id == village.id:
                return Response({"error": "این اوسیس همین الان متعلق به همین دهکده است."}, status=400)

            residence_ok = VillageBuilding.objects.filter(
                village=village, building_type__name__in=["عمارت اقامتی", "تالار شهر"], level__gt=0
            ).exists()
            if not residence_ok:
                return Response({"error": "برای تصاحب اوسیس ابتدا باید عمارت اقامتی یا تالار شهر بسازید."}, status=400)

            if oasis.owner_village_id is None:
                owned_count = Oasis.objects.filter(owner_village=village).count()
                if owned_count >= self.MAX_OASES_PER_VILLAGE:
                    return Response({"error": f"هر دهکده حداکثر {self.MAX_OASES_PER_VILLAGE} اوسیس می‌تواند داشته باشد."}, status=400)

            troop_type_cache = {t.id: t for t in TroopType.objects.filter(id__in=[int(k) for k in troops_payload.keys()])}
            attack_power = 0
            village_troops = {}
            for tid_str, qty in troops_payload.items():
                qty = int(qty or 0)
                if qty <= 0:
                    continue
                troop_type = troop_type_cache.get(int(tid_str))
                if not troop_type:
                    return Response({"error": "نوع نیروی نامعتبر."}, status=400)
                try:
                    vt = VillageTroop.objects.select_for_update().get(village=village, troop_type=troop_type)
                except VillageTroop.DoesNotExist:
                    return Response({"error": f"شما نیروی {troop_type.name} در این دهکده ندارید."}, status=400)
                if vt.count < qty:
                    return Response({"error": f"نیروی کافی از {troop_type.name} ندارید."}, status=400)
                attack_power += qty * troop_type.attack_power
                village_troops[vt] = qty

            combat_result = calculate_combat(
                {"points_attack": attack_power},
                {"points_def_infantry": oasis.defense_strength, "points_def_cavalry": 0},
                wall_level=0,
            )

            loss_ratio = combat_result["attacker_loss_percent"] / 100
            for vt, sent_qty in village_troops.items():
                vt.count = max(0, vt.count - int(round(sent_qty * loss_ratio)))
                vt.save()

            if combat_result["victory"] == "attacker":
                oasis.owner_village = village
                oasis.save()
                message = f"🌿 اوسیس ({oasis.x_coord}|{oasis.y_coord}) با موفقیت تصاحب شد!"
            else:
                message = f"شکست خوردید؛ اوسیس ({oasis.x_coord}|{oasis.y_coord}) تصاحب نشد و بخشی از نیروها را از دست دادید."

        return Response({
            "message": message,
            "victory": combat_result["victory"],
            "attacker_loss_percent": round(combat_result["attacker_loss_percent"], 1),
        })