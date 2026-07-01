from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.game_engine.models import Village
from .services import validate_ww_upgrade
from .models import WorldWonder

class UpgradeWWView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            village = Village.objects.get(player=request.user, id=request.data.get('village_id'))
        except Village.DoesNotExist:
            return Response({"error": "دهکده یافت نشد."}, status=404)

        ww, created = WorldWonder.objects.get_or_create(village=village)

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

            # ارتقا موفق
            ww.level += 1
            ww.save()
            return Response({"message": f"شگفتی جهان به سطح {ww.level} ارتقا یافت!"})

        except Exception as e:
            return Response({"error": str(e)}, status=400)