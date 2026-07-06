from django.contrib import admin
from .models import (
    TroopType, VillageTroop, TroopMovement,
    Hero, PlayerHeroItem, HeroItem, Animal, VillageAnimal, TrainingQueue,
)


@admin.register(TroopType)
class TroopTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'tribe', 'attack_power', 'speed', 'carry_capacity', 'is_siege_weapon', 'is_settler', 'is_scout')
    list_filter = ('tribe', 'is_siege_weapon', 'is_settler', 'is_scout')


admin.site.register(VillageTroop)
admin.site.register(TroopMovement)


@admin.register(Hero)
class HeroAdmin(admin.ModelAdmin):
    list_display = ('player', 'level', 'experience', 'health', 'is_alive', 'home_village')


admin.site.register(PlayerHeroItem)
admin.site.register(HeroItem)
admin.site.register(Animal)
admin.site.register(VillageAnimal)


@admin.register(TrainingQueue)
class TrainingQueueAdmin(admin.ModelAdmin):
    list_display = ('village', 'troop_type', 'count', 'started_at', 'finishes_at', 'is_completed')
    list_filter = ('is_completed',)