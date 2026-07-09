from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.game_engine.models import Village
from .services import validate_ww_upgrade
from apps.game_engine.models import Village, ServerSetting
from .models import WorldWonder


class UpgradeWWView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        active_server = ServerSetting.objects.filter(is_active=True).first()
        if active_server and active_server.is_finished:
            return Response({"error": "این سرور به پایان رسیده و دیگر ارتقای شگفتی جهان ممکن نیست."}, status=400)

        try:
            village = Village.objects.get(player=request.user, id=request.data.get('village_id'))
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد."}, status=404)

        ww, created = WorldWonder.objects.get_or_create(village=village)

        if ww.level >= 100:
            return Response({"error": "این شگفتی جهان به حداکثر سطح (۱۰۰) رسیده است."}, status=400)

        try:
            # بررسی پیش‌نیازها (مثل داشتن نقشه‌های ساخت دوم در اتحاد)
            validate_ww_upgrade(request.user, village, ww.level)

            # لاجیک کسر منابع برای شگفتی جهان
            base_cost = 50000 # هزینه پایه بسیار بالا
            multiplier = 1.1 ** ww.level
            req_res = int(base_cost * multiplier)

            if village.wood < req_res or village.clay < req_res or village.iron < req_res or village.crop < req_res:
                return Response({"error": "منابع کافی نیست."}, status=400)

            village.wood -= req_res
            village.clay -= req_res
            village.iron -= req_res
            village.crop -= req_res
            village.save()

            ww.level += 1
            ww.save()

            # ✅ هماهنگ کردن بج لول روی نقشه‌ی دهکده با لول واقعی
            from apps.game_engine.models import VillageBuilding
            VillageBuilding.objects.filter(
                village=village, building_type__name="شگفتی جهان"
            ).update(level=ww.level)

            # ✅ چک فوری برنده به‌جای صبر تا کرون ساعتی
            from apps.world_wonder.tasks import _check_for_winner
            active_server_obj = ServerSetting.objects.filter(is_active=True).first()
            if active_server_obj:
                _check_for_winner(active_server_obj)

            return Response({"message": f"شگفتی جهان به سطح {ww.level} ارتقا یافت!"})

        except Exception as e:
            return Response({"error": str(e)}, status=400)