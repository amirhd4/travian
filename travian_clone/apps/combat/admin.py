from django.contrib import admin
from .models import (
    TroopType, VillageTroop, TroopMovement,
    Hero, PlayerHeroItem, HeroItem, Animal, VillageAnimal,
)


@admin.register(TroopType)
class TroopTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'tribe', 'attack_power', 'speed', 'carry_capacity', 'is_siege_weapon', 'is_settler')
    list_filter = ('tribe', 'is_siege_weapon', 'is_settler')


admin.site.register(VillageTroop)
admin.site.register(TroopMovement)


@admin.register(Hero)
class HeroAdmin(admin.ModelAdmin):
    list_display = ('player', 'level', 'experience', 'health', 'is_alive', 'home_village')


admin.site.register(PlayerHeroItem)
admin.site.register(HeroItem)
admin.site.register(Animal)
admin.site.register(VillageAnimal)