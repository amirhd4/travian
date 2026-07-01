from django.contrib import admin
from .models import TroopType, VillageTroop, TroopMovement

@admin.register(TroopType)
class TroopTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'tribe', 'attack_power', 'speed', 'carry_capacity')

admin.site.register(VillageTroop)
admin.site.register(TroopMovement)