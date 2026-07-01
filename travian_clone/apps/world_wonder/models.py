from django.db import models
from apps.game_engine.models import Village

class WorldWonder(models.Model):
    village = models.OneToOneField(Village, on_delete=models.CASCADE, related_name='world_wonder')
    level = models.IntegerField(default=0)
    last_upgraded = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"WW Level {self.level} - {self.village.name}"