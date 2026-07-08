from django.db import models
from apps.game_engine.models import Village

class WorldWonder(models.Model):
    village = models.OneToOneField(Village, on_delete=models.CASCADE, related_name='world_wonder')
    level = models.IntegerField(default=0)
    last_upgraded = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"WW Level {self.level} - {self.village.name}"


class WWBuildingPlan(models.Model):
    """
    نقشه‌ی ساخت شگفتی جهان: یک شیء فیزیکی که در خزانه‌داری یک دهکده‌ی
    مشخص نگهداری می‌شود. تا وقتی این نقشه در دهکده‌ای با خزانه‌داری سطح
    ۱۰ یا بالاتر باشد، بازیکن می‌تواند شگفتی جهانش را ارتقا دهد؛ اگر
    نقشه دزدیده شود، ارتقا متوقف می‌شود.
    """
    holder_village = models.ForeignKey(Village, on_delete=models.CASCADE, related_name='ww_plans')
    acquired_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"WW Plan at {self.holder_village.name}"