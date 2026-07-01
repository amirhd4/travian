from django.contrib import admin
from .models import Player

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ('email', 'phone_number', 'tribe', 'gold_coins', 'has_ww_plan')
    search_fields = ('email', 'phone_number')
    list_filter = ('tribe', 'has_ww_plan')