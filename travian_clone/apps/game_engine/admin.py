from django.contrib import admin
from .models import ServerSetting, Village, BuildingType, VillageBuilding, GameLog, QuestDefinition, PlayerQuestProgress

admin.site.register(QuestDefinition)
admin.site.register(PlayerQuestProgress)

@admin.register(ServerSetting)
class ServerSettingAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'is_active', 'server_speed', 'troop_speed', 'building_speed',
        'troop_training_speed', 'duration_days', 'starting_max_storage',
        'starting_max_granary', 'farm_village_count', 'farm_village_multiplier',
        'start_date', 'ww_unlocked',
    )
    list_editable = (
        'is_active', 'server_speed', 'troop_speed', 'building_speed',
        'troop_training_speed', 'ww_unlocked', 'starting_max_storage',
        'starting_max_granary', 'farm_village_count', 'farm_village_multiplier',
    )

@admin.register(Village)
class VillageAdmin(admin.ModelAdmin):
    list_display = ('name', 'player', 'x_coord', 'y_coord', 'is_capital', 'wood', 'clay', 'iron', 'crop')
    search_fields = ('name', 'player__email')
    list_filter = ('is_capital',)

admin.site.register(BuildingType)
admin.site.register(VillageBuilding)
admin.site.register(GameLog)