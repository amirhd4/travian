from django.contrib import admin
from .models import ServerSetting, Village, BuildingType, VillageBuilding, GameLog


@admin.register(ServerSetting)
class ServerSettingAdmin(admin.ModelAdmin):
    list_display = ('id', 'is_active', 'server_speed', 'duration_days', 'start_date', 'ww_unlocked')
    list_editable = ('is_active', 'server_speed', 'ww_unlocked')

@admin.register(Village)
class VillageAdmin(admin.ModelAdmin):
    list_display = ('name', 'player', 'x_coord', 'y_coord', 'is_capital', 'wood', 'clay', 'iron', 'crop')
    search_fields = ('name', 'player__email')
    list_filter = ('is_capital',)

admin.site.register(BuildingType)
admin.site.register(VillageBuilding)
admin.site.register(GameLog)