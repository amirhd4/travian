from django.contrib import admin
from .models import (
    ServerSetting, Village, BuildingType, VillageBuilding, GameLog,
    QuestDefinition, PlayerQuestProgress, Artifact,  # ✅ Artifact
)

admin.site.register(QuestDefinition)
admin.site.register(PlayerQuestProgress)


@admin.register(ServerSetting)
class ServerSettingAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'is_active', 'server_speed', 'troop_speed', 'building_speed',
        'troop_training_speed', 'duration_days', 'new_player_protection_days',
        'starting_max_storage', 'starting_max_granary',
        'farm_village_count', 'farm_village_multiplier',
        'start_date', 'ww_unlocked', 'artifacts_unlocked', 'artifact_release_duration_percent',
        'is_finished',
    )
    list_editable = (
        'is_active', 'server_speed', 'troop_speed', 'building_speed',
        'troop_training_speed', 'new_player_protection_days', 'ww_unlocked',
        'artifacts_unlocked', 'artifact_release_duration_percent',
        'starting_max_storage', 'starting_max_granary',
        'farm_village_count', 'farm_village_multiplier',
    )


@admin.register(Artifact)
class ArtifactAdmin(admin.ModelAdmin):
    list_display = ('name', 'effect_type', 'multiplier', 'is_alliance_wide', 'holder_village', 'is_activated', 'activates_at')
    list_filter = ('effect_type', 'is_activated', 'is_alliance_wide')


@admin.register(Village)
class VillageAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'player', 'x_coord', 'y_coord', 'is_capital', 'loyalty',
        'is_natar_ww_site', 'is_natar_plan_guard', 'is_farm_village',
        'wood', 'clay', 'iron', 'crop',
    )
    search_fields = ('name', 'player__email')
    list_filter = ('is_capital', 'is_farm_village', 'is_natar_ww_site')


admin.site.register(BuildingType)
admin.site.register(VillageBuilding)
admin.site.register(GameLog)