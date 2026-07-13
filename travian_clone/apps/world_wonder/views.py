from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.game_engine.models import Village, VillageBuilding, ServerSetting
from .services import validate_ww_upgrade
from .models import WorldWonder, WWBuildingPlan


class UpgradeWWView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_valid_ww_village(self, request, village_id):
        """
        ✅ FIX: قبلا هر دهکده‌ای (even بدون تسخیر دهکده‌ی ویرانه‌ی ناتار) با صرف
        صدا زدن این endpoint صاحب شگفتی جهان می‌شد. حالا باید ساختمان واقعی
        «شگفتی جهان» (که فقط بعد از تسخیر دهکده‌ی ویرانه ساخته می‌شود) موجود باشد.
        """
        try:
            village = Village.objects.get(id=village_id, player=request.user)
        except (Village.DoesNotExist, ValueError, TypeError):
            return None, Response({"error": "دهکده یافت نشد یا متعلق به شما نیست."}, status=404)

        is_ww_site = VillageBuilding.objects.filter(
            village=village, building_type__name="شگفتی جهان"
        ).exists()
        if not is_ww_site:
            return None, Response(
                {"error": "این دهکده هرگز محل شگفتی جهان نبوده است؛ ابتدا باید یکی از "
                          "دهکده‌های ویرانه‌ی ناتار را با سناتور/رئیس تسخیر کنید."},
                status=400,
            )
        return village, None

    def get(self, request):
        village, error_response = self._get_valid_ww_village(request, request.query_params.get('village_id'))
        if error_response:
            return error_response

        ww, _ = WorldWonder.objects.get_or_create(village=village)
        base_cost = 50000
        req_res = int(base_cost * (1.1 ** ww.level))

        has_valid_plan = WWBuildingPlan.objects.filter(
            holder_village__player=request.user,
            holder_village__buildings__building_type__name="خزانه‌داری",
            holder_village__buildings__level__gte=10,
        ).exists()
        active_server = ServerSetting.objects.filter(is_active=True).first()

        return Response({
            "level": ww.level,
            "is_max_level": ww.level >= 100,
            "next_level_cost": {"wood": req_res, "clay": req_res, "iron": req_res, "crop": req_res},
            "has_valid_plan": has_valid_plan,
            "is_server_finished": bool(active_server and active_server.is_finished),
        })

    def post(self, request):
        active_server = ServerSetting.objects.filter(is_active=True).first()
        if active_server and active_server.is_finished:
            return Response({"error": "این سرور به پایان رسیده و دیگر ارتقای شگفتی جهان ممکن نیست."}, status=400)

        village, error_response = self._get_valid_ww_village(request, request.data.get('village_id'))
        if error_response:
            return error_response

        ww, _ = WorldWonder.objects.get_or_create(village=village)
        if ww.level >= 100:
            return Response({"error": "این شگفتی جهان به حداکثر سطح (۱۰۰) رسیده است."}, status=400)

        try:
            validate_ww_upgrade(request.user, village, ww.level)
            base_cost = 50000
            req_res = int(base_cost * (1.1 ** ww.level))

            if village.wood < req_res or village.clay < req_res or village.iron < req_res or village.crop < req_res:
                return Response({"error": "منابع کافی نیست."}, status=400)

            village.wood -= req_res; village.clay -= req_res
            village.iron -= req_res; village.crop -= req_res
            village.save()

            ww.level += 1
            ww.save()

            VillageBuilding.objects.filter(
                village=village, building_type__name="شگفتی جهان"
            ).update(level=ww.level)

            from apps.world_wonder.tasks import _check_for_winner
            active_server_obj = ServerSetting.objects.filter(is_active=True).first()
            if active_server_obj:
                _check_for_winner(active_server_obj)

            return Response({"message": f"شگفتی جهان به سطح {ww.level} ارتقا یافت!"})
        except Exception as e:
            return Response({"error": str(e)}, status=400)