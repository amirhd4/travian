from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from asgiref.sync import async_to_sync
from django.db import transaction
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer

from django.utils import timezone
import datetime
import math
import uuid

from .models import Transaction, Discount, GameLog, GoldPackage, Village, VillageBuilding, ServerSetting
from .engine import schedule_game_event
from .utils import (
    update_village_resources, calculate_crop_upkeep, calculate_building_population,
    calculate_village_population, is_server_finished, get_effective_production_rates, get_effective_max_level,
)
from .services import found_new_village, abandon_village, MAX_VILLAGES
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
        rates = get_effective_production_rates(village)

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
                "wood": round(rates['wood'], 1),
                "clay": round(rates['clay'], 1),
                "iron": round(rates['iron'], 1),
                "crop": round(rates['crop'], 1),
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

            effective_max_level = get_effective_max_level(village, b.building_type)
            multiplier = 1.5 ** display_level
            time_multiplier = 1.2 ** display_level
            is_max_level = display_level >= effective_max_level

            data.append({
                "id": b.id, "position": b.position, "name": b.building_type.name,
                "category": b.building_type.category, "level": display_level,
                "max_level": effective_max_level, "is_max_level": is_max_level,
                "is_upgrading": b.is_upgrading, "upgrade_end_time": b.upgrade_end_time,
                "provides_wall_defense": b.building_type.provides_wall_defense,
                "next_level_cost": None if is_max_level else {
                    "wood": int(b.building_type.base_wood_cost * multiplier),
                    "clay": int(b.building_type.base_clay_cost * multiplier),
                    "iron": int(b.building_type.base_iron_cost * multiplier),
                    "crop": int(b.building_type.base_crop_cost * multiplier),
                },
                "next_level_time_seconds": None if is_max_level else int(
                    b.building_type.base_build_time * time_multiplier),
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
                "is_natar_artifact_site": v.is_natar_artifact_site,
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

                current_count = Village.objects.filter(
                    player=request.user, is_farm_village=False
                ).count()
                if current_count >= MAX_VILLAGES:
                    return Response(
                        {"error": f"شما به حداکثر {MAX_VILLAGES} دهکده رسیده‌اید."},
                        status=400
                    )

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


class AbandonVillageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, village_id):
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)
        try:
            abandon_village(request.user, village)
        except ValidationError as e:
            return Response({"error": str(e.message) if hasattr(e, "message") else str(e)}, status=400)
        return Response({"message": "دهکده با موفقیت رها شد."})


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

                effective_max_level = get_effective_max_level(village, building.building_type)
                if building.level >= effective_max_level:
                    return Response(
                        {"error": f"این ساختمان به حداکثر سطح مجاز ({effective_max_level}) رسیده است."},
                        status=400
                    )
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

        from .models import PlayerCombatStats  # ✅ جدید

        combat_stats_qs = PlayerCombatStats.objects.select_related('player').exclude(
            player__username__in=["Natars", "Farms"]
        )

        def _serialize_stats(qs, field_name):
            ordered = sorted(qs, key=lambda s: getattr(s, field_name), reverse=True)
            data = []
            for rank, stat in enumerate(ordered, start=1):
                if getattr(stat, field_name) <= 0:
                    break
                player_name = stat.player.email.split('@')[0] if stat.player.email else stat.player.username
                data.append({
                    "rank": rank,
                    "player": player_name,
                    "alliance": alliance_by_player.get(stat.player_id, "بدون اتحاد"),
                    "points": round(getattr(stat, field_name), 1),
                })
            return data[:20]

        top_attackers = _serialize_stats(combat_stats_qs, 'attacker_kill_points')
        top_defenders = _serialize_stats(combat_stats_qs, 'defender_kill_points')

        return Response({
            "general_ranking": ranking_data[:100],
            "world_wonder": ww_data,
            "top_attackers": top_attackers,
            "top_defenders": top_defenders,
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


class SentMessagesView(APIView):
    """نمایش پیام‌های ارسالی بازیکن."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        messages = Message.objects.filter(sender=request.user).order_by('-created_at')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)


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
            "ww_unlocked": active_server.ww_unlocked,                    # ✅ جدید
            "artifacts_unlocked": active_server.artifacts_unlocked,      # ✅ جدید
        }

        if not active_server.ww_unlocked:  # ✅ جدید
            data["ww_plans_release_at"] = active_server.start_date + datetime.timedelta(
                days=active_server.duration_days * 0.7
            )

        if not active_server.artifacts_unlocked:  # ✅ جدید
            data["artifacts_release_at"] = active_server.start_date + datetime.timedelta(
                days=active_server.duration_days * (active_server.artifact_release_duration_percent / 100)
            )

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


class StandardNpcTradeView(APIView):
    """تبدیل استاندارد منابع: بازتوزیع ۱ به ۱ بر اساس هزینه‌ی دقیق نیروی در حال آموزش.
    مثلاً اگر گرزدار هزینه 100 چوب، 100 خشت، 100 آهن، 10 گندم دارد،
    منابع به نسبت هزینه‌ی نیروی انتخاب شده بازتوزیع می‌شوند."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.combat.models import TroopType

        village_id = request.data.get('village_id')
        troop_type_id = request.data.get('troop_type_id')

        if not troop_type_id:
            return Response({"error": "نوع نیرو را مشخص کنید."}, status=400)

        try:
            troop_type = TroopType.objects.get(id=troop_type_id)
        except TroopType.DoesNotExist:
            return Response({"error": "نوع نیرو یافت نشد."}, status=404)

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

            # محاسبه نسبت هزینه نیرو
            total_troop_cost = (
                troop_type.wood_cost + troop_type.clay_cost +
                troop_type.iron_cost + troop_type.crop_cost
            )
            if total_troop_cost <= 0:
                return Response({"error": "هزینه نیرو نامعتبر است."}, status=400)

            # بازتوزیع منابع بر اساس نسبت هزینه نیرو
            wood_ratio = troop_type.wood_cost / total_troop_cost
            clay_ratio = troop_type.clay_cost / total_troop_cost
            iron_ratio = troop_type.iron_cost / total_troop_cost
            crop_ratio = troop_type.crop_cost / total_troop_cost

            village.wood = min(village.max_storage, total_resource * wood_ratio)
            village.clay = min(village.max_storage, total_resource * clay_ratio)
            village.iron = min(village.max_storage, total_resource * iron_ratio)
            village.crop = min(village.max_granary, total_resource * crop_ratio)
            village.last_npc_trade_at = timezone.now()
            village.save()

            player.gold_coins -= gold_cost
            player.save(update_fields=['gold_coins'])

        return Response({
            "message": f"منابع بر اساس هزینه {troop_type.name} بازتوزیع شدند (هزینه: {gold_cost} سکه طلا).",
            "resources": {"wood": village.wood, "clay": village.clay, "iron": village.iron, "crop": village.crop},
            "gold_coins": player.gold_coins,
        })


RESOURCE_BONUS_GOLD_COST = 50
RESOURCE_BONUS_DURATION_HOURS = 24
RESOURCE_BONUS_PERCENT = 25


class ResourceBonusView(APIView):
    """خرید بونوس ۲۵٪ تولید منابع با طلا به مدت ۲۴ ساعت — به تفکیک نوع منبع."""
    permission_classes = [IsAuthenticated]

    VALID_RESOURCE_TYPES = ('wood', 'clay', 'iron', 'crop', 'all')

    def post(self, request):
        village_id = request.data.get('village_id')
        resource_type = request.data.get('resource_type', 'all')
        player = request.user

        if resource_type not in self.VALID_RESOURCE_TYPES:
            return Response({"error": "نوع منبع نامعتبر است."}, status=400)

        if player.gold_coins < RESOURCE_BONUS_GOLD_COST:
            return Response({"error": f"طلای کافی ندارید. هزینه: {RESOURCE_BONUS_GOLD_COST} سکه."}, status=400)

        try:
            village = Village.objects.get(id=village_id, player=player)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        from django.core.cache import cache
        # ✅ جدید: کلید کش به تفکیک نوع منبع، تا بشه جدا جدا برای چوب/خشت-آهن/گندم خرید
        bonus_key = f"resource_bonus_{village.id}_{resource_type}"
        if cache.get(bonus_key):
            return Response({"error": "این بونوس هم‌اکنون برای این نوع منبع فعال است."}, status=400)

        player.gold_coins -= RESOURCE_BONUS_GOLD_COST
        player.save(update_fields=['gold_coins'])

        cache.set(bonus_key, True, timeout=RESOURCE_BONUS_DURATION_HOURS * 3600)

        resource_label = {
            "wood": "چوب",
            "clay": "خشت",
            "iron": "آهن",
            "crop": "گندم",
            "all": "همه منابع",
        }[resource_type]
        GameLog.objects.create(
            village=village, log_type='SYSTEM',
            description=f"بونوس {RESOURCE_BONUS_PERCENT}% تولید {resource_label} به مدت {RESOURCE_BONUS_DURATION_HOURS} ساعت فعال شد."
        )

        return Response({
            "message": f"بونوس {RESOURCE_BONUS_PERCENT}% تولید {resource_label} برای {RESOURCE_BONUS_DURATION_HOURS} ساعت فعال شد!",
            "gold_coins": player.gold_coins,
        })


class BuyFullWarehouseView(APIView):
    """پر کردن فوری انبار/سیلو با طلا (غیرفعال در دهکده‌های شگفتی جهان)."""
    permission_classes = [IsAuthenticated]

    GOLD_COST_PER_1000 = 2  # هزینه به ازای هر 1000 واحد منبع

    def post(self, request):
        village_id = request.data.get('village_id')
        resource_type = request.data.get('resource_type', 'all')  # wood, clay, iron, crop, all

        player = request.user
        try:
            village = Village.objects.get(id=village_id, player=player)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        # غیرفعال در دهکده‌های شگفتی جهان
        if hasattr(village, 'world_wonder'):
            return Response({"error": "خرید منابع در دهکده‌های شگفتی جهان غیرفعال است."}, status=400)

        resources_to_fill = {}
        if resource_type in ('wood', 'all'):
            resources_to_fill['wood'] = max(0, village.max_storage - village.wood)
        if resource_type in ('clay', 'all'):
            resources_to_fill['clay'] = max(0, village.max_storage - village.clay)
        if resource_type in ('iron', 'all'):
            resources_to_fill['iron'] = max(0, village.max_storage - village.iron)
        if resource_type in ('crop', 'all'):
            resources_to_fill['crop'] = max(0, village.max_granary - village.crop)

        total_to_fill = sum(resources_to_fill.values())
        if total_to_fill <= 0:
            return Response({"error": "انبار/سیلو از قبل پر است."}, status=400)

        gold_cost = max(1, int((total_to_fill / 1000) * self.GOLD_COST_PER_1000))
        if player.gold_coins < gold_cost:
            return Response({"error": f"طلای کافی ندارید. هزینه: {gold_cost} سکه."}, status=400)

        player.gold_coins -= gold_cost
        player.save(update_fields=['gold_coins'])

        for res, amount in resources_to_fill.items():
            setattr(village, res, getattr(village, res) + amount)
        village.save()

        GameLog.objects.create(
            village=village, log_type='SYSTEM',
            description=f"انبار با موفقیت با طلا پر شد (هزینه: {gold_cost} سکه)."
        )

        return Response({
            "message": f"منابع با موفقیت خریداری شد (هزینه: {gold_cost} سکه).",
            "resources": {"wood": village.wood, "clay": village.clay, "iron": village.iron, "crop": village.crop},
            "gold_coins": player.gold_coins,
        })


PROTECTION_GOLD_COST = 200
MAX_PROTECTION_PURCHASES = 10


class BuyProtectionView(APIView):
    """خرید محافظت تازه‌وارد با طلا."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        player = request.user

        # بررسی تعداد دفعات خرید
        protection_purchases_key = f"protection_purchases_{player.id}"
        from django.core.cache import cache
        purchases_count = cache.get(protection_purchases_key, 0)

        if purchases_count >= MAX_PROTECTION_PURCHASES:
            return Response({"error": f"حداکثر {MAX_PROTECTION_PURCHASES} بار خرید محافظت در هر سرور مجاز است."}, status=400)

        # بررسی آیا محافظت فعال است
        if player.has_attacked:
            return Response({"error": "شما قبلا حمله کرده‌اید و نمی‌توانید محافظت بخرید."}, status=400)

        # بررسی آیا نقشه‌های ساخت شگفتی جهان آزاد شده‌اند
        server_settings = ServerSetting.objects.filter(is_active=True).first()
        if server_settings and server_settings.ww_unlocked:
            return Response({"error": "پس از آزادسازی نقشه‌های ساخت شگفتی جهان، خرید محافظت غیرفعال است."}, status=400)

        if player.gold_coins < PROTECTION_GOLD_COST:
            return Response({"error": f"طلای کافی ندارید. هزینه: {PROTECTION_GOLD_COST} سکه."}, status=400)

        player.gold_coins -= PROTECTION_GOLD_COST
        player.has_attacked = False  # بازنشانی محافظت
        player.save(update_fields=['gold_coins', 'has_attacked'])

        cache.set(protection_purchases_key, purchases_count + 1, timeout=None)

        return Response({
            "message": "محافظت تازه‌وارد با موفقیت فعال شد!",
            "gold_coins": player.gold_coins,
            "purchases_remaining": MAX_PROTECTION_PURCHASES - (purchases_count + 1),
        })


class ExitProtectionView(APIView):
    """خروج فوری از محافظت با طلا."""
    permission_classes = [IsAuthenticated]

    GOLD_COST = 100

    def post(self, request):
        player = request.user

        if not player.has_attacked:
            return Response({"error": "شما هم اکنون در محافظت نیستید."}, status=400)

        if player.gold_coins < self.GOLD_COST:
            return Response({"error": f"طلای کافی ندارید. هزینه: {self.GOLD_COST} سکه."}, status=400)

        player.gold_coins -= self.GOLD_COST
        player.has_attacked = True  # فعال کردن حالت "حمله شده"
        player.save(update_fields=['gold_coins', 'has_attacked'])

        return Response({
            "message": "محافظت با موفقیت لغو شد!",
            "gold_coins": player.gold_coins,
        })


INSTANT_RALLY_POINT_GOLD_COST = 50


class InstantRallyPointView(APIView):
    """احداث فوری محل گردهمایی سطح ۱ با طلا.

    ✅ FIX: قبلا این ویو دنبال ساختمانی به نام «اردوگاه» می‌گشت که اصلا در
    سیستم دهکده‌سازی وجود نداشت (ساختمان واقعی «محل گردهمایی» نام دارد و
    برای هر دهکده‌ای در position=39 از قبل ساخته می‌شود). تلاش برای ساخت
    یک VillageBuilding جدید در همان position همیشه با IntegrityError
    (نقض unique_together=('village','position')) کرش می‌کرد.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        player = request.user

        try:
            village = Village.objects.get(id=village_id, player=player)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        rally_point = VillageBuilding.objects.filter(
            village=village, building_type__name="محل گردهمایی"
        ).first()

        if rally_point is None:
            # این حالت عملا نباید پیش بیاید چون هر دهکده‌ای موقع ساخت یک
            # محل گردهمایی (با سطح پیش‌فرض ۱ یا ۰) دریافت می‌کند؛ اما برای
            # اطمینان این حالت را هم مدیریت می‌کنیم.
            return Response({"error": "محل گردهمایی در این دهکده یافت نشد."}, status=404)

        if rally_point.level >= 1:
            return Response({"error": "محل گردهمایی از قبل ساخته شده است."}, status=400)

        if player.gold_coins < INSTANT_RALLY_POINT_GOLD_COST:
            return Response(
                {"error": f"طلای کافی ندارید. هزینه: {INSTANT_RALLY_POINT_GOLD_COST} سکه."},
                status=400,
            )

        player.gold_coins -= INSTANT_RALLY_POINT_GOLD_COST
        player.save(update_fields=['gold_coins'])

        rally_point.level = 1
        rally_point.is_upgrading = False
        rally_point.upgrade_end_time = None
        rally_point.save()

        GameLog.objects.create(
            village=village, log_type='BUILDING',
            description="محل گردهمایی با طلا به سطح ۱ ارتقا یافت."
        )

        return Response({
            "message": "محل گردهمایی با موفقیت ساخته شد!",
            "gold_coins": player.gold_coins,
        })


INSTANT_CONSTRUCTION_GOLD_COST_PER_BUILDING = 30


class InstantConstructionView(APIView):
    """تکمیل فوری تمام ساخت‌وسازها و تحقیقات فعال با طلا.
    محدودیت: روی قصر و اقامتگاه کار نمی‌کند."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        village_id = request.data.get('village_id')
        player = request.user

        try:
            village = Village.objects.get(id=village_id, player=player)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        # ساختمان‌های در حال ارتقا (به جز قصر و اقامتگاه)
        EXCLUDED_BUILDINGS = ("عمارت اقامتی", "تالار شهر", "شگفتی جهان")
        upgrading_buildings = VillageBuilding.objects.filter(
            village=village, is_upgrading=True
        ).exclude(
            building_type__name__in=EXCLUDED_BUILDINGS
        )

        if not upgrading_buildings.exists():
            return Response({"error": "هیچ ساختمانی (به جز قصر/اقامتگاه) در حال ارتقا نیست."}, status=400)

        gold_cost = INSTANT_CONSTRUCTION_GOLD_COST_PER_BUILDING * upgrading_buildings.count()
        if player.gold_coins < gold_cost:
            return Response({"error": f"طلای کافی ندارید. هزینه: {gold_cost} سکه."}, status=400)

        player.gold_coins -= gold_cost
        player.save(update_fields=['gold_coins'])

        completed_buildings = []
        for building in upgrading_buildings:
            building.level += 1
            building.is_upgrading = False
            building.upgrade_end_time = None
            building.save()

            if building.building_type.name in ("انبار", "سیلوی غله"):
                recalculate_village_capacities(village)

            completed_buildings.append(f"{building.building_type.name} → سطح {building.level}")

            GameLog.objects.create(
                village=village, log_type='BUILDING',
                description=f"ارتقای {building.building_type.name} به سطح {building.level} (تکمیل فوری با طلا)."
            )

        return Response({
            "message": f"{len(completed_buildings)} ساختمان با موفقیت تکمیل شد (هزینه: {gold_cost} سکه).",
            "completed": completed_buildings,
            "gold_coins": player.gold_coins,
        })


GOLD_CLUB_COST = 500


class BuyGoldClubView(APIView):
    """خرید کلوپ طلایی با طلا."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        player = request.user
        return Response({
            "has_gold_club": player.has_gold_club,
            "cost": GOLD_CLUB_COST,
            "gold_coins": player.gold_coins,
        })

    def post(self, request):
        player = request.user

        if player.has_gold_club:
            return Response({"error": "شما از قبل کلوپ طلایی دارید."}, status=400)

        if player.gold_coins < GOLD_CLUB_COST:
            return Response({"error": f"طلای کافی ندارید. هزینه: {GOLD_CLUB_COST} سکه."}, status=400)

        player.gold_coins -= GOLD_CLUB_COST
        player.has_gold_club = True
        player.save(update_fields=['gold_coins', 'has_gold_club'])

        return Response({
            "message": "کلوپ طلایی با موفقیت فعال شد!",
            "gold_coins": player.gold_coins,
        })


class CropperSearchView(APIView):
    """جستجوی دهکده‌های ۹ گندمی و ۱۵ گندمی روی نقشه (مخصوص اعضای کلوپ طلایی)."""
    permission_classes = [IsAuthenticated]

    CROP_FIELD_NAME = "مزرعه گندم"
    TARGET_CROP_COUNTS = {'9': 9, '15': 15}

    def get(self, request):
        player = request.user

        if not player.has_gold_club:
            return Response({"error": "برای استفاده از این قابلیت به کلوپ طلایی نیاز دارید."}, status=403)

        try:
            center_x = int(request.query_params.get('x', 0))
            center_y = int(request.query_params.get('y', 0))
        except (TypeError, ValueError):
            return Response({"error": "مختصات نامعتبر است."}, status=400)

        target_type = request.query_params.get('type', '9')
        if target_type not in self.TARGET_CROP_COUNTS:
            return Response({"error": "نوع جستجو باید 9 یا 15 باشد."}, status=400)
        required_crop_fields = self.TARGET_CROP_COUNTS[target_type]

        radius = min(max(int(request.query_params.get('radius', 20) or 20), 5), 100)

        from .models import Village

        candidate_villages = Village.objects.filter(
            x_coord__range=(center_x - radius, center_x + radius),
            y_coord__range=(center_y - radius, center_y + radius),
            is_farm_village=False,
            is_natar_ww_site=False,
            is_natar_plan_guard=False,
            is_natar_artifact_site=False,
        ).exclude(player=player)

        results = []
        for v in candidate_villages:
            crop_field_count = VillageBuilding.objects.filter(
                village=v, building_type__name=self.CROP_FIELD_NAME
            ).count()

            # ✅ FIX: مقایسه‌ی دقیق (نه >=) تا "۹ گندمی" با "۱۵ گندمی" قاطی نشود
            if crop_field_count == required_crop_fields:
                results.append({
                    "id": v.id,
                    "name": v.name,
                    "x_coord": v.x_coord,
                    "y_coord": v.y_coord,
                    "player_name": v.player.username,
                    "distance": ((v.x_coord - center_x) ** 2 + (v.y_coord - center_y) ** 2) ** 0.5,
                })

        results.sort(key=lambda x: x['distance'])

        return Response({
            "type": f"{target_type}-cropper",
            "results": results[:20],
            "total_found": len(results),
        })
    

GOLD_TO_SILVER_RATE = 100  # 10 Gold = 1,000 Silver (100 Silver per Gold)


class GoldToSilverExchangeView(APIView):
    """تبدیل طلا به نقره با نرخ ۱۰ طلا = ۱,۰۰۰ نقره."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        player = request.user
        return Response({
            "gold_coins": player.gold_coins,
            "silver_coins": player.silver_coins,
            "exchange_rate": f"10 طلا = 1,000 نقره (هر طلا = {GOLD_TO_SILVER_RATE} نقره)",
        })

    def post(self, request):
        gold_amount = int(request.data.get('gold_amount', 0))
        player = request.user

        if gold_amount <= 0:
            return Response({"error": "مقدار طلا نامعتبر است."}, status=400)

        if gold_amount % 10 != 0:
            return Response({"error": "مقدار طلا باید مضربی از ۱۰ باشد."}, status=400)

        if player.gold_coins < gold_amount:
            return Response({"error": f"طلای کافی ندارید. موجودی: {player.gold_coins} سکه."}, status=400)

        silver_amount = gold_amount * GOLD_TO_SILVER_RATE

        player.gold_coins -= gold_amount
        player.silver_coins += silver_amount
        player.save(update_fields=['gold_coins', 'silver_coins'])

        return Response({
            "message": f"{gold_amount} طلا با موفقیت به {silver_amount} نقره تبدیل شد.",
            "gold_coins": player.gold_coins,
            "silver_coins": player.silver_coins,
        })


class GoldTroopShopView(APIView):
    """فروشگاه خرید نیرو با طلا - نیروهای نژاد بازیکن یا حیوانات طبیعی."""
    permission_classes = [IsAuthenticated]

    # قیمت نیروها به ازای هر واحد (بر اساس هزینه منابع * ضریب)
    TROOP_GOLD_MULTIPLIER = 2  # 2 طلا به ازای هر 1000 واحد هزینه منابع

    def get(self, request):
        from apps.combat.models import TroopType, Animal

        player = request.user

        # نیروهای نژاد بازیکن
        tribe_troops = TroopType.objects.filter(tribe=player.tribe).exclude(
            is_scout=True, is_settler=True, is_chief=True
        )
        troops_data = []
        for troop in tribe_troops:
            total_cost = troop.wood_cost + troop.clay_cost + troop.iron_cost + troop.crop_cost
            gold_price = max(1, int((total_cost / 1000) * self.TROOP_GOLD_MULTIPLIER))
            troops_data.append({
                "id": troop.id,
                "name": troop.name,
                "type": "troop",
                "attack_power": troop.attack_power,
                "defense_infantry": troop.defense_infantry,
                "defense_cavalry": troop.defense_cavalry,
                "gold_price": gold_price,
            })

        # حیوانات طبیعی
        animals = Animal.objects.all()
        animals_data = []
        for animal in animals:
            animals_data.append({
                "id": animal.id,
                "name": animal.name,
                "type": "animal",
                "defense_infantry": animal.defense_infantry,
                "defense_cavalry": animal.defense_cavalry,
                "gold_price": animal.gold_price,
            })

        return Response({
            "troops": troops_data,
            "animals": animals_data,
            "gold_coins": player.gold_coins,
        })

    def post(self, request):
        from apps.combat.models import TroopType, Animal, VillageTroop, VillageAnimal

        village_id = request.data.get('village_id')
        item_id = request.data.get('item_id')
        item_type = request.data.get('item_type', 'troop')  # 'troop' or 'animal'
        quantity = int(request.data.get('quantity', 1))

        if quantity <= 0:
            return Response({"error": "تعداد نامعتبر است."}, status=400)

        player = request.user
        try:
            village = Village.objects.get(id=village_id, player=player)
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        if item_type == 'troop':
            try:
                troop = TroopType.objects.get(id=item_id, tribe=player.tribe)
            except TroopType.DoesNotExist:
                return Response({"error": "نیرو یافت نشد."}, status=404)

            total_cost = troop.wood_cost + troop.clay_cost + troop.iron_cost + troop.crop_cost
            gold_price = max(1, int((total_cost / 1000) * self.TROOP_GOLD_MULTIPLIER))
            total_gold = gold_price * quantity

            if player.gold_coins < total_gold:
                return Response({"error": f"طلای کافی ندارید. هزینه: {total_gold} سکه."}, status=400)

            player.gold_coins -= total_gold
            player.save(update_fields=['gold_coins'])

            village_troop, _ = VillageTroop.objects.get_or_create(
                village=village, troop_type=troop, defaults={'count': 0}
            )
            village_troop.count += quantity
            village_troop.save()

            GameLog.objects.create(
                village=village, log_type='SYSTEM',
                description=f"{quantity} {troop.name} با طلا خریداری شد (هزینه: {total_gold} سکه)."
            )

            return Response({
                "message": f"{quantity} {troop.name} با موفقیت خریداری شد!",
                "gold_coins": player.gold_coins,
            })

        elif item_type == 'animal':
            try:
                animal = Animal.objects.get(id=item_id)
            except Animal.DoesNotExist:
                return Response({"error": "حیوان یافت نشد."}, status=404)

            total_gold = animal.gold_price * quantity
            if player.gold_coins < total_gold:
                return Response({"error": f"طلای کافی ندارید. هزینه: {total_gold} سکه."}, status=400)

            player.gold_coins -= total_gold
            player.save(update_fields=['gold_coins'])

            village_animal, _ = VillageAnimal.objects.get_or_create(
                village=village, animal=animal, defaults={'count': 0}
            )
            village_animal.count += quantity
            village_animal.save()

            GameLog.objects.create(
                village=village, log_type='SYSTEM',
                description=f"{quantity} {animal.name} با طلا خریداری شد (هزینه: {total_gold} سکه)."
            )

            return Response({
                "message": f"{quantity} {animal.name} با موفقیت خریداری شد!",
                "gold_coins": player.gold_coins,
            })

        return Response({"error": "نوع آیتم نامعتبر است."}, status=400)


ADMIN_USERNAME = "admin"


class SupportMessageView(APIView):
    """ارسال پیام پشتیبانی مستقیم به حساب ادمین بازی."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subject = request.data.get('subject', 'درخواست پشتیبانی')
        body = request.data.get('body', '')

        if not body.strip():
            return Response({"error": "متن پیام نمی‌تواند خالی باشد."}, status=400)

        # ✅ FIX: قبلا فقط دنبال username="admin" می‌گشت و اگر seed نشده بود همیشه 404 می‌داد.
        admin_player = (
            Player.objects.filter(username=ADMIN_USERNAME).first()
            or Player.objects.filter(is_superuser=True).exclude(id=request.user.id).order_by('id').first()
        )
        if not admin_player:
            return Response(
                {"error": "حساب پشتیبانی هنوز روی این سرور تنظیم نشده است. لطفا دستور seed_admin_account را اجرا کنید."},
                status=503,
            )

        Message.objects.create(
            sender=request.user,
            receiver=admin_player,
            subject=f"[پشتیبانی] {subject}",
            body=body
        )

        return Response({"message": "پیام شما با موفقیت به تیم پشتیبانی ارسال شد."}, status=201)

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

                residence_ok = VillageBuilding.objects.filter(
                    village=village, building_type__name="عمارت قهرمان", level__gt=0
                ).exists()
                if not residence_ok:
                    return Response({"error": "برای تصاحب اوسیس ابتدا باید عمارت قهرمان بسازید."}, status=400)
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

            GameLog.objects.create(village=village, log_type='COMBAT', description=message)

        return Response({
            "message": message,
            "victory": combat_result["victory"],
            "attacker_loss_percent": round(combat_result["attacker_loss_percent"], 1),
        })


class VillagesOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        villages = Village.objects.filter(player=request.user).order_by('name')

        data = []
        for village in villages:
            update_village_resources(village)
            rates = get_effective_production_rates(village)
            population = calculate_village_population(village)

            upgrading_building = VillageBuilding.objects.filter(
                village=village, is_upgrading=True
            ).order_by('upgrade_end_time').first()

            incoming_attacks = 0
            if request.user.has_plus_active():
                from apps.combat.models import TroopMovement
                incoming_attacks = TroopMovement.objects.filter(
                    target_village=village, movement_type__in=['ATTACK', 'RAID'], is_completed=False
                ).count()

            data.append({
                "id": village.id,
                "name": village.name,
                "x_coord": village.x_coord,
                "y_coord": village.y_coord,
                "is_capital": village.is_capital,
                "population": population,
                "resources": {
                    "wood": round(village.wood, 1), "clay": round(village.clay, 1),
                    "iron": round(village.iron, 1), "crop": round(village.crop, 1),
                },
                "max_storage": village.max_storage,
                "max_granary": village.max_granary,
                "production": {
                    "wood": round(rates['wood'], 1), "clay": round(rates['clay'], 1),
                    "iron": round(rates['iron'], 1), "crop": round(rates['crop'], 1),
                },
                "has_world_wonder": hasattr(village, 'world_wonder'),
                "building_queue_active": bool(upgrading_building),
                "building_queue_finish": upgrading_building.upgrade_end_time if upgrading_building else None,
                "incoming_attacks": incoming_attacks,
            })

        return Response({
            "villages": data,
            "village_count": len(data),
            "total_population": sum(v['population'] for v in data),
        })


class OasisReleaseView(APIView):
    """رها کردن یک اوسیس متعلق به بازیکن (از طریق عمارت قهرمان)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import Oasis
        oasis_id = request.data.get('oasis_id')
        try:
            oasis = Oasis.objects.select_for_update().get(id=oasis_id)
        except (Oasis.DoesNotExist, ValueError, TypeError):
            return Response({"error": "اوسیس یافت نشد."}, status=404)

        if not oasis.owner_village or oasis.owner_village.player_id != request.user.id:
            return Response({"error": "این اوسیس متعلق به شما نیست."}, status=403)

        coords = f"({oasis.x_coord}|{oasis.y_coord})"
        oasis.owner_village = None
        oasis.save()
        return Response({"message": f"اوسیس {coords} با موفقیت رها شد."})


class ArtifactListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Artifact
        artifacts = Artifact.objects.select_related('holder_village__player').all()
        data = []
        for a in artifacts:
            holder_village = a.holder_village
            is_claimed = bool(holder_village and holder_village.player.username != "Natars")
            data.append({
                "id": a.id,
                "name": a.name,
                "effect_type": a.effect_type,
                "effect_type_display": a.get_effect_type_display(),
                "multiplier": a.multiplier,
                "is_alliance_wide": a.is_alliance_wide,
                "is_claimed": is_claimed,
                "holder_village_name": holder_village.name if holder_village else None,
                "holder_coords": f"{holder_village.x_coord}|{holder_village.y_coord}" if holder_village else None,
                "holder_player": holder_village.player.username if (holder_village and is_claimed) else None,
                "is_activated": a.is_activated,
                "activates_at": a.activates_at,
                "is_mine": bool(is_claimed and holder_village.player_id == request.user.id),
            })
        return Response(data)


class LatestDailyMedalsView(APIView):
    """۱۰ نفر برتر آخرین روزی که مدال‌ها محاسبه شده‌اند (رتبه‌بندی روزانه عمومی)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import DailyMedal
        latest_day = DailyMedal.objects.order_by('-day_number').values_list('day_number', flat=True).first()
        if latest_day is None:
            return Response({"day_number": None, "attackers": [], "defenders": [], "population": []})

        def serialize(category):
            medals = DailyMedal.objects.filter(
                day_number=latest_day, category=category
            ).select_related('player').order_by('rank')
            return [{"rank": m.rank, "player": m.player.username} for m in medals]

        return Response({
            "day_number": latest_day,
            "attackers": serialize('ATTACKER'),
            "defenders": serialize('DEFENDER'),
            "population": serialize('POPULATION'),
        })


class MyMedalsView(APIView):
    """مدال‌های خود بازیکن + امکان مخفی/آشکارسازی هرکدام در پروفایل."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import DailyMedal
        medals = DailyMedal.objects.filter(player=request.user).order_by('-day_number', 'category', 'rank')
        return Response([
            {
                "id": m.id,
                "category": m.category,
                "category_display": m.get_category_display(),
                "day_number": m.day_number,
                "rank": m.rank,
                "is_visible": m.is_visible,
            }
            for m in medals
        ])


class ToggleMedalVisibilityView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import DailyMedal
        medal_id = request.data.get('medal_id')
        try:
            medal = DailyMedal.objects.get(id=medal_id, player=request.user)
        except (DailyMedal.DoesNotExist, ValueError, TypeError):
            return Response({"error": "مدال یافت نشد."}, status=404)
        medal.is_visible = not medal.is_visible
        medal.save(update_fields=['is_visible'])
        return Response({"message": "وضعیت نمایش مدال به‌روزرسانی شد.", "is_visible": medal.is_visible})


class PlayerPublicMedalsView(APIView):
    """مدال‌های قابل‌نمایش یک بازیکن دیگر (برای نمایش در پروفایل عمومی)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, player_id):
        from .models import DailyMedal
        medals = DailyMedal.objects.filter(
            player_id=player_id, is_visible=True
        ).select_related('player').order_by('-day_number', 'category', 'rank')
        return Response([
            {
                "category": m.category,
                "category_display": m.get_category_display(),
                "day_number": m.day_number,
                "rank": m.rank,
            }
            for m in medals
        ])


def _generate_unique_pin():  # ✅ جدید
    import random, string
    from .models import GoldBankDeposit
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))
        if not GoldBankDeposit.objects.filter(pin_code=code).exists():
            return code


class GoldBankDepositView(APIView):
    """انتقال طلا به بانک: طلا از حساب کسر و یک کد PIN یک‌بارمصرف صادر می‌شود."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import GoldBankDeposit

        email = (request.data.get('email') or '').strip()
        try:
            amount = int(request.data.get('amount', 0))
        except (TypeError, ValueError):
            amount = 0

        if not email:
            return Response({"error": "ایمیل مقصد را وارد کنید."}, status=400)
        if amount <= 0:
            return Response({"error": "مقدار طلا نامعتبر است."}, status=400)

        with transaction.atomic():
            player = Player.objects.select_for_update().get(id=request.user.id)
            if player.gold_coins < amount:
                return Response({"error": "طلای کافی در حساب ندارید."}, status=400)

            player.gold_coins -= amount
            player.save(update_fields=['gold_coins'])

            pin_code = _generate_unique_pin()
            GoldBankDeposit.objects.create(
                email=email, amount=amount, pin_code=pin_code, depositor=player,
            )

        return Response({
            "message": f"{amount} سکه طلا به بانک منتقل شد. کد پین زیر را نگه دارید.",
            "pin_code": pin_code,
            "gold_coins": player.gold_coins,
        })


class GoldBankWithdrawView(APIView):
    """دریافت طلا از بانک با وارد کردن کد PIN."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import GoldBankDeposit

        pin_code = (request.data.get('pin_code') or '').strip().upper()
        if not pin_code:
            return Response({"error": "کد پین را وارد کنید."}, status=400)

        with transaction.atomic():
            try:
                deposit = GoldBankDeposit.objects.select_for_update().get(pin_code=pin_code, is_redeemed=False)
            except GoldBankDeposit.DoesNotExist:
                return Response({"error": "این کد پین نامعتبر است یا قبلا استفاده شده."}, status=400)

            player = Player.objects.select_for_update().get(id=request.user.id)
            player.gold_coins += deposit.amount
            player.save(update_fields=['gold_coins'])

            deposit.is_redeemed = True
            deposit.redeemed_by = player
            deposit.redeemed_at = timezone.now()
            deposit.save()

        return Response({
            "message": f"{deposit.amount} سکه طلا با موفقیت به حساب شما اضافه شد.",
            "gold_coins": player.gold_coins,
        })


class MyGoldBankDepositsView(APIView):
    """تاریخچه‌ی انتقال‌های خودِ بازیکن (برای مراجعه‌ی بعدی به کد پین)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import GoldBankDeposit
        deposits = GoldBankDeposit.objects.filter(depositor=request.user).order_by('-created_at')
        return Response([
            {
                "id": d.id, "email": d.email, "amount": d.amount, "pin_code": d.pin_code,
                "is_redeemed": d.is_redeemed, "created_at": d.created_at, "redeemed_at": d.redeemed_at,
            }
            for d in deposits
        ])